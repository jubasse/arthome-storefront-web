import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DATE_ID,
  DEVICE_ID,
  PROFILE_ID,
  SESSION_ID,
  dataResponse,
  errorResponse,
  renewal,
  requestBody,
  ticket,
} from '@/test/bff-double';

import { LivePlayer } from './live-player';

const hlsHarness = vi.hoisted(() => {
  type Listener = (event: string, data: unknown) => void;
  class FakeHls {
    static instances: FakeHls[] = [];
    static isSupported = () => true;
    static Events = { ERROR: 'hlsError', FRAG_LOADED: 'hlsFragLoaded' };
    static ErrorTypes = { NETWORK_ERROR: 'networkError', MEDIA_ERROR: 'mediaError' };
    listeners = new Map<string, Listener>();
    loadSource = vi.fn();
    attachMedia = vi.fn();
    startLoad = vi.fn();
    recoverMediaError = vi.fn();
    destroy = vi.fn();
    constructor(public config: { lowLatencyMode: boolean; xhrSetup: (xhr: object) => void }) {
      FakeHls.instances.push(this);
    }
    on(event: string, listener: Listener) {
      this.listeners.set(event, listener);
    }
    emit(event: string, data: unknown) {
      this.listeners.get(event)?.(event, data);
    }
  }
  return { FakeHls };
});

vi.mock('hls.js', () => ({ default: hlsHarness.FakeHls }));

const replace = vi.fn();
const router = { replace };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const { FakeHls } = hlsHarness;

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

function installFetch(handlers: Partial<Record<'open' | 'renew' | 'release', Handler>>) {
  const calls: { kind: string; url: string; init: RequestInit }[] = [];
  const fetchDouble = vi.fn(async (url: string, init: RequestInit) => {
    const kind = url.endsWith('/open') ? 'open' : url.endsWith('/renew') ? 'renew' : 'release';
    calls.push({ kind, url, init });
    const handler = handlers[kind];
    if (handler !== undefined) return handler(url, init);
    if (kind === 'release') return new Response(null, { status: 204 });
    throw new Error(`unexpected ${kind}`);
  });
  vi.stubGlobal('fetch', fetchDouble);
  return { calls, of: (kind: string) => calls.filter((call) => call.kind === kind) };
}

const props = { dateId: DATE_ID, deviceId: DEVICE_ID, profileId: PROFILE_ID };

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

beforeEach(() => {
  FakeHls.instances = [];
  replace.mockClear();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(async () => {
  cleanup();
  await vi.advanceTimersByTimeAsync(0);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('LivePlayer', () => {
  it('opens with the device and profile and plays the manifest with credentials', async () => {
    const bff = installFetch({ open: () => dataResponse(ticket()) });

    render(<LivePlayer {...props} />);
    await flush();

    const open = bff.of('open')[0];
    expect(open?.url).toBe(`/api/v1/playback/${DATE_ID}/open`);
    expect(requestBody(open?.init)).toEqual({
      deviceId: DEVICE_ID,
      profileId: PROFILE_ID,
      kind: 'live',
    });
    expect(new Headers(open?.init.headers).get('x-arthome-surface')).toBe('storefront_web');
    const hls = FakeHls.instances[0];
    expect(hls?.config.lowLatencyMode).toBe(true);
    const xhr = { withCredentials: false };
    hls?.config.xhrSetup(xhr);
    expect(xhr.withCredentials).toBe(true);
    expect(hls?.loadSource).toHaveBeenCalledWith('http://localhost:58888/watch/abc/master.m3u8');
    expect(hls?.attachMedia).toHaveBeenCalled();
  });

  it("renews after renewAfterSec and again on the next answer's value", async () => {
    const bff = installFetch({
      open: () => dataResponse(ticket({ renewAfterSec: 10 })),
      renew: () => dataResponse(renewal(25)),
    });

    render(<LivePlayer {...props} />);
    await flush();
    expect(bff.of('renew')).toHaveLength(0);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(9_999);
    });
    expect(bff.of('renew')).toHaveLength(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(bff.of('renew')).toHaveLength(1);
    expect(bff.of('renew')[0]?.url).toBe(`/api/v1/playback/sessions/${SESSION_ID}/renew`);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(24_999);
    });
    expect(bff.of('renew')).toHaveLength(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(bff.of('renew')).toHaveLength(2);
    expect(FakeHls.instances[0]?.destroy).not.toHaveBeenCalled();
  });

  it('stops and shows the message of a renewal refusal', async () => {
    const bff = installFetch({
      open: () => dataResponse(ticket()),
      renew: () => errorResponse(403, 'watch.concurrent_limit_reached'),
    });

    render(<LivePlayer {...props} />);
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(screen.getByRole('alert').textContent).toContain('écrans simultanés');
    expect(FakeHls.instances[0]?.destroy).toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(bff.of('renew')).toHaveLength(1);
  });

  it('renews once after an edge 401', async () => {
    const bff = installFetch({
      open: () => dataResponse(ticket()),
      renew: () => dataResponse(renewal(10)),
    });

    render(<LivePlayer {...props} />);
    await flush();
    const hls = FakeHls.instances[0];
    act(() => {
      hls?.emit('hlsError', { fatal: true, type: 'networkError', response: { code: 401 } });
    });
    await flush();

    expect(bff.of('renew')).toHaveLength(1);
    expect(hls?.startLoad).toHaveBeenCalledTimes(1);

    act(() => {
      hls?.emit('hlsError', { fatal: true, type: 'networkError', response: { code: 401 } });
    });
    await flush();
    expect(bff.of('renew')).toHaveLength(1);
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('releases with keepalive on unmount', async () => {
    const bff = installFetch({ open: () => dataResponse(ticket()) });

    const view = render(<LivePlayer {...props} />);
    await flush();
    view.unmount();
    await flush();

    const releases = bff.of('release');
    expect(releases).toHaveLength(1);
    expect(releases[0]?.url).toBe(`/api/v1/playback/sessions/${SESSION_ID}/release`);
    expect(releases[0]?.init).toMatchObject({ keepalive: true, method: 'POST' });
    expect(FakeHls.instances[0]?.destroy).toHaveBeenCalled();
  });

  it('releases once when the page is hidden and then unmounted', async () => {
    const bff = installFetch({ open: () => dataResponse(ticket()) });

    const view = render(<LivePlayer {...props} />);
    await flush();
    window.dispatchEvent(new Event('pagehide'));
    view.unmount();
    await flush();

    expect(bff.of('release')).toHaveLength(1);
  });

  it('a remount waits for the pending release before reopening', async () => {
    let answerRelease: (response: Response) => void = () => undefined;
    let releases = 0;
    const bff = installFetch({
      open: () => dataResponse(ticket()),
      release: () => {
        if (releases++ > 0) return new Response(null, { status: 204 });
        return new Promise<Response>((resolve) => {
          answerRelease = resolve;
        });
      },
    });

    const first = render(<LivePlayer {...props} />);
    await flush();
    expect(bff.of('open')).toHaveLength(1);
    first.unmount();
    await flush();
    expect(bff.of('release')).toHaveLength(1);

    render(<LivePlayer {...props} />);
    await flush();
    expect(bff.of('open')).toHaveLength(1);

    answerRelease(new Response(null, { status: 204 }));
    await flush();
    await flush();
    expect(bff.of('open')).toHaveLength(2);
  });

  it('refuses to play a query-token ticket', async () => {
    installFetch({ open: () => dataResponse(ticket({ edgeRenewalMode: 'query_token' })) });

    render(<LivePlayer {...props} />);
    await flush();

    expect(FakeHls.instances).toHaveLength(0);
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('sends the viewer to sign-in on a 401', async () => {
    installFetch({ open: () => errorResponse(401, 'api.unauthenticated') });

    render(<LivePlayer {...props} />);
    await flush();

    expect(replace).toHaveBeenCalledWith(
      `/sign-in?returnPath=${encodeURIComponent(`/live/${DATE_ID}`)}`,
    );
    expect(FakeHls.instances).toHaveLength(0);
  });
});

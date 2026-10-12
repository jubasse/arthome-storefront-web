import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DATE_ID,
  DEVICE_ID,
  PROFILE_ID,
  dataResponse,
  errorResponse,
  viewerContext,
} from '@/test/bff-double';

import LivePage from './page';

const navigation = vi.hoisted(() => ({
  redirect: vi.fn((target: string) => {
    throw new Error(`redirect:${target}`);
  }),
  notFound: vi.fn(() => {
    throw new Error('not-found');
  }),
}));

vi.mock('next/navigation', () => navigation);
vi.mock('next/headers', () => ({
  cookies: () => Promise.resolve({ toString: () => '__Host-arthome_session=s' }),
}));
vi.mock('./live-player', () => ({ LivePlayer: () => null }));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LivePage', () => {
  it('redirects an anonymous viewer to sign-in with the return path', async () => {
    const fetchDouble = vi.fn(() =>
      Promise.resolve(dataResponse(viewerContext({ signedIn: false, currentProfileId: null }))),
    );
    vi.stubGlobal('fetch', fetchDouble);

    await expect(LivePage({ params: Promise.resolve({ dateId: DATE_ID }) })).rejects.toThrow(
      `redirect:/sign-in?returnPath=${encodeURIComponent(`/live/${DATE_ID}`)}`,
    );
  });

  it('redirects when the BFF refuses the session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(errorResponse(401, 'api.unauthenticated'))),
    );

    await expect(LivePage({ params: Promise.resolve({ dateId: DATE_ID }) })).rejects.toThrow(
      'redirect:/sign-in',
    );
  });

  it('reads the viewer context with the request cookies and no cache', async () => {
    const fetchDouble = vi.fn((..._args: [string, RequestInit]) =>
      Promise.resolve(dataResponse(viewerContext())),
    );
    vi.stubGlobal('fetch', fetchDouble);

    const element = await LivePage({ params: Promise.resolve({ dateId: DATE_ID }) });

    const [url, init] = fetchDouble.mock.calls[0] ?? [];
    expect(url).toMatch(/\/v1\/viewer-context$/);
    expect(init?.cache).toBe('no-store');
    expect(new Headers(init?.headers).get('cookie')).toBe('__Host-arthome_session=s');
    expect(element.props).toMatchObject({
      dateId: DATE_ID,
      deviceId: DEVICE_ID,
      profileId: PROFILE_ID,
    });
  });

  it('answers not found for a malformed date id', async () => {
    vi.stubGlobal('fetch', vi.fn());

    await expect(LivePage({ params: Promise.resolve({ dateId: 'nope' }) })).rejects.toThrow(
      'not-found',
    );
  });
});

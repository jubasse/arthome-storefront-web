import { render } from '@testing-library/react';
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
  headers: () =>
    Promise.resolve(
      new Headers({ 'user-agent': 'Browser/1.0', 'x-forwarded-for': '10.0.0.1, 203.0.113.9' }),
    ),
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

  it('forwards the client descriptor of the request', async () => {
    const fetchDouble = vi.fn((..._args: [string, RequestInit]) =>
      Promise.resolve(dataResponse(viewerContext())),
    );
    vi.stubGlobal('fetch', fetchDouble);

    await LivePage({ params: Promise.resolve({ dateId: DATE_ID }) });

    const headers = new Headers(fetchDouble.mock.calls[0]?.[1].headers);
    expect(headers.get('user-agent')).toBe('Browser/1.0');
    expect(headers.get('x-forwarded-for')).toBe('203.0.113.9');
    expect(headers.get('x-arthome-surface')).toBe('storefront_web');
  });

  it.each([
    ['a BFF error', () => Promise.resolve(errorResponse(500, 'api.service_unavailable'))],
    ['a timeout', () => Promise.reject(new DOMException('timeout', 'TimeoutError'))],
    ['a non-JSON body', () => Promise.resolve(new Response('<html>', { status: 200 }))],
    ['a schema mismatch', () => Promise.resolve(dataResponse({ signedIn: 'yes' }))],
  ])('shows the service message with a retry, no redirect, on %s', async (_name, answer) => {
    vi.stubGlobal('fetch', vi.fn(answer));
    navigation.redirect.mockClear();

    const element = await LivePage({ params: Promise.resolve({ dateId: DATE_ID }) });

    expect(navigation.redirect).not.toHaveBeenCalled();
    const { container } = render(element);
    expect(container.querySelector('[role="alert"]')?.textContent).toContain(
      'momentanément indisponible',
    );
    expect(container.querySelector('a')?.getAttribute('href')).toBe(`/live/${DATE_ID}`);
  });

  it('answers not found for a malformed date id', async () => {
    vi.stubGlobal('fetch', vi.fn());

    await expect(LivePage({ params: Promise.resolve({ dateId: 'nope' }) })).rejects.toThrow(
      'not-found',
    );
  });
});

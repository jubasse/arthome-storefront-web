import { describe, expect, it, vi } from 'vitest';

import { proxyToBff } from './bff-proxy';

const BFF_URL = 'http://bff.test:3003';

function upstreamAnswer(init: ResponseInit = {}, body: string | null = '{}'): Response {
  return new Response(body, init);
}

function setup(answer: Response | (() => Promise<Response>) = upstreamAnswer()) {
  const send = vi.fn<typeof fetch>(() =>
    typeof answer === 'function' ? answer() : Promise.resolve(answer),
  );
  const proxy = (request: Request, segments: string[], extra: { remoteAddress?: string } = {}) =>
    proxyToBff(request, segments, { bffUrl: BFF_URL, fetch: send, ...extra });
  const sentHeaders = () => new Headers(send.mock.calls[0]?.[1]?.headers);
  return { send, proxy, sentHeaders };
}

describe('proxyToBff', () => {
  it('forwards a /v1 path with its query and allowed headers', async () => {
    const { send, proxy, sentHeaders } = setup();
    const request = new Request('http://localhost:3000/api/v1/playback/abc/open?x=1&y=2', {
      method: 'POST',
      body: '{"kind":"live"}',
      headers: {
        cookie: '__Host-arthome_session=s',
        'content-type': 'application/json',
        'x-arthome-surface': 'storefront_web',
        'x-arthome-csrf': 'tok',
        authorization: 'Bearer nope',
        'x-evil': '1',
      },
    });

    await proxy(request, ['v1', 'playback', 'abc', 'open']);

    expect(send.mock.calls[0]?.[0]).toBe(`${BFF_URL}/v1/playback/abc/open?x=1&y=2`);
    expect(send.mock.calls[0]?.[1]?.method).toBe('POST');
    const headers = sentHeaders();
    expect(headers.get('cookie')).toBe('__Host-arthome_session=s');
    expect(headers.get('x-arthome-csrf')).toBe('tok');
    expect(headers.get('x-arthome-surface')).toBe('storefront_web');
    expect(headers.get('authorization')).toBeNull();
    expect(headers.get('x-evil')).toBeNull();
  });

  it.each([
    [['other', 'thing']],
    [[]],
    [['v1', '..', 'admin']],
    [['v1', '.', 'x']],
    [['v1', 'a/b']],
    [['v1', 'a\\b']],
    [['v1', '%2e%2e']],
    [['v1', '']],
  ])('refuses a path outside /v1 and an escape: %j', async (segments) => {
    const { send, proxy } = setup();
    const response = await proxy(new Request('http://localhost:3000/api/x'), segments);
    expect(response.status).toBe(404);
    expect(send).not.toHaveBeenCalled();
  });

  it('keeps every set-cookie of the answer', async () => {
    const upstream = upstreamAnswer();
    upstream.headers.append('set-cookie', '__Host-arthome_session=a; Path=/; HttpOnly');
    upstream.headers.append('set-cookie', '__Host-arthome_csrf=b; Path=/');
    upstream.headers.append('set-cookie', 'arthome_playback=c; Path=/watch/d/; Secure');
    upstream.headers.set('x-trace', 't');
    const { proxy } = setup(upstream);

    const response = await proxy(new Request('http://localhost:3000/api/v1/x'), ['v1', 'x']);

    expect(response.headers.getSetCookie()).toEqual([
      '__Host-arthome_session=a; Path=/; HttpOnly',
      '__Host-arthome_csrf=b; Path=/',
      'arthome_playback=c; Path=/watch/d/; Secure',
    ]);
    expect(response.headers.get('x-trace')).toBe('t');
  });

  it('drops hop-by-hop headers', async () => {
    const upstream = upstreamAnswer({
      headers: { connection: 'keep-alive', 'keep-alive': 'timeout=5', 'x-kept': '1' },
    });
    const { proxy } = setup(upstream);

    const response = await proxy(new Request('http://localhost:3000/api/v1/x'), ['v1', 'x']);

    expect(response.headers.get('connection')).toBeNull();
    expect(response.headers.get('keep-alive')).toBeNull();
    expect(response.headers.get('x-kept')).toBe('1');
  });

  it('answers 504 when the BFF does not answer in time', async () => {
    const send = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            const reason: unknown = init.signal?.reason;
            reject(reason instanceof Error ? reason : new Error('aborted'));
          });
        }),
    );

    const response = await proxyToBff(new Request('http://localhost:3000/api/v1/x'), ['v1', 'x'], {
      bffUrl: BFF_URL,
      fetch: send,
      timeoutMs: 10,
    });

    expect(response.status).toBe(504);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      'api.upstream_timeout',
    );
  });

  it('answers 502 when the BFF cannot be reached', async () => {
    const send = vi.fn<typeof fetch>(() => Promise.reject(new TypeError('fetch failed')));
    const response = await proxyToBff(new Request('http://localhost:3000/api/v1/x'), ['v1', 'x'], {
      bffUrl: BFF_URL,
      fetch: send,
    });
    expect(response.status).toBe(502);
  });

  it('forwards the agent and the client hints', async () => {
    const { proxy, sentHeaders } = setup();
    await proxy(
      new Request('http://localhost:3000/api/v1/auth/sign-in', {
        method: 'POST',
        body: '{}',
        headers: {
          'user-agent': 'Mozilla/5.0 Chrome',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Linux"',
        },
      }),
      ['v1', 'auth', 'sign-in'],
    );
    const headers = sentHeaders();
    expect(headers.get('user-agent')).toBe('Mozilla/5.0 Chrome');
    expect(headers.get('sec-ch-ua-mobile')).toBe('?0');
    expect(headers.get('sec-ch-ua-platform')).toBe('"Linux"');
  });

  it('sets X-Forwarded-For from the socket and drops an incoming one', async () => {
    const { proxy, sentHeaders } = setup();
    await proxy(
      new Request('http://localhost:3000/api/v1/x', {
        headers: { 'x-forwarded-for': '6.6.6.6' },
      }),
      ['v1', 'x'],
      { remoteAddress: '203.0.113.9' },
    );
    expect(sentHeaders().get('x-forwarded-for')).toBe('203.0.113.9');
  });

  it('sends no X-Forwarded-For without a socket address', async () => {
    const { proxy, sentHeaders } = setup();
    await proxy(
      new Request('http://localhost:3000/api/v1/x', {
        headers: { 'x-forwarded-for': '6.6.6.6' },
      }),
      ['v1', 'x'],
    );
    expect(sentHeaders().get('x-forwarded-for')).toBeNull();
  });
});

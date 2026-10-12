import { ApiErrorCode } from '@arthome/core';

export const BFF_TIMEOUT_MS = 3_000;

const FORWARDED_REQUEST_HEADERS = [
  'cookie',
  'content-type',
  'accept',
  'x-arthome-surface',
  'x-arthome-csrf',
  'x-arthome-timezone',
  'idempotency-key',
  'traceparent',
  'if-none-match',
  'user-agent',
  'sec-ch-ua-mobile',
  'sec-ch-ua-platform',
];

const HOP_BY_HOP_RESPONSE_HEADERS = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-length',
  'content-encoding',
];

export interface BffProxyOptions {
  readonly bffUrl: string;
  readonly remoteAddress?: string;
  readonly fetch?: typeof fetch;
  readonly timeoutMs?: number;
}

function isSafeSegment(segment: string): boolean {
  return segment !== '' && segment !== '.' && segment !== '..' && !/[/\\%\p{Cc}]/u.test(segment);
}

function errorResponse(status: number, code: string): Response {
  return Response.json(
    {
      error: { code, params: {}, nature: 'transient', traceId: '' },
      servedAt: new Date().toISOString(),
    },
    { status, headers: { 'cache-control': 'no-store' } },
  );
}

function forwardedHeaders(request: Request, remoteAddress: string | undefined): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  if (remoteAddress !== undefined) headers.set('x-forwarded-for', remoteAddress);
  return headers;
}

function relayedHeaders(upstream: Response): Headers {
  const headers = new Headers();
  upstream.headers.forEach((value, name) => {
    if (name === 'set-cookie' || HOP_BY_HOP_RESPONSE_HEADERS.includes(name)) return;
    headers.set(name, value);
  });
  for (const cookie of upstream.headers.getSetCookie()) headers.append('set-cookie', cookie);
  return headers;
}

export async function proxyToBff(
  request: Request,
  segments: readonly string[],
  options: BffProxyOptions,
): Promise<Response> {
  if (segments[0] !== 'v1' || !segments.every(isSafeSegment)) {
    return new Response(null, { status: 404 });
  }
  const target = `${options.bffUrl.replace(/\/+$/, '')}/${segments.map(encodeURIComponent).join('/')}${new URL(request.url).search}`;
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const send = options.fetch ?? fetch;
  try {
    const upstream = await send(target, {
      method: request.method,
      headers: forwardedHeaders(request, options.remoteAddress),
      redirect: 'manual',
      signal: AbortSignal.timeout(options.timeoutMs ?? BFF_TIMEOUT_MS),
      ...(hasBody && { body: request.body, duplex: 'half' }),
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: relayedHeaders(upstream),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    return timedOut
      ? errorResponse(504, ApiErrorCode.UPSTREAM_TIMEOUT)
      : errorResponse(502, ApiErrorCode.UPSTREAM_UNAVAILABLE);
  }
}

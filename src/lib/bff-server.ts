import { Surface } from '@arthome/core';

const DEFAULT_BFF_URL = 'http://localhost:3003';

export function bffUrl(): string {
  return process.env.BFF_URL ?? DEFAULT_BFF_URL;
}

export function lastForwardedAddress(headers: Pick<Headers, 'get'>): string | undefined {
  const last = headers.get('x-forwarded-for')?.split(',').at(-1)?.trim();
  return last === undefined || last === '' ? undefined : last;
}

export function clientDescriptorHeaders(headers: Pick<Headers, 'get'>): Record<string, string> {
  const userAgent = headers.get('user-agent');
  const remoteAddress = lastForwardedAddress(headers);
  return {
    'x-arthome-surface': Surface.STOREFRONT_WEB,
    ...(userAgent !== null && { 'user-agent': userAgent }),
    ...(remoteAddress !== undefined && { 'x-forwarded-for': remoteAddress }),
  };
}

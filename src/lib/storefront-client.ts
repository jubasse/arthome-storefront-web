import 'client-only';

import { createClient } from '@arthome/contracts/http-client';
import { storefrontApi } from '@arthome/contracts/storefront-api';
import { ApiErrorCode, Surface } from '@arthome/core';

export const SURFACE = Surface.STOREFRONT_WEB;
export const CSRF_COOKIE = '__Host-arthome_csrf';

export interface CallInit {
  readonly keepalive?: boolean;
}

function readCookie(name: string): string | undefined {
  for (const pair of document.cookie.split('; ')) {
    const separator = pair.indexOf('=');
    if (pair.slice(0, separator) === name) return decodeURIComponent(pair.slice(separator + 1));
  }
  return undefined;
}

function sharedHeaders(): Record<string, string> {
  const csrf = readCookie(CSRF_COOKIE);
  return {
    'x-arthome-surface': SURFACE,
    ...(csrf !== undefined && { 'x-arthome-csrf': csrf }),
  };
}

export const storefront = createClient<typeof storefrontApi, CallInit>(storefrontApi, {
  baseUrl: '/api',
  fetch: (url, init) => globalThis.fetch(url, init),
  headers: sharedHeaders,
  validateResponses: true,
});

export const SCHEMA_MISMATCH_CODE = ApiErrorCode.SERVICE_UNAVAILABLE;

export function errorCodeOf(answer: { readonly body: unknown }): string | undefined {
  const body = answer.body as { error?: { code?: unknown } } | null | undefined;
  const code = body?.error?.code;
  return typeof code === 'string' ? code : undefined;
}

export async function guarded<T>(call: () => Promise<T>): Promise<T | 'unreachable'> {
  try {
    return await call();
  } catch (error) {
    console.error('storefront call failed', error instanceof Error ? error.name : 'unknown');
    return 'unreachable';
  }
}

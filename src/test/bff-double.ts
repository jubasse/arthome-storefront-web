import { errorExampleOf } from '@arthome/contracts/http';
import { ChatMode, Locale, MessageDomain, WatchScope } from '@arthome/core';
import type { ErrorCode } from '@arthome/core';

export const DATE_ID = '019928a0-7d31-7a10-b8c4-2f9e11a4c001';
export const DEVICE_ID = '019928f4-1b6c-7c3a-9f2e-6a1d0c4b8e77';
export const PROFILE_ID = '019928f4-1b6c-7c3a-9f2e-6a1d0c4b8e88';
export const SESSION_ID = '019928f7-0000-7000-8000-000000000001';

const SERVED_AT = '2026-10-12T19:00:00.000Z';

export function jsonResponse(status: number, body: unknown, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

export function dataResponse(data: unknown, status = 200): Response {
  return jsonResponse(status, { data, servedAt: SERVED_AT });
}

export function errorResponse(status: number, code: ErrorCode): Response {
  return jsonResponse(status, errorExampleOf(code));
}

export function ticket(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sessionId: SESSION_ID,
    dateId: DATE_ID,
    scope: WatchScope.FULL,
    protocol: 'hls',
    qualityCap: 'fhd',
    manifestUrl: 'http://localhost:58888/watch/abc/master.m3u8',
    signature: { cookieSet: true },
    edgeRenewalMode: 'signed_cookie',
    expiresAt: '2026-10-12T19:07:00.000Z',
    renewAfterSec: 10,
    leaseExpiresAt: '2026-10-12T19:06:30.000Z',
    chatMode: ChatMode.OPEN,
    ...overrides,
  };
}

export function renewal(renewAfterSec: number): Record<string, unknown> {
  return {
    expiresAt: '2026-10-12T19:07:45.000Z',
    renewAfterSec,
    leaseExpiresAt: '2026-10-12T19:07:15.000Z',
    signature: { cookieSet: true },
  };
}

export function requestBody(init: RequestInit | undefined): unknown {
  return JSON.parse(typeof init?.body === 'string' ? init.body : '');
}

export function viewerContext(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    deviceId: DEVICE_ID,
    signedIn: true,
    currentProfileId: PROFILE_ID,
    profiles: [],
    constants: {
      roomOpensMinutesBefore: 30,
      cancelDeadlineMinutesBefore: 60,
      scarcityThresholdBps: 8500,
      billboardPreviewDelaySec: 4,
      waitlistPriorityWindowHours: 2,
      chatRateLimitPerSecond: 6,
      reminderLeadMinutes: 30,
      replayExpiryWarningHours: 6,
    },
    labelCatalog: {
      domain: MessageDomain.STOREFRONT,
      locale: Locale.FR,
      version: 41,
      url: 'https://cdn.arthome.fr/i18n/storefront/fr/v41.json',
    },
    taxonomyArtifact: {
      domain: MessageDomain.TAXONOMY,
      locale: Locale.FR,
      version: 12,
      url: 'https://cdn.arthome.fr/taxonomy/fr/v12.json',
    },
    ...overrides,
  };
}

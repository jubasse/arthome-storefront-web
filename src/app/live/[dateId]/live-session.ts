import Hls from 'hls.js';
import type { ErrorData } from 'hls.js';

import { EdgeRenewalMode } from '@arthome/contracts/streaming';
import { DisplayState } from '@arthome/core';

import { SCHEMA_MISMATCH_CODE, errorCodeOf, guarded, storefront } from '@/lib/storefront-client';

const UNSUPPORTED_RENEWAL_CODE = 'watch.unsupported_renewal';
const UNSUPPORTED_BROWSER_CODE = 'watch.unsupported_browser';

const MIN_RENEWAL_SEC = 1;
const MAX_RENEWAL_SEC = 3_600;
const RENEWAL_RETRY_BASE_MS = 1_000;
const RENEWAL_RETRY_MAX_MS = 15_000;
const TOKEN_EXPIRY_MARGIN_MS = 5_000;
const MEDIA_RECOVERY_WINDOW_MS = 60_000;

type RenewalOutcome = 'renewed' | 'retryable' | 'over';

export interface LiveSessionOptions {
  readonly video: HTMLVideoElement;
  readonly dateId: string;
  readonly deviceId: string;
  readonly profileId: string | null;
  readonly onConnecting?: () => void;
  readonly onPlaying: () => void;
  readonly onRefused: (code: string | undefined) => void;
  readonly onUnauthenticated: () => void;
}

export interface LiveSession {
  stop(): void;
}

let pendingRelease: Promise<void> = Promise.resolve();

function release(sessionId: string, keepalive: boolean): Promise<void> {
  const released = guarded(() =>
    storefront.releasePlayback({
      params: { sessionId },
      ...(keepalive && { init: { keepalive: true } }),
    }),
  ).then(
    () => undefined,
    () => undefined,
  );
  pendingRelease = Promise.all([pendingRelease, released]).then(() => undefined);
  return released;
}

function clampedRenewalSec(afterSec: number): number {
  return Math.min(Math.max(afterSec, MIN_RENEWAL_SEC), MAX_RENEWAL_SEC);
}

function openSession(options: LiveSessionOptions): LiveSession {
  const { video, dateId, deviceId, profileId } = options;
  let stopped = false;
  let released = false;
  let sessionId: string | undefined;
  let renewalTimer: ReturnType<typeof setTimeout> | undefined;
  let hls: Hls | undefined;
  let edgeRenewalSpent = false;
  let tokenExpiresAt = Number.NaN;
  let lastMediaRecoveryAt = Number.NEGATIVE_INFINITY;
  let mediaRecoveries = 0;

  const releaseOnce = (keepalive: boolean): Promise<void> => {
    if (released || sessionId === undefined) return Promise.resolve();
    released = true;
    return release(sessionId, keepalive);
  };

  const onVideoPlaying = (): void => options.onPlaying();

  const teardownPlayback = (): void => {
    clearTimeout(renewalTimer);
    renewalTimer = undefined;
    video.removeEventListener('playing', onVideoPlaying);
    hls?.destroy();
    hls = undefined;
  };

  const refuse = (code: string | undefined): void => {
    teardownPlayback();
    options.onRefused(code);
  };

  const scheduleRenewal = (afterSec: number): void => {
    clearTimeout(renewalTimer);
    renewalTimer = setTimeout(() => void renew(), clampedRenewalSec(afterSec) * 1000);
  };

  const renewOnce = async (): Promise<RenewalOutcome> => {
    const renewing = sessionId;
    if (renewing === undefined) return 'over';
    const answer = await guarded(() =>
      storefront.renewPlaybackTicket({ params: { sessionId: renewing } }),
    );
    if (stopped) return 'over';
    if (answer === 'unreachable') {
      lastRenewalCode = SCHEMA_MISMATCH_CODE;
      return 'retryable';
    }
    if (answer.status === 401) {
      teardownPlayback();
      options.onUnauthenticated();
      return 'over';
    }
    if (answer.status >= 500) {
      lastRenewalCode = errorCodeOf(answer);
      return 'retryable';
    }
    if (answer.status !== 200) {
      refuse(errorCodeOf(answer));
      return 'over';
    }
    tokenExpiresAt = Date.parse(answer.body.data.expiresAt);
    scheduleRenewal(answer.body.data.renewAfterSec);
    return 'renewed';
  };

  let lastRenewalCode: string | undefined;

  // The cookie in hand stays valid until expiresAt: a transient failure is retried until then.
  const renew = async (): Promise<boolean> => {
    for (let attempt = 0; ; attempt += 1) {
      const outcome = await renewOnce();
      if (outcome !== 'retryable') return outcome === 'renewed';
      const delay = Math.min(RENEWAL_RETRY_BASE_MS * 2 ** attempt, RENEWAL_RETRY_MAX_MS);
      if (!(Date.now() + delay < tokenExpiresAt - TOKEN_EXPIRY_MARGIN_MS)) {
        refuse(lastRenewalCode);
        return false;
      }

      await new Promise<void>((resolve) => {
        renewalTimer = setTimeout(resolve, delay);
      });
      if (stopped) return false;
    }
  };

  // hls.js documented sequence: recover, then swap the audio codec and recover, then give up.
  const recoverMedia = (player: Hls): void => {
    const now = Date.now();
    if (now - lastMediaRecoveryAt > MEDIA_RECOVERY_WINDOW_MS) mediaRecoveries = 0;
    lastMediaRecoveryAt = now;
    mediaRecoveries += 1;
    if (mediaRecoveries === 1) return player.recoverMediaError();
    if (mediaRecoveries === 2) {
      player.swapAudioCodec();
      return player.recoverMediaError();
    }
    refuse(undefined);
  };

  const onHlsError = async (data: ErrorData): Promise<void> => {
    if (!data.fatal || hls === undefined) return;
    if (data.type === Hls.ErrorTypes.NETWORK_ERROR && data.response?.code === 401) {
      if (edgeRenewalSpent) return refuse(undefined);
      edgeRenewalSpent = true;
      if (await renew()) hls?.startLoad();
      return;
    }
    if (data.type === Hls.ErrorTypes.MEDIA_ERROR) return recoverMedia(hls);
    refuse(undefined);
  };

  const attach = (manifestUrl: string): void => {
    if (!Hls.isSupported()) return refuse(UNSUPPORTED_BROWSER_CODE);
    const player = new Hls({
      lowLatencyMode: true,
      xhrSetup: (xhr) => {
        // eslint-disable-next-line no-param-reassign -- hls.js hands the request over to be configured
        xhr.withCredentials = true;
      },
    });
    hls = player;
    player.on(Hls.Events.FRAG_LOADED, () => {
      edgeRenewalSpent = false;
    });
    player.on(Hls.Events.ERROR, (_event, data) => void onHlsError(data));
    video.addEventListener('playing', onVideoPlaying);
    player.loadSource(manifestUrl);
    player.attachMedia(video);
  };

  const open = async (): Promise<void> => {
    await pendingRelease;
    if (stopped) return;
    const answer = await guarded(() =>
      storefront.openPlayback({
        params: { dateId },
        body: { deviceId, profileId, kind: DisplayState.LIVE },
      }),
    );
    if (answer !== 'unreachable' && answer.status === 200) {
      sessionId = answer.body.data.sessionId;
    }
    if (stopped) {
      await releaseOnce(false);
      return;
    }
    if (answer === 'unreachable') return refuse(SCHEMA_MISMATCH_CODE);
    if (answer.status === 401) return options.onUnauthenticated();
    if (answer.status !== 200) return refuse(errorCodeOf(answer));
    const ticket = answer.body.data;
    if (ticket.edgeRenewalMode !== EdgeRenewalMode.SIGNED_COOKIE)
      return refuse(UNSUPPORTED_RENEWAL_CODE);
    tokenExpiresAt = Date.parse(ticket.expiresAt);
    attach(ticket.manifestUrl);
    scheduleRenewal(ticket.renewAfterSec);
  };

  const stop = (): void => {
    stopped = true;
    window.removeEventListener('pagehide', onPageHide);
    teardownPlayback();
    if (sessionId === undefined) {
      // The open may still be in flight: a mount that follows waits for it and for its release.
      const previous = pendingRelease;
      pendingRelease = previous.then(() => opening);
    } else {
      void releaseOnce(true);
    }
  };

  function onPageHide(): void {
    stop();
  }

  window.addEventListener('pagehide', onPageHide);
  const opening = open();

  return { stop };
}

export function startLiveSession(options: LiveSessionOptions): LiveSession {
  let current = openSession(options);
  // A back-forward cache restore resumes a page whose lease pagehide released: open a new one.
  const onPageShow = (event: Event): void => {
    if (!(event as PageTransitionEvent).persisted) return;
    current.stop();
    options.onConnecting?.();
    current = openSession(options);
  };
  window.addEventListener('pageshow', onPageShow);
  return {
    stop() {
      window.removeEventListener('pageshow', onPageShow);
      current.stop();
    },
  };
}

import Hls from 'hls.js';
import type { ErrorData } from 'hls.js';

import { EdgeRenewalMode } from '@arthome/contracts/streaming';
import { DisplayState } from '@arthome/core';

import { SCHEMA_MISMATCH_CODE, errorCodeOf, guarded, storefront } from '@/lib/storefront-client';

const UNSUPPORTED_RENEWAL_CODE = 'watch.unsupported_renewal';
const UNSUPPORTED_BROWSER_CODE = 'watch.unsupported_browser';

export interface LiveSessionOptions {
  readonly video: HTMLVideoElement;
  readonly dateId: string;
  readonly deviceId: string;
  readonly profileId: string | null;
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
  pendingRelease = released;
  return released;
}

export function startLiveSession(options: LiveSessionOptions): LiveSession {
  const { video, dateId, deviceId, profileId } = options;
  let stopped = false;
  let released = false;
  let sessionId: string | undefined;
  let renewalTimer: ReturnType<typeof setTimeout> | undefined;
  let hls: Hls | undefined;
  let edgeRenewalSpent = false;

  const releaseOnce = (keepalive: boolean): void => {
    if (released || sessionId === undefined) return;
    released = true;
    void release(sessionId, keepalive);
  };

  const teardownPlayback = (): void => {
    clearTimeout(renewalTimer);
    renewalTimer = undefined;
    hls?.destroy();
    hls = undefined;
  };

  const refuse = (code: string | undefined): void => {
    teardownPlayback();
    options.onRefused(code);
  };

  const scheduleRenewal = (afterSec: number): void => {
    clearTimeout(renewalTimer);
    renewalTimer = setTimeout(() => void renew(), afterSec * 1000);
  };

  const renew = async (): Promise<boolean> => {
    const renewing = sessionId;
    if (renewing === undefined) return false;
    const answer = await guarded(() =>
      storefront.renewPlaybackTicket({ params: { sessionId: renewing } }),
    );
    if (stopped) return false;
    if (answer === 'unreachable') {
      refuse(SCHEMA_MISMATCH_CODE);
      return false;
    }
    if (answer.status === 401) {
      teardownPlayback();
      options.onUnauthenticated();
      return false;
    }
    if (answer.status !== 200) {
      refuse(errorCodeOf(answer));
      return false;
    }
    scheduleRenewal(answer.body.data.renewAfterSec);
    return true;
  };

  const onHlsError = async (data: ErrorData): Promise<void> => {
    if (!data.fatal || hls === undefined) return;
    if (data.type === Hls.ErrorTypes.NETWORK_ERROR && data.response?.code === 401) {
      if (edgeRenewalSpent) return refuse(undefined);
      edgeRenewalSpent = true;
      if (await renew()) hls?.startLoad();
      return;
    }
    if (data.type === Hls.ErrorTypes.MEDIA_ERROR) return hls.recoverMediaError();
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
    player.loadSource(manifestUrl);
    player.attachMedia(video);
    options.onPlaying();
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
      releaseOnce(false);
      return;
    }
    if (answer === 'unreachable') return refuse(SCHEMA_MISMATCH_CODE);
    if (answer.status === 401) return options.onUnauthenticated();
    if (answer.status !== 200) return refuse(errorCodeOf(answer));
    const ticket = answer.body.data;
    if (ticket.edgeRenewalMode !== EdgeRenewalMode.SIGNED_COOKIE)
      return refuse(UNSUPPORTED_RENEWAL_CODE);
    attach(ticket.manifestUrl);
    scheduleRenewal(ticket.renewAfterSec);
  };

  const onPageHide = (): void => releaseOnce(true);
  window.addEventListener('pagehide', onPageHide);
  void open();

  return {
    stop() {
      stopped = true;
      window.removeEventListener('pagehide', onPageHide);
      teardownPlayback();
      releaseOnce(true);
    },
  };
}

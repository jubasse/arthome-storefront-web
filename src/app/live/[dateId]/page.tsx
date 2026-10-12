import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { ViewerContextSchema } from '@arthome/contracts/identity';
import { ApiErrorCode } from '@arthome/core';

import { BFF_TIMEOUT_MS } from '@/lib/bff-proxy';
import { bffUrl, clientDescriptorHeaders } from '@/lib/bff-server';
import { refusalMessage } from '@/lib/refusal-messages';

import { LivePlayer } from './live-player';

const ViewerIdentitySchema = ViewerContextSchema.pick({
  deviceId: true,
  signedIn: true,
  currentProfileId: true,
});

type ViewerIdentity = ReturnType<typeof ViewerIdentitySchema.parse>;

type ViewerRead =
  | { readonly status: 'signed-in'; readonly viewer: ViewerIdentity }
  | { readonly status: 'signed-out' }
  | { readonly status: 'broken' };

const FAILED: ViewerRead = { status: 'broken' };
const UNAUTHENTICATED_STATUS = 401;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface LivePageProps {
  readonly params: Promise<{ readonly dateId: string }>;
}

async function readViewerContext(
  cookieHeader: string,
  descriptor: Record<string, string>,
): Promise<ViewerRead> {
  try {
    const response = await fetch(`${bffUrl()}/v1/viewer-context`, {
      cache: 'no-store',
      headers: { ...descriptor, cookie: cookieHeader },
      signal: AbortSignal.timeout(BFF_TIMEOUT_MS),
    });
    if (response.status === UNAUTHENTICATED_STATUS) return { status: 'signed-out' };
    if (!response.ok) return FAILED;
    const parsed = ViewerIdentitySchema.safeParse(
      ((await response.json()) as { data?: unknown }).data,
    );
    if (!parsed.success) return FAILED;
    return parsed.data.signedIn
      ? { status: 'signed-in', viewer: parsed.data }
      : { status: 'signed-out' };
  } catch {
    return FAILED;
  }
}

export default async function LivePage({ params }: LivePageProps) {
  const { dateId } = await params;
  if (!UUID.test(dateId)) notFound();

  const [jar, requestHeaders] = await Promise.all([cookies(), headers()]);
  const read = await readViewerContext(jar.toString(), clientDescriptorHeaders(requestHeaders));
  if (read.status === 'signed-out') {
    redirect(`/sign-in?returnPath=${encodeURIComponent(`/live/${dateId}`)}`);
  }
  if (read.status === 'broken') {
    return (
      <main>
        <p role="alert">{refusalMessage(ApiErrorCode.SERVICE_UNAVAILABLE)}</p>
        <a href={`/live/${dateId}`}>Réessayer</a>
      </main>
    );
  }

  return (
    <LivePlayer
      key={dateId}
      dateId={dateId}
      deviceId={read.viewer.deviceId}
      profileId={read.viewer.currentProfileId ?? null}
    />
  );
}

import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

import { ViewerContextSchema } from '@arthome/contracts/identity';

import { SURFACE } from '@/lib/storefront-client';

import { LivePlayer } from './live-player';

const ViewerIdentitySchema = ViewerContextSchema.pick({
  deviceId: true,
  signedIn: true,
  currentProfileId: true,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface LivePageProps {
  readonly params: Promise<{ readonly dateId: string }>;
}

async function readViewerContext(cookieHeader: string) {
  const bffUrl = process.env.BFF_URL ?? 'http://localhost:3003';
  const response = await fetch(`${bffUrl}/v1/viewer-context`, {
    cache: 'no-store',
    headers: { cookie: cookieHeader, 'x-arthome-surface': SURFACE },
    signal: AbortSignal.timeout(3_000),
  }).catch(() => undefined);
  if (response?.ok !== true) return undefined;
  const parsed = ViewerIdentitySchema.safeParse(
    ((await response.json()) as { data?: unknown }).data,
  );
  return parsed.success ? parsed.data : undefined;
}

export default async function LivePage({ params }: LivePageProps) {
  const { dateId } = await params;
  if (!UUID.test(dateId)) notFound();

  const jar = await cookies();
  const viewer = await readViewerContext(jar.toString());
  if (viewer?.signedIn !== true) {
    redirect(`/sign-in?returnPath=${encodeURIComponent(`/live/${dateId}`)}`);
  }

  return (
    <LivePlayer
      key={dateId}
      dateId={dateId}
      deviceId={viewer.deviceId}
      profileId={viewer.currentProfileId ?? null}
    />
  );
}

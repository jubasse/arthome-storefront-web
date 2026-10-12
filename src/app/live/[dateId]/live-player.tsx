'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { refusalMessage } from '@/lib/refusal-messages';

import { startLiveSession } from './live-session';

interface LivePlayerProps {
  readonly dateId: string;
  readonly deviceId: string;
  readonly profileId: string | null;
}

type PlayerState =
  | { readonly phase: 'connecting' }
  | { readonly phase: 'playing' }
  | { readonly phase: 'stopped'; readonly message: string };

export function LivePlayer({ dateId, deviceId, profileId }: LivePlayerProps) {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [state, setState] = useState<PlayerState>({ phase: 'connecting' });

  useEffect(() => {
    const video = videoRef.current;
    if (video === null) return;
    const session = startLiveSession({
      video,
      dateId,
      deviceId,
      profileId,
      onPlaying: () => setState({ phase: 'playing' }),
      onRefused: (code) => setState({ phase: 'stopped', message: refusalMessage(code) }),
      onUnauthenticated: () =>
        router.replace(`/sign-in?returnPath=${encodeURIComponent(`/live/${dateId}`)}`),
    });
    return () => session.stop();
  }, [dateId, deviceId, profileId, router]);

  return (
    <main>
      <video ref={videoRef} controls autoPlay playsInline crossOrigin="use-credentials" />
      {state.phase === 'connecting' && <p>Connexion au direct...</p>}
      {state.phase === 'stopped' && <p role="alert">{state.message}</p>}
    </main>
  );
}

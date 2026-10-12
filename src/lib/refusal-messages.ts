import { ApiErrorCode, IdentityErrorCode, WatchDenialReason } from '@arthome/core';

const GENERIC = 'Une erreur est survenue. Réessayez dans un instant.';
const WATCH_GENERIC = "Cette diffusion n'est pas disponible.";

const MESSAGES: Readonly<Record<string, string>> = {
  [IdentityErrorCode.INVALID_CREDENTIALS]: 'Email ou mot de passe incorrect.',
  [ApiErrorCode.RATE_LIMITED]: 'Trop de tentatives. Patientez un moment avant de réessayer.',
  [ApiErrorCode.SERVICE_UNAVAILABLE]:
    'Le service est momentanément indisponible. Réessayez dans un instant.',
  [WatchDenialReason.SEAT_EXPIRED]: 'Votre place pour cette date a expiré.',
  [WatchDenialReason.CONCURRENT_LIMIT_REACHED]:
    "Le nombre d'écrans simultanés de votre compte est atteint. Cette lecture a été arrêtée.",
  [IdentityErrorCode.SIGNED_OUT_ELSEWHERE]: 'Vous avez été déconnecté depuis un autre appareil.',
  [WatchDenialReason.DATE_INTERRUPTED]: 'La diffusion est momentanément interrompue.',
  [WatchDenialReason.LIVE_ENDED]: 'Le direct est terminé.',
};

export function refusalMessage(code: string | undefined): string {
  if (code === undefined) return GENERIC;
  const known = MESSAGES[code];
  if (known !== undefined) return known;
  return code.startsWith('watch.') ? WATCH_GENERIC : GENERIC;
}

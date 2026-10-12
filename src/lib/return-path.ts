export function safeReturnPath(raw: string | null | undefined): string {
  if (raw === null || raw === undefined) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  if (/\p{Cc}/u.test(raw)) return '/';
  return raw;
}

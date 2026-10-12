import { proxyToBff } from '@/lib/bff-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  readonly params: Promise<{ readonly path: string[] }>;
}

function lastForwardedAddress(request: Request): string | undefined {
  const last = request.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim();
  return last === undefined || last === '' ? undefined : last;
}

async function handle(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  const remoteAddress = lastForwardedAddress(request);
  return proxyToBff(request, path, {
    bffUrl: process.env.BFF_URL ?? 'http://localhost:3003',
    ...(remoteAddress !== undefined && { remoteAddress }),
  });
}

export { handle as GET, handle as POST, handle as DELETE };

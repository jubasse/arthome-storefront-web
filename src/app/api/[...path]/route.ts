import { proxyToBff } from '@/lib/bff-proxy';
import { bffUrl, lastForwardedAddress } from '@/lib/bff-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteContext {
  readonly params: Promise<{ readonly path: string[] }>;
}

async function handle(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  const remoteAddress = lastForwardedAddress(request.headers);
  return proxyToBff(request, path, {
    bffUrl: bffUrl(),
    ...(remoteAddress !== undefined && { remoteAddress }),
  });
}

export { handle as GET, handle as POST, handle as DELETE };

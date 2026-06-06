import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_COOKIE } from '@/lib/admin/constants';

function isSameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === req.nextUrl.host;
  } catch {
    return false;
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === '/admin') {
    const res = NextResponse.next();
    res.headers.set('Cache-Control', 'no-store');
    return res;
  }

  if (pathname.startsWith('/api/admin') && !pathname.startsWith('/api/admin/login')) {
    if (!req.cookies.get(ADMIN_COOKIE)?.value) {
      return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
    }

    if (req.method !== 'GET' && !isSameOrigin(req)) {
      return NextResponse.json({ ok: false, reason: 'bad_origin' }, { status: 403 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin', '/api/admin/:path*'],
};

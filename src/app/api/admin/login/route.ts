import { NextResponse } from 'next/server';
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  adminRateLimitKey,
  checkAdminLoginRateLimit,
  clearAdminLoginRateLimit,
  supabaseServer,
} from '@/lib/admin/server';

export const runtime = 'nodejs';

function sameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === new URL(req.url).host;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!sameOrigin(req)) {
    return NextResponse.json({ ok: false, reason: 'bad_origin' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? '').trim();
  const password = String(body?.password ?? '');
  const rateKey = adminRateLimitKey(req, email);
  const rate = checkAdminLoginRateLimit(rateKey);
  if (!rate.ok) {
    return NextResponse.json(
      { ok: false, reason: 'rate_limited', retryAfter: rate.retryAfter },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfter) } },
    );
  }

  const sb = supabaseServer();
  if (!sb) return NextResponse.json({ ok: false, reason: 'cloud' }, { status: 503 });

  const { data, error } = await sb.rpc('kcq_admin_login', { p_email: email, p_password: password });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data?.ok) return NextResponse.json({ ok: false }, { status: 401 });

  clearAdminLoginRateLimit(rateKey);
  const res = NextResponse.json({ ok: true, admin: data.admin });
  res.cookies.set(ADMIN_COOKIE, data.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ADMIN_SESSION_MAX_AGE,
  });
  return res;
}

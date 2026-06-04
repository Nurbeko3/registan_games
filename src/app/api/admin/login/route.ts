import { NextResponse } from 'next/server';
import { supabaseServer, ADMIN_COOKIE } from '@/lib/admin/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? '').trim();
  const password = String(body?.password ?? '');

  const sb = supabaseServer();
  if (!sb) return NextResponse.json({ ok: false, reason: 'cloud' }, { status: 503 });

  const { data, error } = await sb.rpc('kcq_admin_login', { p_email: email, p_password: password });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data?.ok) return NextResponse.json({ ok: false }, { status: 401 });

  const res = NextResponse.json({ ok: true, admin: data.admin });
  res.cookies.set(ADMIN_COOKIE, data.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
  return res;
}

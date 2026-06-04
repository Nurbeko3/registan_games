import { NextResponse } from 'next/server';
import { adminToken, supabaseServer, ADMIN_COOKIE } from '@/lib/admin/server';

export const runtime = 'nodejs';

export async function POST() {
  const token = await adminToken();
  if (token) {
    const sb = supabaseServer();
    try { if (sb) await sb.rpc('kcq_admin_logout', { p_token: token }); } catch {}
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}

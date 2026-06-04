import { NextResponse } from 'next/server';
import { requireAdmin, generatePassword } from '@/lib/admin/server';

export const runtime = 'nodejs';

/** POST → reset a student's password to a fresh auto-generated one. */
export async function POST(req: Request) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const username = String(body?.username ?? '').trim();
  if (!username) return NextResponse.json({ ok: false }, { status: 400 });

  const password = generatePassword();
  const { data, error } = await ctx.sb.rpc('kcq_admin_reset_student', {
    p_token: ctx.token, p_username: username, p_password: password,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data?.ok) return NextResponse.json({ ok: false, reason: data?.reason }, { status: 404 });
  return NextResponse.json({ ok: true, username: data.username, password: data.password });
}

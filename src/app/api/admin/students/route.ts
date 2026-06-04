import { NextResponse } from 'next/server';
import { requireAdmin, generatePassword } from '@/lib/admin/server';

export const runtime = 'nodejs';

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,20}$/;

/** GET → list all student accounts. */
export async function GET() {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });

  const { data, error } = await ctx.sb.rpc('kcq_admin_list_students', { p_token: ctx.token });
  if (error || !data?.ok) {
    return NextResponse.json({ ok: false, error: error?.message ?? data?.reason ?? 'failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, users: data.users ?? [] });
}

/** POST → create a student account (auto-generates a password if none given). */
export async function POST(req: Request) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const username = String(body?.username ?? '').trim();
  const displayName = String(body?.displayName ?? '').trim();
  const password = String(body?.password ?? '').trim() || generatePassword();

  if (!USERNAME_RE.test(username)) {
    return NextResponse.json({ ok: false, reason: 'username' }, { status: 400 });
  }
  const { data, error } = await ctx.sb.rpc('kcq_admin_create_student', {
    p_token: ctx.token, p_username: username, p_password: password, p_display_name: displayName,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data?.ok) {
    return NextResponse.json({ ok: false, reason: data?.reason }, { status: data?.reason === 'taken' ? 409 : 400 });
  }
  return NextResponse.json({ ok: true, username: data.username, password: data.password });
}

/** DELETE → remove a student account. */
export async function DELETE(req: Request) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const username = String(body?.username ?? '').trim();
  if (!username) return NextResponse.json({ ok: false }, { status: 400 });

  const { data, error } = await ctx.sb.rpc('kcq_admin_delete_student', { p_token: ctx.token, p_username: username });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: !!data?.ok });
}

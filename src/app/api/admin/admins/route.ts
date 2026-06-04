import { NextResponse } from 'next/server';
import { requireAdmin, generatePassword } from '@/lib/admin/server';

export const runtime = 'nodejs';

/** GET → list admins (super only). */
export async function GET() {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
  if (ctx.admin.role !== 'super') return NextResponse.json({ ok: false, reason: 'forbidden' }, { status: 403 });

  const { data, error } = await ctx.sb.rpc('kcq_admin_list_admins', { p_token: ctx.token });
  if (error || !data?.ok) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true, admins: data.admins ?? [] });
}

/** POST → create an admin (super only). Auto-generates a password if none given. */
export async function POST(req: Request) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
  if (ctx.admin.role !== 'super') return NextResponse.json({ ok: false, reason: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? '').trim();
  const name = String(body?.name ?? '').trim();
  const role = body?.role === 'super' ? 'super' : 'admin';
  const password = String(body?.password ?? '').trim() || generatePassword();

  if (!email.includes('@')) return NextResponse.json({ ok: false, reason: 'email' }, { status: 400 });

  const { data, error } = await ctx.sb.rpc('kcq_admin_create_admin', {
    p_token: ctx.token, p_email: email, p_password: password, p_name: name, p_role: role,
  });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data?.ok) return NextResponse.json({ ok: false, reason: data?.reason }, { status: data?.reason === 'taken' ? 409 : 400 });
  return NextResponse.json({ ok: true, email: data.email, password: data.password, role: data.role });
}

/** DELETE → remove an admin (super only). */
export async function DELETE(req: Request) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });
  if (ctx.admin.role !== 'super') return NextResponse.json({ ok: false, reason: 'forbidden' }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const email = String(body?.email ?? '').trim();
  if (!email) return NextResponse.json({ ok: false }, { status: 400 });

  const { data, error } = await ctx.sb.rpc('kcq_admin_delete_admin', { p_token: ctx.token, p_email: email });
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!data?.ok) return NextResponse.json({ ok: false, reason: data?.reason }, { status: 400 });
  return NextResponse.json({ ok: true });
}

import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/server';

export const runtime = 'nodejs';

/** DELETE /api/admin/arena-questions/:id → remove one question. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });

  const { id } = await params;
  const { data, error } = await ctx.sb.rpc('kcq_admin_arena_q_delete', { p_token: ctx.token, p_id: id });
  if (error || !data?.ok) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true });
}

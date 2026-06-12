import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/server';
import { normalizeImported, type ImportedQuestion } from '@/lib/arena/questionImport';

export const runtime = 'nodejs';

/** GET → all arena questions (incl. inactive) for the management table. */
export async function GET() {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });

  const { data, error } = await ctx.sb.rpc('kcq_admin_arena_q_list', { p_token: ctx.token });
  if (error || !data?.ok) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true, questions: data.questions ?? [] });
}

/** POST { rows: ImportedQuestion[] } → bulk upsert (from the parsed Excel). */
export async function POST(req: Request) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const rows: ImportedQuestion[] = Array.isArray(body?.rows) ? body.rows : [];
  if (rows.length === 0) return NextResponse.json({ ok: false, reason: 'empty' }, { status: 400 });
  if (rows.length > 1000) return NextResponse.json({ ok: false, reason: 'too-many' }, { status: 400 });

  // Defensive re-normalize so no locale ships blank even if the client skipped it.
  const clean = rows.map(normalizeImported);

  const { data, error } = await ctx.sb.rpc('kcq_admin_arena_q_import', {
    p_token: ctx.token,
    p_rows: clean,
  });
  if (error || !data?.ok) {
    return NextResponse.json({ ok: false, reason: error?.message ?? data?.error ?? 'failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, count: data.count ?? clean.length });
}

/** DELETE → clear the entire imported bank. */
export async function DELETE() {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });

  const { data, error } = await ctx.sb.rpc('kcq_admin_arena_q_clear', { p_token: ctx.token });
  if (error || !data?.ok) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true });
}

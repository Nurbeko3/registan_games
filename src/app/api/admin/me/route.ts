import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin/server';

export const runtime = 'nodejs';

export async function GET() {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ ok: false });
  return NextResponse.json({ ok: true, admin: ctx.admin });
}

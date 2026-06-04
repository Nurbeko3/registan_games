import { NextResponse } from 'next/server';
import { requireAdmin, generatePassword, slugUsername } from '@/lib/admin/server';

export const runtime = 'nodejs';

interface InRow { name?: string; username?: string; password?: string }
interface OutRow { name: string; username: string; password: string; ok: boolean; reason?: string }

const USERNAME_RE = /^[a-zA-Z0-9._-]{3,20}$/;

/** POST { rows: [{name, username?, password?}] } → create each, return creds. */
export async function POST(req: Request) {
  const ctx = await requireAdmin();
  if (!ctx) return NextResponse.json({ ok: false }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const rows: InRow[] = Array.isArray(body?.rows) ? body.rows : [];
  if (rows.length === 0) return NextResponse.json({ ok: false, reason: 'empty' }, { status: 400 });
  if (rows.length > 500) return NextResponse.json({ ok: false, reason: 'too-many' }, { status: 400 });

  const used = new Set<string>();
  const results: OutRow[] = [];

  for (const r of rows) {
    const name = String(r.name ?? '').trim();
    let base = String(r.username ?? '').trim() || slugUsername(name);
    if (base.length < 3) base = `${base}user`.slice(0, 20);
    const password = String(r.password ?? '').trim() || generatePassword();

    if (!name && !r.username) continue; // skip blank lines

    // find a free username (handles duplicates within the batch / DB)
    let username = base;
    let attempt = 0;
    let res: OutRow | null = null;
    while (attempt < 6) {
      if (!USERNAME_RE.test(username) || used.has(username.toLowerCase())) {
        username = `${base}${Math.floor(10 + Math.random() * 89)}`.slice(0, 20);
        attempt++;
        continue;
      }
      const { data, error } = await ctx.sb.rpc('kcq_admin_create_student', {
        p_token: ctx.token, p_username: username, p_password: password, p_display_name: name,
      });
      if (error) { res = { name, username, password, ok: false, reason: 'error' }; break; }
      if (data?.ok) {
        used.add(username.toLowerCase());
        res = { name, username, password, ok: true };
        break;
      }
      if (data?.reason === 'taken') { username = `${base}${Math.floor(10 + Math.random() * 89)}`.slice(0, 20); attempt++; continue; }
      res = { name, username, password, ok: false, reason: data?.reason ?? 'failed' };
      break;
    }
    results.push(res ?? { name, username, password, ok: false, reason: 'retries' });
  }

  const created = results.filter((r) => r.ok).length;
  return NextResponse.json({ ok: true, created, total: results.length, results });
}

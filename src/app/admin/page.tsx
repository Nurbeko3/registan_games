'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface AdminInfo { id: string; email: string; name: string; role: 'super' | 'admin' }
interface Student { id: string; username: string; display_name: string; xp: number; coins: number; total_stars: number; created_at: string }
interface AdminRow { id: string; email: string; name: string; role: 'super' | 'admin'; created_at: string; is_self: boolean }
interface ImportRow { name: string; username: string; password: string; ok: boolean; reason?: string }

function genPassword(): string {
  const a = ['Robo', 'Star', 'Pixel', 'Byte', 'Nova', 'Turbo', 'Cyber', 'Mega', 'Hyper', 'Laser'];
  const b = ['Fox', 'Tiger', 'Whale', 'Dragon', 'Falcon', 'Wolf', 'Panda', 'Shark', 'Lion', 'Hawk'];
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  return `${pick(a)}-${pick(b)}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export default function AdminPage() {
  const [admin, setAdmin] = useState<AdminInfo | null | undefined>(undefined);

  const refresh = useCallback(() => {
    fetch('/api/admin/me').then((r) => r.json()).then((d) => setAdmin(d.ok ? d.admin : null)).catch(() => setAdmin(null));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);

  if (admin === undefined) {
    return <div className="grid min-h-screen place-items-center bg-ink"><div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-white" /></div>;
  }
  return admin ? <Panel admin={admin} onLogout={() => setAdmin(null)} /> : <Login onIn={refresh} />;
}

// ── login ────────────────────────────────────────────────────────────
function Login({ onIn }: { onIn: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setErr(null); setBusy(true);
    const r = await fetch('/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    setBusy(false);
    if (r.ok) onIn();
    else if (r.status === 503) setErr('Supabase ulanmagan yoki migratsiya qo‘llanmagan.');
    else setErr('Email yoki parol noto‘g‘ri.');
  };

  return (
    <div className="grid min-h-screen place-items-center bg-gradient-to-br from-ink to-grape-600 p-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-toy">
        <div className="text-center">
          <div className="text-4xl">🛡️</div>
          <h1 className="mt-2 font-display text-2xl font-extrabold">Admin panel</h1>
          <p className="text-sm text-ink-soft">KidsCode Quest — admin kirishi</p>
        </div>
        <div className="mt-5 space-y-3">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoCapitalize="none"
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            className="w-full rounded-2xl border-2 border-grape-100 px-4 py-2.5 font-bold outline-none focus:border-grape" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Parol" type="password"
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            className="w-full rounded-2xl border-2 border-grape-100 px-4 py-2.5 font-bold outline-none focus:border-grape" />
          {err && <p className="text-center text-sm font-bold text-bubble-600">{err}</p>}
          <button onClick={submit} disabled={busy} className="btn-primary w-full text-lg disabled:opacity-60">
            {busy ? 'Tekshirilmoqda…' : 'Kirish'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── panel ────────────────────────────────────────────────────────────
function Panel({ admin, onLogout }: { admin: AdminInfo; onLogout: () => void }) {
  const [tab, setTab] = useState<'students' | 'admins'>('students');
  const logout = async () => { await fetch('/api/admin/logout', { method: 'POST' }); onLogout(); };

  return (
    <div className="min-h-screen bg-cloud">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-grape-100 bg-white px-4 py-3">
        <div className="flex items-center gap-2 font-display font-extrabold">
          🛡️ Admin
          <span className={`chip text-xs ${admin.role === 'super' ? 'bg-sun/40 text-mango-600' : 'bg-grape-50 text-grape'}`}>
            {admin.role === 'super' ? '⭐ Super admin' : 'Admin'}
          </span>
          <span className="hidden text-sm font-bold text-ink-faint sm:inline">{admin.email}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/cases" className="btn-sun px-3 py-1.5 text-sm">
            🕵️ Sinf turniri
          </Link>
          <button onClick={logout} className="btn-ghost px-3 py-1.5 text-sm">Chiqish</button>
        </div>
      </header>

      {admin.role === 'super' && (
        <div className="mx-auto flex max-w-3xl gap-2 px-4 pt-4">
          <TabBtn active={tab === 'students'} onClick={() => setTab('students')}>👥 O‘quvchilar</TabBtn>
          <TabBtn active={tab === 'admins'} onClick={() => setTab('admins')}>🛡️ Adminlar</TabBtn>
        </div>
      )}

      <main className="mx-auto max-w-3xl px-4 py-6">
        {tab === 'students' ? <Students /> : <Admins />}
      </main>
    </div>
  );
}

function TabBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`rounded-full px-4 py-2 text-sm font-extrabold shadow-card transition ${active ? 'bg-grape text-white' : 'bg-white text-ink-faint'}`}>
      {children}
    </button>
  );
}

function Row({ label, value, onCopy, copied }: { label: string; value: string; onCopy: (t: string) => void; copied: string | null }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-ink-faint">{label}:</span>
      <code className="flex-1 break-all font-extrabold">{value}</code>
      <button onClick={() => onCopy(value)} className="btn-ghost px-2 py-0.5 text-xs">{copied === value ? '✓' : 'nusxa'}</button>
    </div>
  );
}

const useCopy = () => {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (t: string) => { try { navigator.clipboard?.writeText(t); setCopied(t); setTimeout(() => setCopied(null), 1500); } catch {} };
  return { copied, copy };
};

// ── students ─────────────────────────────────────────────────────────
function Students() {
  const { copied, copy } = useCopy();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState(genPassword());
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetInfo, setResetInfo] = useState<{ username: string; password: string } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importRes, setImportRes] = useState<ImportRow[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/admin/students');
    const d = await r.json().catch(() => ({}));
    setStudents(d.ok ? d.users : []);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20); if (slug) setUsername(slug); }, [name]);

  const create = async () => {
    setError(null); setCreated(null); setCreating(true);
    const r = await fetch('/api/admin/students', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, displayName: name, password }) });
    const d = await r.json().catch(() => ({}));
    setCreating(false);
    if (!d.ok) { setError(d.reason === 'taken' ? 'Bu login band.' : d.reason === 'username' ? 'Login 3–20 ta belgi (harf/raqam) bo‘lsin.' : 'Xatolik. Qayta urinib ko‘ring.'); return; }
    setCreated({ username: d.username, password: d.password });
    setName(''); setUsername(''); setPassword(genPassword());
    void load();
  };

  const reset = async (u: string) => {
    setResetInfo(null);
    const r = await fetch('/api/admin/students/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u }) });
    const d = await r.json().catch(() => ({}));
    if (d.ok) setResetInfo({ username: d.username, password: d.password });
  };

  const del = async (u: string) => {
    if (!confirm(`"${u}" o‘chirilsinmi?`)) return;
    await fetch('/api/admin/students', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u }) });
    void load();
  };

  const downloadTemplate = async () => {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([
      ['Ism', 'Login (ixtiyoriy)', 'Parol (ixtiyoriy)'],
      ['Aziz Karimov', 'aziz', ''],
      ['Laylo Tosheva', '', ''],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Namuna');
    XLSX.writeFile(wb, 'kcq-namuna.xlsx');
  };

  const onFile = async (file: File) => {
    setImporting(true); setImportRes(null); setError(null);
    try {
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Record<string, unknown>[];
      const rows = json.map((o) => {
        const low: Record<string, string> = {};
        for (const k of Object.keys(o)) low[k.trim().toLowerCase()] = String(o[k] ?? '').trim();
        const vals = Object.values(low);
        const name = low['ism'] || low['name'] || low['fio'] || low['f.i.o'] || low["o'quvchi"] || vals[0] || '';
        const username = low['login'] || low['username'] || '';
        const password = low['parol'] || low['password'] || '';
        return { name, username, password };
      }).filter((r) => r.name || r.username);

      if (rows.length === 0) { setError('Faylda ma’lumot topilmadi. Namunadan foydalaning.'); setImporting(false); return; }

      const r = await fetch('/api/admin/students/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }) });
      const d = await r.json().catch(() => ({}));
      setImporting(false);
      if (!d.ok) { setError('Import xatosi.'); return; }
      setImportRes(d.results as ImportRow[]);
      void load();
    } catch {
      setImporting(false); setError('Faylni o‘qib bo‘lmadi.');
    }
  };

  const downloadResults = async () => {
    if (!importRes) return;
    const XLSX = await import('xlsx');
    const aoa = [['Ism', 'Login', 'Parol', 'Holat'], ...importRes.map((r) => [r.name, r.username, r.password, r.ok ? 'OK' : (r.reason ?? 'xato')])];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Natija');
    XLSX.writeFile(wb, 'kcq-oquvchilar.xlsx');
  };

  return (
    <>
      <section className="card">
        <h2 className="font-display text-xl font-extrabold">➕ Yangi o‘quvchi</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-ink-soft">Ism</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Aziz Karimov" maxLength={30}
              className="w-full rounded-2xl border-2 border-grape-100 bg-white px-4 py-2.5 font-bold outline-none focus:border-grape" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-ink-soft">Login</span>
            <input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="aziz" autoCapitalize="none" maxLength={20}
              className="w-full rounded-2xl border-2 border-grape-100 bg-white px-4 py-2.5 font-mono font-bold outline-none focus:border-grape" />
          </label>
        </div>
        <div className="mt-3">
          <span className="mb-1 block text-sm font-bold text-ink-soft">Parol</span>
          <div className="flex gap-2">
            <input value={password} onChange={(e) => setPassword(e.target.value)}
              className="flex-1 rounded-2xl border-2 border-grape-100 bg-white px-4 py-2.5 font-mono font-extrabold outline-none focus:border-grape" />
            <button onClick={() => setPassword(genPassword())} className="btn-ghost px-4" title="Yangi parol">↻</button>
          </div>
        </div>
        {error && <p className="mt-3 text-sm font-bold text-bubble-600">{error}</p>}
        <button onClick={create} disabled={creating || !username} className="btn-primary mt-4 w-full text-lg disabled:opacity-50">
          {creating ? 'Yaratilmoqda…' : '✨ Akkaunt yaratish'}
        </button>
        <AnimatePresence>
          {created && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 rounded-2xl bg-mint/15 p-4">
              <p className="font-display font-extrabold text-mint-600">✅ Yaratildi!</p>
              <div className="mt-2 grid gap-1 font-mono text-sm">
                <Row label="Login" value={created.username} onCopy={copy} copied={copied} />
                <Row label="Parol" value={created.password} onCopy={copy} copied={copied} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Excel import */}
      <section className="card mt-4">
        <h2 className="font-display text-xl font-extrabold">📄 Excel orqali ko‘plab qo‘shish</h2>
        <p className="mt-1 text-sm text-ink-soft">Namunani yuklab oling, to‘ldiring, keyin import qiling. Parol bo‘sh bo‘lsa — avtomatik yaratiladi.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={downloadTemplate} className="btn-ghost">⬇️ Namuna (Excel)</button>
          <button onClick={() => fileRef.current?.click()} disabled={importing} className="btn-primary disabled:opacity-60">
            {importing ? 'Import qilinmoqda…' : '📤 Excel import'}
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ''; }} />
        </div>
        <AnimatePresence>
          {importRes && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4">
              <div className="flex items-center justify-between">
                <p className="font-bold text-mint-600">✅ {importRes.filter((r) => r.ok).length}/{importRes.length} ta qo‘shildi</p>
                <button onClick={downloadResults} className="btn-sun px-3 py-1.5 text-sm">⬇️ Natijani yuklab olish</button>
              </div>
              <div className="mt-2 max-h-56 overflow-auto rounded-2xl bg-cloud p-2 text-xs">
                <table className="w-full text-left">
                  <thead className="text-ink-faint"><tr><th className="py-1">Ism</th><th>Login</th><th>Parol</th><th></th></tr></thead>
                  <tbody>
                    {importRes.map((r, i) => (
                      <tr key={i} className="border-t border-grape-100">
                        <td className="py-1">{r.name || '—'}</td>
                        <td className="font-mono font-bold">{r.username}</td>
                        <td className="font-mono">{r.ok ? r.password : '—'}</td>
                        <td>{r.ok ? '✅' : `❌ ${r.reason ?? ''}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-1 text-[11px] text-ink-faint">Parollar faqat hozir ko‘rinadi — natijani Excel’da saqlang.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <AnimatePresence>
        {resetInfo && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="card mt-4 bg-sun/15">
            <p className="font-display font-extrabold">🔑 Yangi parol — <b>{resetInfo.username}</b></p>
            <div className="mt-2 font-mono text-sm"><Row label="Parol" value={resetInfo.password} onCopy={copy} copied={copied} /></div>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="card mt-6">
        <h2 className="font-display text-xl font-extrabold">👥 O‘quvchilar ({students.length})</h2>
        {loading ? (
          <div className="grid place-items-center py-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-grape-100 border-t-grape" /></div>
        ) : students.length === 0 ? (
          <p className="py-6 text-center text-ink-soft">Hali o‘quvchi yo‘q.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs font-bold uppercase text-ink-faint"><tr><th className="py-2">Login</th><th>Ism</th><th>XP</th><th>⭐</th><th></th></tr></thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id} className="border-t border-grape-100">
                    <td className="py-2.5 font-mono font-bold">{s.username}</td>
                    <td className="text-ink-soft">{s.display_name || '—'}</td>
                    <td className="font-bold">{s.xp}</td>
                    <td className="font-bold">{s.total_stars}</td>
                    <td className="whitespace-nowrap text-right">
                      <button onClick={() => reset(s.username)} className="btn-ghost px-2 py-1 text-xs" title="Parolni yangilash">🔑</button>
                      <button onClick={() => del(s.username)} className="btn-ghost px-2 py-1 text-xs text-bubble-600" title="O‘chirish">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

// ── admins (super only) ──────────────────────────────────────────────
function Admins() {
  const { copied, copy } = useCopy();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [aname, setAname] = useState('');
  const [role, setRole] = useState<'admin' | 'super'>('admin');
  const [password, setPassword] = useState(genPassword());
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch('/api/admin/admins');
    const d = await r.json().catch(() => ({}));
    setAdmins(d.ok ? d.admins : []);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const create = async () => {
    setError(null); setCreated(null); setBusy(true);
    const r = await fetch('/api/admin/admins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, name: aname, role, password }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!d.ok) { setError(d.reason === 'taken' ? 'Bu email band.' : d.reason === 'email' ? 'Email noto‘g‘ri.' : 'Xatolik.'); return; }
    setCreated({ email: d.email, password: d.password });
    setEmail(''); setAname(''); setRole('admin'); setPassword(genPassword());
    void load();
  };

  const del = async (em: string) => {
    if (!confirm(`"${em}" admini o‘chirilsinmi?`)) return;
    const r = await fetch('/api/admin/admins', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: em }) });
    const d = await r.json().catch(() => ({}));
    if (!d.ok) alert(d.reason === 'self' ? 'O‘zingizni o‘chira olmaysiz.' : d.reason === 'last-super' ? 'Oxirgi super adminni o‘chirib bo‘lmaydi.' : 'Xatolik.');
    void load();
  };

  return (
    <>
      <section className="card">
        <h2 className="font-display text-xl font-extrabold">➕ Yangi admin</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-ink-soft">Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teacher@maktab.uz" autoCapitalize="none"
              className="w-full rounded-2xl border-2 border-grape-100 bg-white px-4 py-2.5 font-bold outline-none focus:border-grape" />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-ink-soft">Ism</span>
            <input value={aname} onChange={(e) => setAname(e.target.value)} placeholder="Dilnoza opa" maxLength={40}
              className="w-full rounded-2xl border-2 border-grape-100 bg-white px-4 py-2.5 font-bold outline-none focus:border-grape" />
          </label>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-ink-soft">Rol</span>
            <select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'super')}
              className="w-full rounded-2xl border-2 border-grape-100 bg-white px-4 py-2.5 font-bold outline-none focus:border-grape">
              <option value="admin">Admin (o‘quvchilar)</option>
              <option value="super">Super admin (hammasi)</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-ink-soft">Parol</span>
            <div className="flex gap-2">
              <input value={password} onChange={(e) => setPassword(e.target.value)}
                className="flex-1 rounded-2xl border-2 border-grape-100 bg-white px-4 py-2.5 font-mono font-extrabold outline-none focus:border-grape" />
              <button onClick={() => setPassword(genPassword())} className="btn-ghost px-4" title="Yangi parol">↻</button>
            </div>
          </label>
        </div>
        {error && <p className="mt-3 text-sm font-bold text-bubble-600">{error}</p>}
        <button onClick={create} disabled={busy || !email} className="btn-primary mt-4 w-full text-lg disabled:opacity-50">
          {busy ? 'Yaratilmoqda…' : '✨ Admin qo‘shish'}
        </button>
        <AnimatePresence>
          {created && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 rounded-2xl bg-mint/15 p-4">
              <p className="font-display font-extrabold text-mint-600">✅ Admin yaratildi!</p>
              <div className="mt-2 grid gap-1 font-mono text-sm">
                <Row label="Email" value={created.email} onCopy={copy} copied={copied} />
                <Row label="Parol" value={created.password} onCopy={copy} copied={copied} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      <section className="card mt-6">
        <h2 className="font-display text-xl font-extrabold">🛡️ Adminlar ({admins.length})</h2>
        {loading ? (
          <div className="grid place-items-center py-8"><div className="h-8 w-8 animate-spin rounded-full border-4 border-grape-100 border-t-grape" /></div>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs font-bold uppercase text-ink-faint"><tr><th className="py-2">Email</th><th>Ism</th><th>Rol</th><th></th></tr></thead>
              <tbody>
                {admins.map((a) => (
                  <tr key={a.id} className="border-t border-grape-100">
                    <td className="py-2.5 font-bold">{a.email}{a.is_self && <span className="ml-1 text-xs text-ink-faint">(siz)</span>}</td>
                    <td className="text-ink-soft">{a.name || '—'}</td>
                    <td><span className={`chip text-xs ${a.role === 'super' ? 'bg-sun/40 text-mango-600' : 'bg-grape-50 text-grape'}`}>{a.role}</span></td>
                    <td className="text-right">
                      {!a.is_self && <button onClick={() => del(a.email)} className="btn-ghost px-2 py-1 text-xs text-bubble-600" title="O‘chirish">🗑️</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

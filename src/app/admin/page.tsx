'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, Modal, Notice, PageHeader, StatCard } from '@/components/ui/Primitives';
import {
  AdminCard, AdminGate, AdminShell, CopyRow, TableSkeleton, genPassword, useCopy, type AdminInfo,
} from '@/components/admin/AdminShell';

interface Student { id: string; username: string; display_name: string; xp: number; coins: number; total_stars: number; created_at: string }
interface AdminRow { id: string; email: string; name: string; role: 'super' | 'admin'; created_at: string; is_self: boolean }
interface ImportRow { name: string; username: string; password: string; ok: boolean; reason?: string }

export default function AdminPage() {
  return (
    <AdminGate>
      {(admin, logout) => (
        <AdminShell admin={admin} onLogout={() => void logout()}>
          <Panel admin={admin} />
        </AdminShell>
      )}
    </AdminGate>
  );
}

// ── panel ─────────────────────────────────────────────────────────────────────
function Panel({ admin }: { admin: AdminInfo }) {
  const [tab, setTab] = useState<'students' | 'admins'>('students');

  return (
    <>
      <PageHeader
        eyebrow="Boshqaruv"
        title="Sinf boshqaruvi"
        description="O‘quvchi hisoblarini yarating, parollarni yangilang va Excel orqali ko‘plab qo‘shing."
        actions={
          admin.role === 'super' ? (
            <div role="tablist" aria-label="Bo‘limlar" className="inline-flex rounded-lg bg-surface-3 p-0.5">
              {([
                { id: 'students', label: 'O‘quvchilar', icon: 'users' },
                { id: 'admins', label: 'Adminlar', icon: 'shield' },
              ] as const).map((o) => {
                const active = tab === o.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTab(o.id)}
                    className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-md px-3 text-xs font-bold transition ${
                      active ? 'bg-surface text-fg shadow-xs' : 'text-fg-soft hover:text-fg'
                    }`}
                  >
                    <Icon name={o.icon} className="h-3.5 w-3.5" />
                    {o.label}
                  </button>
                );
              })}
            </div>
          ) : undefined
        }
      />
      <div className="mt-6">{tab === 'students' ? <Students /> : <Admins />}</div>
    </>
  );
}

// ── students ──────────────────────────────────────────────────────────────────
function Students() {
  const { copied, copy } = useCopy();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
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

  const totals = useMemo(() => ({
    xp: students.reduce((a, s) => a + (s.xp ?? 0), 0),
    stars: students.reduce((a, s) => a + (s.total_stars ?? 0), 0),
    active: students.filter((s) => (s.xp ?? 0) > 0).length,
  }), [students]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.username.toLowerCase().includes(q) || (s.display_name ?? '').toLowerCase().includes(q));
  }, [students, query]);

  const closeAdd = () => { setAddOpen(false); setError(null); };

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="O‘quvchilar" value={loading ? '—' : students.length} icon="users" tone="brand" />
        <StatCard label="Faol o‘quvchilar" value={loading ? '—' : totals.active} icon="activity" tone="success" hint="XP to‘plaganlar" />
        <StatCard label="Jami XP" value={loading ? '—' : totals.xp.toLocaleString()} icon="zap" tone="warning" />
        <StatCard label="Jami yulduzlar" value={loading ? '—' : totals.stars.toLocaleString()} icon="star" tone="amber" />
      </div>

      {/* one-off notices */}
      <AnimatePresence>
        {resetInfo && (
          <motion.div key="reset" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Notice tone="warning" icon="lock" action={<button type="button" onClick={() => setResetInfo(null)} className="btn-subtle btn-sm">Yopish</button>}>
              <p className="font-bold">Yangi parol — {resetInfo.username}</p>
              <p className="mt-0.5 text-xs opacity-80">Parol faqat hozir ko‘rinadi.</p>
              <div className="mt-2"><CopyRow label="Parol" value={resetInfo.password} onCopy={copy} copied={copied} /></div>
            </Notice>
          </motion.div>
        )}
        {importRes && (
          <motion.div key="import" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <AdminCard
              title={`Import natijasi · ${importRes.filter((r) => r.ok).length}/${importRes.length} ta qo‘shildi`}
              description="Parollar faqat hozir ko‘rinadi — natijani Excel’da saqlang."
              actions={
                <>
                  <button type="button" onClick={downloadResults} className="btn-secondary btn-sm"><Icon name="download" className="h-3.5 w-3.5" />Natijani yuklab olish</button>
                  <button type="button" onClick={() => setImportRes(null)} className="btn-subtle btn-sm">Yopish</button>
                </>
              }
              className="!p-0"
            >
              <div className="-m-5 max-h-72 overflow-auto">
                <table className="table">
                  <thead className="sticky top-0"><tr><th>Ism</th><th>Login</th><th>Parol</th><th>Holat</th></tr></thead>
                  <tbody>
                    {importRes.map((r, i) => (
                      <tr key={i}>
                        <td>{r.name || '—'}</td>
                        <td className="font-mono font-bold">{r.username}</td>
                        <td className="font-mono">{r.ok ? r.password : '—'}</td>
                        <td>{r.ok ? <span className="badge-success">OK</span> : <span className="badge-danger">{r.reason ?? 'xato'}</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </AdminCard>
          </motion.div>
        )}
      </AnimatePresence>

      {error && !addOpen && <Notice tone="danger">{error}</Notice>}

      {/* roster */}
      <section className="panel">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-extrabold text-fg">O‘quvchilar ro‘yxati</h2>
            <p className="text-xs text-fg-faint">Login va parolni o‘quvchiga bering — u o‘yinda profil bo‘limidan kiradi.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Qidirish…"
                aria-label="O‘quvchini qidirish"
                className="input h-9 min-h-0 w-44 py-0 pl-9 sm:w-52"
              />
            </div>
            <button type="button" onClick={downloadTemplate} className="btn-secondary btn-sm" title="Excel namunasini yuklab olish">
              <Icon name="download" className="h-3.5 w-3.5" /><span className="hidden sm:inline">Namuna</span>
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={importing} className="btn-secondary btn-sm">
              <Icon name="upload" className="h-3.5 w-3.5" />{importing ? 'Import…' : 'Excel import'}
            </button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ''; }} />
            <button type="button" onClick={() => setAddOpen(true)} className="btn-primary btn-sm">
              <Icon name="plus" className="h-3.5 w-3.5" />Yangi o‘quvchi
            </button>
          </div>
        </div>

        {loading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : students.length === 0 ? (
          <EmptyState
            icon="users"
            tone="brand"
            title="Hali o‘quvchi yo‘q"
            description="Birinchi hisobni qo‘lda yarating yoki Excel ro‘yxatini import qiling."
            action={
              <>
                <button type="button" onClick={() => setAddOpen(true)} className="btn-primary btn-sm"><Icon name="plus" className="h-3.5 w-3.5" />Yangi o‘quvchi</button>
                <button type="button" onClick={downloadTemplate} className="btn-secondary btn-sm"><Icon name="download" className="h-3.5 w-3.5" />Excel namunasi</button>
              </>
            }
            className="!rounded-none !border-0 !shadow-none"
          />
        ) : shown.length === 0 ? (
          <EmptyState icon="search" title="Hech narsa topilmadi" description={`"${query}" bo‘yicha o‘quvchi yo‘q.`} className="!rounded-none !border-0 !shadow-none" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table min-w-[640px]">
              <thead className="sticky top-0 z-[1]">
                <tr>
                  <th>Login</th>
                  <th>Ism</th>
                  <th className="text-right">XP</th>
                  <th className="text-right">Yulduz</th>
                  <th className="text-right">Tanga</th>
                  <th className="text-right">Amallar</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono font-bold">{s.username}</td>
                    <td className="text-fg-soft">{s.display_name || '—'}</td>
                    <td className="text-right font-semibold tabular-nums">{s.xp}</td>
                    <td className="text-right font-semibold tabular-nums">{s.total_stars}</td>
                    <td className="text-right font-semibold tabular-nums">{s.coins}</td>
                    <td className="whitespace-nowrap text-right">
                      <button type="button" onClick={() => reset(s.username)} className="btn-subtle btn-sm" title="Parolni yangilash">
                        <Icon name="refresh" className="h-3.5 w-3.5" /><span className="hidden md:inline">Parol</span>
                      </button>
                      <button type="button" onClick={() => del(s.username)} className="btn-subtle btn-sm text-danger hover:bg-danger-50 hover:text-danger-700" title="O‘chirish">
                        <Icon name="trash" className="h-3.5 w-3.5" /><span className="hidden md:inline">O‘chirish</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && students.length > 0 && (
          <div className="border-t border-border px-4 py-2.5 text-xs text-fg-faint sm:px-5">{shown.length} / {students.length} ta o‘quvchi</div>
        )}
      </section>

      {/* add student modal */}
      <Modal
        open={addOpen}
        onClose={closeAdd}
        title="Yangi o‘quvchi"
        description="Ism kiritilsa, login avtomatik taklif qilinadi. Parolni o‘zgartirishingiz mumkin."
        footer={
          <>
            <button type="button" onClick={closeAdd} className="btn-secondary">Yopish</button>
            <button type="button" onClick={create} disabled={creating || !username} className="btn-primary">
              {creating ? 'Yaratilmoqda…' : 'Akkaunt yaratish'}
            </button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Ism</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Aziz Karimov" maxLength={30} className="input" />
          </label>
          <label className="block">
            <span className="label">Login</span>
            <input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} placeholder="aziz" autoCapitalize="none" maxLength={20} className="input font-mono" />
          </label>
        </div>
        <label className="mt-4 block">
          <span className="label">Parol</span>
          <div className="flex gap-2">
            <input value={password} onChange={(e) => setPassword(e.target.value)} className="input font-mono" />
            <button type="button" onClick={() => setPassword(genPassword())} className="btn-secondary btn-icon shrink-0" title="Yangi parol" aria-label="Yangi parol">
              <Icon name="refresh" className="h-4 w-4" />
            </button>
          </div>
        </label>
        {error && <Notice tone="danger" className="mt-4">{error}</Notice>}
        <AnimatePresence>
          {created && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 rounded-xl border border-success-100 bg-success-50 p-3">
              <p className="flex items-center gap-1.5 text-sm font-bold text-success-700"><Icon name="checkCircle" className="h-4 w-4" />Hisob yaratildi</p>
              <div className="mt-2 grid gap-1.5">
                <CopyRow label="Login" value={created.username} onCopy={copy} copied={copied} />
                <CopyRow label="Parol" value={created.password} onCopy={copy} copied={copied} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Modal>
    </div>
  );
}

// ── admins (super only) ───────────────────────────────────────────────────────
function Admins() {
  const { copied, copy } = useCopy();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
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

  const closeAdd = () => { setAddOpen(false); setError(null); };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Adminlar" value={loading ? '—' : admins.length} icon="shield" tone="brand" />
        <StatCard label="Super adminlar" value={loading ? '—' : admins.filter((a) => a.role === 'super').length} icon="crown" tone="warning" />
      </div>

      <section className="panel">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-extrabold text-fg">Adminlar</h2>
            <p className="text-xs text-fg-faint">Admin — o‘quvchilarni boshqaradi. Super admin — adminlarni ham.</p>
          </div>
          <button type="button" onClick={() => setAddOpen(true)} className="btn-primary btn-sm">
            <Icon name="plus" className="h-3.5 w-3.5" />Yangi admin
          </button>
        </div>

        {loading ? (
          <TableSkeleton rows={3} cols={4} />
        ) : admins.length === 0 ? (
          <EmptyState icon="shield" title="Admin topilmadi" className="!rounded-none !border-0 !shadow-none" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table min-w-[560px]">
              <thead><tr><th>Email</th><th>Ism</th><th>Rol</th><th className="text-right">Amallar</th></tr></thead>
              <tbody>
                {admins.map((a) => (
                  <tr key={a.id}>
                    <td className="font-semibold">
                      {a.email}
                      {a.is_self && <span className="ml-2 badge-neutral">siz</span>}
                    </td>
                    <td className="text-fg-soft">{a.name || '—'}</td>
                    <td><span className={a.role === 'super' ? 'badge-warning' : 'badge-brand'}>{a.role === 'super' ? 'Super admin' : 'Admin'}</span></td>
                    <td className="text-right">
                      {!a.is_self && (
                        <button type="button" onClick={() => del(a.email)} className="btn-subtle btn-sm text-danger hover:bg-danger-50 hover:text-danger-700" title="O‘chirish">
                          <Icon name="trash" className="h-3.5 w-3.5" /><span className="hidden md:inline">O‘chirish</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={addOpen}
        onClose={closeAdd}
        title="Yangi admin"
        footer={
          <>
            <button type="button" onClick={closeAdd} className="btn-secondary">Yopish</button>
            <button type="button" onClick={create} disabled={busy || !email} className="btn-primary">{busy ? 'Yaratilmoqda…' : 'Admin qo‘shish'}</button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teacher@maktab.uz" type="email" autoCapitalize="none" className="input" />
          </label>
          <label className="block">
            <span className="label">Ism</span>
            <input value={aname} onChange={(e) => setAname(e.target.value)} placeholder="Dilnoza opa" maxLength={40} className="input" />
          </label>
          <label className="block">
            <span className="label">Rol</span>
            <select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'super')} className="input">
              <option value="admin">Admin (o‘quvchilar)</option>
              <option value="super">Super admin (hammasi)</option>
            </select>
          </label>
          <label className="block">
            <span className="label">Parol</span>
            <div className="flex gap-2">
              <input value={password} onChange={(e) => setPassword(e.target.value)} className="input font-mono" />
              <button type="button" onClick={() => setPassword(genPassword())} className="btn-secondary btn-icon shrink-0" title="Yangi parol" aria-label="Yangi parol">
                <Icon name="refresh" className="h-4 w-4" />
              </button>
            </div>
          </label>
        </div>
        {error && <Notice tone="danger" className="mt-4">{error}</Notice>}
        <AnimatePresence>
          {created && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 rounded-xl border border-success-100 bg-success-50 p-3">
              <p className="flex items-center gap-1.5 text-sm font-bold text-success-700"><Icon name="checkCircle" className="h-4 w-4" />Admin yaratildi</p>
              <div className="mt-2 grid gap-1.5">
                <CopyRow label="Email" value={created.email} onCopy={copy} copied={copied} />
                <CopyRow label="Parol" value={created.password} onCopy={copy} copied={copied} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Modal>
    </div>
  );
}

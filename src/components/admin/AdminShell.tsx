'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Logo } from '@/components/layout/TopBar';
import { Notice, Spinner } from '@/components/ui/Primitives';

/* ────────────────────────────────────────────────────────────────────────────
   Teacher / admin panel chrome.
   `AdminGate` owns the /api/admin/me session check (loading → login → panel),
   `AdminShell` is the sidebar + content layout every admin page renders into.
   All strings are Uzbek on purpose — the panel is teacher-facing and was never
   keyed into the student-facing i18n dictionary.
   ──────────────────────────────────────────────────────────────────────────── */

export interface AdminInfo { id: string; email: string; name: string; role: 'super' | 'admin' }

/** Session hook shared by every admin page. `undefined` = still checking. */
export function useAdminSession() {
  const [admin, setAdmin] = useState<AdminInfo | null | undefined>(undefined);
  const refresh = useCallback(() => {
    fetch('/api/admin/me')
      .then((r) => r.json())
      .then((d) => setAdmin(d.ok ? d.admin : null))
      .catch(() => setAdmin(null));
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const logout = useCallback(async () => {
    await fetch('/api/admin/logout', { method: 'POST' });
    setAdmin(null);
  }, []);
  return { admin, refresh, logout };
}

/** Loading → login → children(admin). */
export function AdminGate({ children }: { children: (admin: AdminInfo, logout: () => Promise<void>) => ReactNode }) {
  const { admin, refresh, logout } = useAdminSession();
  if (admin === undefined) {
    return (
      <div className="grid min-h-screen place-items-center bg-bg">
        <Spinner className="h-7 w-7" label="Yuklanmoqda" />
      </div>
    );
  }
  if (admin === null) return <AdminLogin onIn={refresh} />;
  return <>{children(admin, logout)}</>;
}

// ── login ─────────────────────────────────────────────────────────────────────
export function AdminLogin({ onIn }: { onIn: () => void }) {
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
    <div className="relative grid min-h-screen place-items-center bg-bg p-4">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(60%_60%_at_50%_30%,black,transparent)]" aria-hidden />
      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        onSubmit={(e) => { e.preventDefault(); void submit(); }}
        className="card relative w-full max-w-sm !p-7"
      >
        <Logo />
        <h1 className="mt-6 font-display text-xl font-extrabold tracking-tight text-fg">O‘qituvchi paneli</h1>
        <p className="mt-1 text-sm text-fg-soft">Sinfingizni boshqarish uchun admin hisobingiz bilan kiring.</p>

        <div className="mt-6 space-y-4">
          <label className="block">
            <span className="label">Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="teacher@maktab.uz"
              type="email"
              autoComplete="username"
              autoCapitalize="none"
              className="input"
            />
          </label>
          <label className="block">
            <span className="label">Parol</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
              autoComplete="current-password"
              className="input"
            />
          </label>
          {err && <Notice tone="danger">{err}</Notice>}
          <button type="submit" disabled={busy || !email || !password} className="btn-primary w-full">
            {busy ? 'Tekshirilmoqda…' : 'Kirish'}
          </button>
        </div>
        <p className="mt-5 text-center text-xs text-fg-faint">
          <Link href="/" className="font-semibold text-fg-soft hover:text-fg">O‘yinga qaytish</Link>
        </p>
      </motion.form>
    </div>
  );
}

// ── shell ─────────────────────────────────────────────────────────────────────
const NAV: { href: string; icon: IconName; label: string; exact?: boolean }[] = [
  { href: '/admin', icon: 'layers', label: 'Boshqaruv', exact: true },
  { href: '/admin/arena', icon: 'arena', label: 'Arena savollari' },
  { href: '/admin/cases', icon: 'search', label: 'Sinf turniri' },
];

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5" aria-label="Admin">
      {NAV.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? 'page' : undefined}
            className={`flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-bold transition-colors ${
              active ? 'bg-brand-50 text-brand-700' : 'text-fg-soft hover:bg-surface-2 hover:text-fg'
            }`}
          >
            <Icon name={item.icon} className={`h-4 w-4 ${active ? '' : 'opacity-80'}`} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function AdminIdentity({ admin, onLogout }: { admin: AdminInfo; onLogout: () => void }) {
  const initial = (admin.name || admin.email).trim().charAt(0).toUpperCase();
  return (
    <div className="rounded-xl border border-border bg-surface-2 p-3">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand text-sm font-extrabold text-white">{initial}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-fg">{admin.name || admin.email}</p>
          <p className="truncate text-xs text-fg-faint">{admin.email}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className={admin.role === 'super' ? 'badge-warning' : 'badge-brand'}>
          {admin.role === 'super' ? 'Super admin' : 'Admin'}
        </span>
        <button type="button" onClick={onLogout} className="btn-subtle btn-sm -mr-1 gap-1.5 text-fg-soft">
          <Icon name="logout" className="h-3.5 w-3.5" />
          Chiqish
        </button>
      </div>
    </div>
  );
}

/** Sidebar (≥lg) + mobile drawer layout. */
export function AdminShell({ admin, onLogout, children }: { admin: AdminInfo; onLogout: () => void; children: ReactNode }) {
  const pathname = usePathname() ?? '/admin';
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open]);

  const sidebarBody = (onNavigate?: () => void) => (
    <>
      <div className="flex h-14 items-center justify-between px-4">
        <Logo />
        {onNavigate && (
          <button type="button" onClick={onNavigate} aria-label="Yopish" className="btn-subtle btn-icon h-9 w-9 min-h-0 rounded-lg">
            <Icon name="x" className="h-[18px] w-[18px]" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <p className="eyebrow px-3 pb-2">Boshqaruv</p>
        <NavLinks pathname={pathname} onNavigate={onNavigate} />
        <p className="eyebrow px-3 pb-2 pt-6">Platforma</p>
        <Link
          href="/"
          onClick={onNavigate}
          className="flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-bold text-fg-soft transition-colors hover:bg-surface-2 hover:text-fg"
        >
          <Icon name="play" className="h-4 w-4 opacity-80" />
          O‘yinga o‘tish
        </Link>
      </div>
      <div className="p-3">
        <AdminIdentity admin={admin} onLogout={onLogout} />
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-bg lg:grid lg:grid-cols-[16rem_1fr]">
      {/* desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-border bg-surface lg:flex">{sidebarBody()}</aside>

      <div className="flex min-w-0 flex-col">
        {/* mobile top bar */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-bg/80 px-4 backdrop-blur-xl lg:hidden">
          <button type="button" onClick={() => setOpen(true)} aria-label="Menyu" aria-expanded={open} className="btn-secondary btn-icon -ml-1 h-9 w-9 min-h-0 rounded-lg">
            <Icon name="menu" className="h-[18px] w-[18px]" />
          </button>
          <Logo />
          <div className="flex-1" />
          <span className={admin.role === 'super' ? 'badge-warning' : 'badge-brand'}>{admin.role === 'super' ? 'Super' : 'Admin'}</span>
        </header>

        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>

      {/* mobile drawer */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="overlay"
              className="fixed inset-0 z-40 bg-fg/40 backdrop-blur-[2px] lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onClick={() => setOpen(false)}
            />
            <motion.aside
              key="drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Menyu"
              className="fixed inset-y-0 left-0 z-50 flex w-[18rem] max-w-[85vw] flex-col border-r border-border bg-surface shadow-xl lg:hidden"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              {sidebarBody(() => setOpen(false))}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── small shared helpers ──────────────────────────────────────────────────────
export function genPassword(): string {
  const a = ['Robo', 'Star', 'Pixel', 'Byte', 'Nova', 'Turbo', 'Cyber', 'Mega', 'Hyper', 'Laser'];
  const b = ['Fox', 'Tiger', 'Whale', 'Dragon', 'Falcon', 'Wolf', 'Panda', 'Shark', 'Lion', 'Hawk'];
  const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
  return `${pick(a)}-${pick(b)}-${Math.floor(1000 + Math.random() * 9000)}`;
}

export const useCopy = () => {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (t: string) => { try { navigator.clipboard?.writeText(t); setCopied(t); setTimeout(() => setCopied(null), 1500); } catch {} };
  return { copied, copy };
};

/** Label · monospace value · copy button. */
export function CopyRow({ label, value, onCopy, copied }: { label: string; value: string; onCopy: (t: string) => void; copied: string | null }) {
  const done = copied === value;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
      <span className="w-14 shrink-0 text-xs font-semibold text-fg-faint">{label}</span>
      <code className="min-w-0 flex-1 break-all font-mono text-sm font-bold text-fg">{value}</code>
      <button type="button" onClick={() => onCopy(value)} className="btn-subtle btn-sm gap-1" aria-label={`${label} nusxalash`}>
        <Icon name={done ? 'check' : 'copy'} className={`h-3.5 w-3.5 ${done ? 'text-success-600' : ''}`} />
        {done ? 'Nusxalandi' : 'Nusxa'}
      </button>
    </div>
  );
}

/** Section card with a title row. */
export function AdminCard({ title, description, actions, children, className = '' }: { title?: ReactNode; description?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            {title && <h2 className="font-display text-base font-extrabold text-fg">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-fg-soft">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

/** Skeleton rows for a loading table. */
export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-4" aria-hidden>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="skeleton h-4 flex-1" style={{ maxWidth: c === 0 ? 140 : undefined }} />
          ))}
        </div>
      ))}
    </div>
  );
}

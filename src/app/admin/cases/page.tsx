'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { CASES } from '@/data/cases';
import { localizeCaseTitle } from '@/data/cases/i18n';
import type { CaseDef } from '@/data/cases/types';

interface AdminInfo { id: string; email: string; name: string; role: 'super' | 'admin' }

/** Generate a random 4-letter uppercase room code. */
function makeCode(): string {
  return Array.from({ length: 4 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  ).join('');
}

export default function AdminCasesPage() {
  const [admin, setAdmin] = useState<AdminInfo | null | undefined>(undefined);

  const refresh = useCallback(() => {
    fetch('/api/admin/me')
      .then((r) => r.json())
      .then((d) => setAdmin(d.ok ? d.admin : null))
      .catch(() => setAdmin(null));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  if (admin === undefined) {
    return (
      <div className="grid min-h-screen place-items-center bg-ink">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-white" />
      </div>
    );
  }

  if (admin === null) {
    return (
      <div className="grid min-h-screen place-items-center bg-gradient-to-br from-ink to-grape-600 p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-toy text-center"
        >
          <div className="text-4xl">🔒</div>
          <h1 className="mt-2 font-display text-xl font-extrabold">Kirish kerak</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Bu sahifadan foydalanish uchun admin sifatida tizimga kiring.
          </p>
          <Link href="/admin" className="btn-primary mt-5 block">
            Admin panelga kirish
          </Link>
        </motion.div>
      </div>
    );
  }

  return <CasePicker admin={admin} />;
}

// ── main setup UI ─────────────────────────────────────────────────────────────
function CasePicker({ admin }: { admin: AdminInfo }) {
  const router = useRouter();
  const [selected, setSelected] = useState<CaseDef | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [joinErr, setJoinErr] = useState(false);

  const launch = () => {
    if (!selected) return;
    const code = makeCode();
    router.push(`/admin/cases/${code}?case=${selected.id}`);
  };

  const join = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) { setJoinErr(true); return; }
    setJoinErr(false);
    router.push(`/admin/cases/${code}`);
  };

  return (
    <div className="min-h-screen bg-cloud">
      {/* Header — matches /admin panel style */}
      <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-grape-100 bg-white px-4 py-3">
        <div className="flex items-center gap-2 font-display font-extrabold">
          🕵️ Sinf turniri
          <span className="chip bg-grape-50 text-grape text-xs">INC 8</span>
          <span className="hidden text-sm font-bold text-ink-faint sm:inline">{admin.email}</span>
        </div>
        <Link href="/admin" className="btn-ghost px-3 py-1.5 text-sm">
          ← Admin panel
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 space-y-5">
        {/* Step 1: pick a case */}
        <section className="card">
          <h2 className="font-display text-xl font-extrabold">
            1-qadam — Ish tanlang
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            O'quvchilar hal qiladigan ish mavzusini tanlang.
          </p>

          <ul className="mt-4 space-y-2">
            {CASES.map((c) => {
              const isSelected = selected?.id === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(isSelected ? null : c)}
                    className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left transition
                      ${isSelected
                        ? 'border-grape bg-grape-50 shadow-card'
                        : 'border-grape-100 bg-white hover:border-grape-300 hover:shadow-card'
                      }`}
                  >
                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white
                        ${isSelected ? 'bg-grape' : 'bg-gradient-to-br from-sky to-grape'}`}
                      aria-hidden
                    >
                      🔍
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display font-extrabold text-ink">{localizeCaseTitle(c, 'uz')}</p>
                      <p className="text-xs font-bold text-ink-faint">
                        {c.gradeBand} sinf · {c.questions.length} ta savol
                      </p>
                    </div>
                    {isSelected && (
                      <span className="shrink-0 text-grape font-extrabold">✓</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Step 2: launch */}
        <section className="card">
          <h2 className="font-display text-xl font-extrabold">
            2-qadam — Sinfni ishga tushirish
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Tugmani bossangiz, yangi xona kodi yaratiladi va siz darhol o'sha xonaga o'tasiz.
          </p>
          <button
            type="button"
            onClick={launch}
            disabled={!selected}
            className="btn-primary mt-4 w-full text-lg disabled:opacity-40"
          >
            🚀 Sinfni ishga tushirish
          </button>
          {!selected && (
            <p className="mt-2 text-center text-xs font-bold text-ink-faint">
              Avval ish tanlang
            </p>
          )}
        </section>

        {/* Join existing room */}
        <section className="card">
          <h2 className="font-display text-xl font-extrabold">
            Mavjud xonaga kirish
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Oldin yaratilgan xonaga kod orqali kiring.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              value={joinCode}
              onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinErr(false); }}
              onKeyDown={(e) => e.key === 'Enter' && join()}
              placeholder="ABCD"
              maxLength={4}
              aria-label="Xona kodi"
              className={`flex-1 rounded-2xl border-2 bg-white px-4 py-2.5 text-center font-display text-xl font-extrabold uppercase tracking-widest outline-none
                ${joinErr ? 'border-bubble-500' : 'border-grape-100 focus:border-grape'}`}
            />
            <button
              type="button"
              onClick={join}
              disabled={joinCode.trim().length < 4}
              className="btn-sun disabled:opacity-40"
            >
              Kirish
            </button>
          </div>
          {joinErr && (
            <p className="mt-1 text-xs font-bold text-bubble-600">
              4 harfli kod kiriting
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

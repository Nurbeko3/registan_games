'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CASES } from '@/data/cases';
import { localizeCaseTitle } from '@/data/cases/i18n';
import type { CaseDef } from '@/data/cases/types';
import { Icon } from '@/components/ui/Icon';
import { PageHeader } from '@/components/ui/Primitives';
import { AdminCard, AdminGate, AdminShell } from '@/components/admin/AdminShell';

/** Generate a random 4-letter uppercase room code. */
function makeCode(): string {
  return Array.from({ length: 4 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  ).join('');
}

export default function AdminCasesPage() {
  return (
    <AdminGate>
      {(admin, logout) => (
        <AdminShell admin={admin} onLogout={() => void logout()}>
          <CasePicker />
        </AdminShell>
      )}
    </AdminGate>
  );
}

// ── main setup UI ─────────────────────────────────────────────────────────────
function CasePicker() {
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
    <>
      <PageHeader
        eyebrow="Sinf turniri"
        title="Tergov fayllari — sinf turniri"
        description="Ishni tanlang, xona yarating va o‘quvchilar kod orqali qo‘shiladi. Siz har bir bosqichni o‘zingiz boshqarasiz."
      />

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_20rem]">
        {/* Step 1: pick a case */}
        <AdminCard title="1-qadam — Ish tanlang" description="O‘quvchilar hal qiladigan ish mavzusini tanlang." className="!p-0">
          <ul className="-m-5 divide-y divide-border" role="radiogroup" aria-label="Ishlar">
            {CASES.map((c) => {
              const isSelected = selected?.id === c.id;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => setSelected(isSelected ? null : c)}
                    className={`flex w-full items-center gap-3.5 px-5 py-3.5 text-left transition ${
                      isSelected ? 'bg-brand-50' : 'hover:bg-surface-2'
                    }`}
                  >
                    <span
                      className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ring-1 ring-inset ${
                        isSelected ? 'bg-brand text-white ring-brand' : 'bg-surface-2 text-fg-soft ring-border'
                      }`}
                      aria-hidden
                    >
                      <Icon name="search" className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-sm font-bold ${isSelected ? 'text-brand-700' : 'text-fg'}`}>{localizeCaseTitle(c, 'uz')}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="badge-neutral">{c.gradeBand} sinf</span>
                        <span className="text-xs text-fg-faint">{c.questions.length} ta savol</span>
                      </div>
                    </div>
                    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${isSelected ? 'border-brand bg-brand text-white' : 'border-border-strong'}`}>
                      {isSelected && <Icon name="check" className="h-3 w-3" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </AdminCard>

        <div className="space-y-5">
          {/* Step 2: launch */}
          <AdminCard title="2-qadam — Ishga tushirish" description="Yangi xona kodi yaratiladi va siz darhol boshqaruv ekraniga o‘tasiz.">
            <button type="button" onClick={launch} disabled={!selected} className="btn-primary w-full">
              <Icon name="play" className="h-4 w-4" />Sinfni ishga tushirish
            </button>
            <p className="help text-center">{selected ? `Tanlangan: ${localizeCaseTitle(selected, 'uz')}` : 'Avval ish tanlang'}</p>
          </AdminCard>

          {/* Join existing room */}
          <AdminCard title="Mavjud xonaga kirish" description="Oldin yaratilgan xonaga kod orqali qaytib kiring.">
            <div className="flex gap-2">
              <input
                value={joinCode}
                onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinErr(false); }}
                onKeyDown={(e) => e.key === 'Enter' && join()}
                placeholder="ABCD"
                maxLength={4}
                aria-label="Xona kodi"
                aria-invalid={joinErr || undefined}
                className={`input text-center font-mono text-lg font-bold uppercase tracking-[0.3em] ${joinErr ? 'input-error' : ''}`}
              />
              <button type="button" onClick={join} disabled={joinCode.trim().length < 4} className="btn-secondary shrink-0">Kirish</button>
            </div>
            {joinErr && <p className="help text-danger">4 harfli kod kiriting</p>}
          </AdminCard>
        </div>
      </div>
    </>
  );
}

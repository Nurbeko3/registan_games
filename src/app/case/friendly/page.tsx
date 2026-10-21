'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, Modal, Notice, PageHeader, PageLoading } from '@/components/ui/Primitives';
import { isCloudEnabled } from '@/lib/supabase/client';
import { useGame } from '@/store/useGame';
import { AvatarBadge } from '@/components/ui/AvatarBadge';
import { useT, useLocale } from '@/lib/i18n';
import { CASES } from '@/data/cases';
import { localizeCaseTitle } from '@/data/cases/i18n';
import type { CaseDef } from '@/data/cases/types';
import { CaseMetaBadges } from '@/components/case/CaseMeta';

const makeCode = () =>
  Array.from({ length: 4 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  ).join('');

export default function FriendlyPage() {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [pickedCase, setPickedCase] = useState<CaseDef | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const playerName = useGame((s) => s.playerName);
  const setPlayerName = useGame((s) => s.setPlayerName);
  const avatarId = useGame((s) => s.avatarId);

  useEffect(() => setMounted(true), []);

  const createRoom = () => {
    if (!pickedCase) {
      setShowPicker(true);
      return;
    }
    const code = makeCode();
    router.push(`/case/${code}?host=1&case=${pickedCase.id}`);
  };

  const selectCase = (c: CaseDef) => {
    setPickedCase(c);
    setShowPicker(false);
    const code = makeCode();
    router.push(`/case/${code}?host=1&case=${c.id}`);
  };

  const joinRoom = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length >= 4) router.push(`/case/${code}`);
  };

  return (
    <main id="main" className="page-pad-bottom min-h-screen">
      <TopBar showBack backHref="/case" />
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <PageHeader icon="users" title={t('case.mode.friendly')} description={t('case.mode.friendlyDesc')} />

        {!mounted && <PageLoading />}

        {mounted && !isCloudEnabled() && (
          <EmptyState
            className="mt-6"
            icon="signal"
            tone="brand"
            title={t('case.needNet')}
            action={<Link href="/case/practice" className="btn-primary">{t('case.mode.bot')}</Link>}
          />
        )}

        {mounted && isCloudEnabled() && (
          <div className="mt-6 space-y-4">
            {/* Hero identity */}
            <section className="card">
              <p className="eyebrow">{t('party.yourHero')}</p>
              <div className="mt-3 flex items-center gap-3">
                <AvatarBadge avatar={avatarId} className="h-11 w-11 text-2xl" rounded="rounded-xl" bg="bg-brand-50" />
                <input
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder={t('party.typeName')}
                  maxLength={20}
                  aria-label={t('party.typeName')}
                  className="input flex-1"
                />
              </div>
              <p className="help">{t('party.changeChar')}</p>
            </section>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Create room */}
              <button
                type="button"
                onClick={createRoom}
                className="card card-hover group flex flex-col text-left focus-visible:ring-2 focus-visible:ring-brand"
              >
                <div className="flex items-start justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-50 text-violet-600 ring-1 ring-inset ring-violet-100">
                    <Icon name="search" className="h-5 w-5" />
                  </span>
                  <span className="badge-brand">{t('case.online')}</span>
                </div>
                <h2 className="mt-4 font-display text-base font-extrabold text-fg">{t('case.create')}</h2>
                <p className="mt-1 flex-1 text-sm leading-relaxed text-fg-soft">{t('case.createSub')}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-brand">
                  {t('home.openMode')}
                  <Icon name="arrowRight" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>

              {/* Join room */}
              <section className="card flex flex-col">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand ring-1 ring-inset ring-brand-100">
                  <Icon name="users" className="h-5 w-5" />
                </span>
                <h2 className="mt-4 font-display text-base font-extrabold text-fg">{t('case.joinByCode')}</h2>
                <label className="label mt-3" htmlFor="case-code">{t('case.roomCode')}</label>
                <div className="flex gap-2">
                  <input
                    id="case-code"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
                    placeholder="ABCD"
                    maxLength={4}
                    autoCapitalize="characters"
                    autoComplete="off"
                    className="input min-w-0 flex-1 text-center font-mono text-lg font-bold uppercase tracking-[0.3em] placeholder:tracking-[0.3em]"
                  />
                  <button type="button" onClick={joinRoom} disabled={joinCode.trim().length < 4} className="btn-primary shrink-0">
                    {t('case.join')}
                  </button>
                </div>
              </section>
            </div>

            <Notice icon="signal" tone="neutral">{t('case.needNet')}</Notice>
          </div>
        )}

        {/* Case picker */}
        <Modal open={showPicker} onClose={() => setShowPicker(false)} title={t('case.pickForRoom')} size="md">
          <ul className="space-y-2">
            {CASES.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => selectCase(c)}
                  className="card card-hover group flex w-full items-center gap-3 !p-3.5 text-left focus-visible:ring-2 focus-visible:ring-brand"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand ring-1 ring-inset ring-brand-100">
                    <Icon name="search" className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm font-bold text-fg">{localizeCaseTitle(c, locale)}</p>
                    <CaseMetaBadges caseDef={c} className="mt-1.5" />
                  </div>
                  <Icon name="arrowRight" className="h-4 w-4 shrink-0 text-brand transition-transform group-hover:translate-x-0.5" />
                </button>
              </li>
            ))}
          </ul>
        </Modal>
      </div>
    </main>
  );
}

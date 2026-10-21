'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, PageHeader, PageLoading } from '@/components/ui/Primitives';
import { isCloudEnabled } from '@/lib/supabase/client';
import { useGame } from '@/store/useGame';
import { AvatarBadge } from '@/components/ui/AvatarBadge';
import { useT } from '@/lib/i18n';

const makeCode = () => Array.from({ length: 4 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('');

export default function PartyPage() {
  const t = useT();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const playerName = useGame((s) => s.playerName);
  const setPlayerName = useGame((s) => s.setPlayerName);
  const avatarId = useGame((s) => s.avatarId);

  useEffect(() => setMounted(true), []);

  const createRoom = () => router.push(`/party/${makeCode()}?host=1`);
  const joinRoom = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length >= 3) router.push(`/party/${code}`);
  };
  const canJoin = joinCode.trim().length >= 3;

  return (
    <main id="main" className="page-pad-bottom min-h-screen">
      <TopBar />
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <PageHeader icon="party" title={t('party.title')} description={t('party.sub')} />

        {!mounted && <PageLoading />}

        {mounted && !isCloudEnabled() && (
          <EmptyState
            className="mt-6"
            icon="signal"
            tone="brand"
            title={t('party.needNet')}
            description={t('party.needNetSub')}
            action={<Link href="/map" className="btn-primary">{t('party.solo')}</Link>}
          />
        )}

        {mounted && isCloudEnabled() && (
          <div className="mt-6 space-y-4">
            {/* who am I */}
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
              {/* create */}
              <button
                type="button"
                onClick={createRoom}
                className="card card-hover group flex flex-col text-left focus-visible:ring-2 focus-visible:ring-brand"
              >
                <div className="flex items-start justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-warning-50 text-warning-600 ring-1 ring-inset ring-warning-100">
                    <Icon name="party" className="h-5 w-5" />
                  </span>
                  <span className="badge-brand">{t('case.online')}</span>
                </div>
                <h2 className="mt-4 font-display text-base font-extrabold text-fg">{t('party.create')}</h2>
                <p className="mt-1 flex-1 text-sm leading-relaxed text-fg-soft">{t('party.createSub')}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-brand">
                  {t('home.openMode')}
                  <Icon name="arrowRight" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>

              {/* join */}
              <section className="card flex flex-col">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand ring-1 ring-inset ring-brand-100">
                  <Icon name="users" className="h-5 w-5" />
                </span>
                <h2 className="mt-4 font-display text-base font-extrabold text-fg">{t('party.joinFriend')}</h2>
                <label className="label mt-3" htmlFor="party-code">{t('party.roomCode')}</label>
                <div className="flex gap-2">
                  <input
                    id="party-code"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
                    placeholder="ABCD"
                    maxLength={6}
                    autoCapitalize="characters"
                    autoComplete="off"
                    className="input min-w-0 flex-1 text-center font-mono text-lg font-bold uppercase tracking-[0.3em] placeholder:tracking-[0.3em]"
                  />
                  <button type="button" onClick={joinRoom} disabled={!canJoin} className="btn-primary shrink-0">
                    {t('party.join')}
                  </button>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

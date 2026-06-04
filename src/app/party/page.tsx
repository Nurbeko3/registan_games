'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Icon, IconTile } from '@/components/ui/Icon';
import { isCloudEnabled } from '@/lib/supabase/client';
import { useGame, getAvatar } from '@/store/useGame';
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

  const name = playerName || 'Player';

  const createRoom = () => router.push(`/party/${makeCode()}?host=1`);
  const joinRoom = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length >= 3) router.push(`/party/${code}`);
  };

  return (
    <main id="main" className="min-h-screen dotted">
      <TopBar />
      <div className="mx-auto max-w-md px-4 py-6">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-grape-50 text-grape">
            <Icon name="party" className="h-6 w-6" />
          </span>
          <div>
            <h1 className="h-section">{t('party.title')}</h1>
            <p className="text-sm text-ink-soft">{t('party.sub')}</p>
          </div>
        </div>

        {mounted && !isCloudEnabled() && (
          <div className="card mt-5 text-center">
            <Icon name="signal" className="mx-auto h-10 w-10 text-grape" />
            <p className="mt-2 font-display font-extrabold">{t('party.needNet')}</p>
            <p className="mt-1 text-ink-soft">{t('party.needNetSub')}</p>
            <Link href="/map" className="btn-primary mt-4">{t('party.solo')}</Link>
          </div>
        )}

        {mounted && isCloudEnabled() && (
          <>
            {/* who am I */}
            <section className="card mt-5">
              <p className="font-display font-extrabold">{t('party.yourHero')}</p>
              <div className="mt-3 flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-grape-50 text-2xl">{getAvatar(avatarId).emoji}</span>
                <input
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder={t('party.typeName')}
                  maxLength={20}
                  className="flex-1 rounded-2xl border-2 border-grape-100 bg-white px-4 py-2.5 font-bold outline-none focus:border-grape"
                />
              </div>
              <p className="mt-2 text-xs text-ink-faint">{t('party.changeChar')}</p>
            </section>

            {/* create — same mode-card rhythm as the home page */}
            <button
              onClick={createRoom}
              className="card-tap group mt-5 block w-full overflow-hidden rounded-2xl bg-gradient-to-br from-mango to-sun p-5 text-left text-white shadow-card"
            >
              <div className="flex items-start justify-between gap-4">
                <IconTile name="party" className="h-14 w-14 bg-white/20 text-white" iconClassName="h-7 w-7" />
                <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-extrabold">{t('home.modeExtra')}</span>
              </div>
              <h3 className="mt-5 font-display text-2xl font-extrabold">{t('party.create')}</h3>
              <p className="mt-1 font-bold text-white/90">{t('party.createSub')}</p>
              <span className="mt-5 inline-flex items-center gap-2 font-display font-extrabold text-white">
                {t('home.openMode')} <Icon name="spark" className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </button>

            {/* join */}
            <div className="card mt-3">
              <p className="font-display font-extrabold">{t('party.joinFriend')}</p>
              <div className="mt-3 flex gap-2">
                <input
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
                  placeholder={t('party.roomCode')}
                  maxLength={6}
                  className="flex-1 rounded-2xl border-2 border-grape-100 bg-white px-4 py-3 text-center font-display text-xl font-extrabold uppercase tracking-widest outline-none focus:border-grape"
                />
                <button onClick={joinRoom} disabled={joinCode.trim().length < 3} className="btn-sun disabled:opacity-40">{t('party.join')}</button>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

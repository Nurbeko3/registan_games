'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Icon } from '@/components/ui/Icon';
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
        <div className="text-center">
          <Icon name="party" className="mx-auto h-12 w-12 text-grape" />
          <h1 className="mt-2 h-section">{t('party.title')}</h1>
          <p className="mt-1 text-ink-soft">{t('party.sub')}</p>
        </div>

        {mounted && !isCloudEnabled() && (
          <div className="card mt-6 text-center">
            <Icon name="signal" className="mx-auto h-10 w-10 text-grape" />
            <p className="mt-2 font-display font-extrabold">{t('party.needNet')}</p>
            <p className="mt-1 text-ink-soft">{t('party.needNetSub')}</p>
            <Link href="/map" className="btn-primary mt-4">{t('party.solo')}</Link>
          </div>
        )}

        {mounted && isCloudEnabled() && (
          <>
            {/* who am I */}
            <section className="card mt-6">
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

            {/* create */}
            <button onClick={createRoom} className="btn-primary mt-5 w-full text-lg">{t('party.create')}</button>

            {/* join */}
            <div className="card mt-5">
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

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Icon, IconTile } from '@/components/ui/Icon';
import { isCloudEnabled } from '@/lib/supabase/client';
import { useGame, getAvatar } from '@/store/useGame';
import { useT } from '@/lib/i18n';
import { CASES } from '@/data/cases';
import type { CaseDef } from '@/data/cases/types';

const makeCode = () =>
  Array.from({ length: 4 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26)),
  ).join('');

export default function FriendlyPage() {
  const t = useT();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [pickedCase, setPickedCase] = useState<CaseDef | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  const playerName = useGame((s) => s.playerName);
  const setPlayerName = useGame((s) => s.setPlayerName);
  const avatarId = useGame((s) => s.avatarId);

  useEffect(() => setMounted(true), []);

  const name = playerName || 'Player';

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
    <main id="main" className="min-h-screen dotted page-pad-bottom">
      <TopBar showBack />
      <div className="mx-auto max-w-md px-4 py-6">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-grape-50 text-grape">
            <Icon name="party" className="h-6 w-6" />
          </span>
          <div>
            <h1 className="h-section">{t('case.mode.friendly')}</h1>
            <p className="text-sm text-ink-soft">{t('case.mode.friendlyDesc')}</p>
          </div>
        </div>

        {mounted && !isCloudEnabled() && (
          <div className="card mt-5 text-center">
            <Icon name="signal" className="mx-auto h-10 w-10 text-grape" />
            <p className="mt-2 font-display font-extrabold">{t('case.needNet')}</p>
            <Link href="/case" className="btn-primary mt-4">
              {t('case.mode.bot')}
            </Link>
          </div>
        )}

        {mounted && isCloudEnabled() && (
          <>
            {/* Hero identity */}
            <section className="card mt-5">
              <p className="font-display font-extrabold">{t('party.yourHero')}</p>
              <div className="mt-3 flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-grape-50 text-2xl">
                  {getAvatar(avatarId).emoji}
                </span>
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

            {/* Case picker overlay */}
            {showPicker && (
              <div className="card mt-5">
                <p className="font-display font-extrabold">{t('case.pickForRoom')}</p>
                <ul className="mt-3 space-y-2">
                  {CASES.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => selectCase(c)}
                        className="flex w-full items-center gap-3 rounded-2xl border-2 border-grape-100 bg-white px-4 py-3 text-left transition hover:border-grape-400 hover:shadow-card"
                      >
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sky to-grape text-white">
                          <Icon name="search" className="h-5 w-5" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-display font-extrabold text-ink">
                            {c.title}
                          </p>
                          <p className="text-xs font-bold text-ink-faint">
                            {c.gradeBand} · {c.questions.length} questions
                          </p>
                        </div>
                        <Icon name="rocket" className="h-4 w-4 shrink-0 text-grape" />
                      </button>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setShowPicker(false)}
                  className="btn-ghost mt-3 w-full"
                >
                  {t('case.exit')}
                </button>
              </div>
            )}

            {!showPicker && (
              <>
                {/* Create room */}
                <button
                  onClick={createRoom}
                  className="card-tap group mt-5 block w-full overflow-hidden rounded-2xl bg-gradient-to-br from-grape to-bubble p-5 text-left text-white shadow-card"
                >
                  <div className="flex items-start justify-between gap-4">
                    <IconTile
                      name="search"
                      className="h-14 w-14 bg-white/20 text-white"
                      iconClassName="h-7 w-7"
                    />
                    <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-extrabold">
                      {t('case.online')}
                    </span>
                  </div>
                  <h3 className="mt-5 font-display text-2xl font-extrabold">
                    {t('case.create')}
                  </h3>
                  <p className="mt-1 font-bold text-white/90">{t('case.createSub')}</p>
                  <span className="mt-5 inline-flex items-center gap-2 font-display font-extrabold text-white">
                    {t('home.openMode')}{' '}
                    <Icon
                      name="spark"
                      className="h-4 w-4 transition-transform group-hover:translate-x-1"
                    />
                  </span>
                </button>

                {/* Join room */}
                <div className="card mt-3">
                  <p className="font-display font-extrabold">{t('case.joinByCode')}</p>
                  <div className="mt-3 flex gap-2">
                    <input
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
                      placeholder={t('case.roomCode')}
                      maxLength={4}
                      className="flex-1 rounded-2xl border-2 border-grape-100 bg-white px-4 py-3 text-center font-display text-xl font-extrabold uppercase tracking-widest outline-none focus:border-grape"
                    />
                    <button
                      onClick={joinRoom}
                      disabled={joinCode.trim().length < 4}
                      className="btn-sun disabled:opacity-40"
                    >
                      {t('case.join')}
                    </button>
                  </div>
                </div>

                <p className="mt-4 rounded-2xl bg-cloud px-4 py-3 text-sm font-bold text-ink-soft">
                  <Icon name="search" className="mr-1.5 inline h-4 w-4 text-grape" />
                  {t('case.needNet')}
                </p>
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

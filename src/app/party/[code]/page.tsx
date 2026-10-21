'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { TopBar } from '@/components/layout/TopBar';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, PageLoading } from '@/components/ui/Primitives';
import { useGame, getAvatar } from '@/store/useGame';
import { AvatarBadge } from '@/components/ui/AvatarBadge';
import { useParty } from '@/lib/party/useParty';
import { Confetti } from '@/components/ui/Confetti';
import { useT } from '@/lib/i18n';
import { playSfx } from '@/lib/sound';

function shuffledIndices(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function PartyRoomPage() {
  return (
    <Suspense fallback={null}>
      <Room />
    </Suspense>
  );
}

function Room() {
  const t = useT();
  const params = useParams();
  const search = useSearchParams();
  const code = String(params.code ?? '').toUpperCase();
  const isHost = search.get('host') === '1';

  const playerName = useGame((s) => s.playerName);
  const avatarId = useGame((s) => s.avatarId);

  const party = useParty(code, { name: playerName || 'Player', avatar: getAvatar(avatarId).emoji, isHost });
  const { phase, players, question, qIndex, total, selected, startGame, answer, myId, questionMs } = party;

  const [copied, setCopied] = useState(false);
  const copyCode = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // PARTY_QUIZ stores the correct option first, so show the options in a fresh
  // random order per question (otherwise "always tap the top one" wins). Each
  // button still answers with its ORIGINAL index, which the server scores.
  // One cue when the host reveals: right/wrong for my own pick, a tick if I sat out.
  useEffect(() => {
    if (phase !== 'reveal' || !question) return;
    playSfx(selected === null ? 'tick' : selected === question.answer ? 'success' : 'error');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire once per reveal
  }, [phase, qIndex]);

  const optionCount = question?.options.length ?? 0;
  const displayOrder = useMemo(
    () => shuffledIndices(optionCount),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reshuffle per question only
    [qIndex, optionCount],
  );

  return (
    <main id="main" className="min-h-screen pb-10">
      <TopBar showBack backHref="/party" />
      <div className="mx-auto max-w-xl px-4 py-6 sm:px-6">
        {/* ── ERROR ── */}
        {phase === 'error' && (
          <EmptyState
            icon="signal"
            tone="danger"
            title={t('party.offline')}
            action={<Link href="/map" className="btn-primary">{t('party.solo')}</Link>}
          />
        )}

        {/* ── CONNECTING ── */}
        {phase === 'connecting' && <PageLoading />}

        {/* ── LOBBY ── */}
        {phase === 'lobby' && (
          <div className="space-y-4">
            <section className="card text-center">
              <p className="eyebrow">{t('party.roomShare')}</p>
              <p className="mt-3 font-mono text-5xl font-bold tracking-[0.3em] text-fg sm:text-6xl" aria-label={code}>
                {code}
              </p>
              <p className="mt-2 text-sm text-fg-soft">{t('party.joinHint')}</p>
              <button type="button" onClick={copyCode} className="btn-secondary btn-sm mt-4">
                <Icon name={copied ? 'check' : 'copy'} className="h-4 w-4" />
                {copied ? t('case.codeCopied') : t('case.copyCode')}
              </button>
            </section>

            <PlayerList players={players} myId={myId} title={t('party.playersN', { n: players.length })} />

            {isHost ? (
              <button type="button" onClick={startGame} disabled={players.length < 1} className="btn-primary btn-lg w-full">
                <Icon name="play" className="h-4 w-4" />
                {t('party.startBattle')}
              </button>
            ) : (
              <p className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-surface-2 px-4 py-3 text-sm font-semibold text-fg-soft">
                <Icon name="signal" className="h-4 w-4 text-brand" />
                {t('party.waitHost')}
              </p>
            )}
            <Link href="/party" className="block text-center text-sm font-bold text-fg-faint transition hover:text-fg">
              {t('party.leaveRoom')}
            </Link>
          </div>
        )}

        {/* ── QUESTION / REVEAL ── */}
        {(phase === 'question' || phase === 'reveal') && question && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm font-semibold text-fg-soft">
              <span className="badge-neutral">{t('party.qN', { n: qIndex + 1, total })}</span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="users" className="h-4 w-4 text-fg-faint" />
                {t('party.playersCount', { n: players.length })}
              </span>
            </div>

            {/* timer */}
            {phase === 'question' && (
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                <motion.div
                  key={qIndex}
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: questionMs / 1000, ease: 'linear' }}
                  className="h-full bg-brand"
                />
              </div>
            )}

            <section className="card">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-xl ring-1 ring-inset ring-brand-100" aria-hidden>
                  {question.emoji}
                </span>
                <p className="font-display text-lg font-extrabold leading-snug text-fg sm:text-xl">{question.q}</p>
              </div>
            </section>

            <div className="grid gap-2">
              {displayOrder.map((i, pos) => {
                const opt = question.options[i];
                const isCorrect = i === question.answer;
                const isMine = i === selected;
                let cls = 'border-border bg-surface text-fg hover:border-border-strong hover:bg-surface-2';
                let letterCls = 'bg-surface-2 text-fg-soft';
                if (phase === 'reveal') {
                  if (isCorrect) { cls = 'border-success-300 bg-success-50 text-success-700 ring-2 ring-success-200'; letterCls = 'bg-success-600 text-white'; }
                  else if (isMine) { cls = 'border-danger-300 bg-danger-50 text-danger-700 ring-2 ring-danger-200'; letterCls = 'bg-danger-500 text-white'; }
                  else cls = 'border-border bg-surface text-fg-faint opacity-60';
                } else if (isMine) {
                  cls = 'border-brand bg-brand-50 text-brand-700 ring-2 ring-brand';
                  letterCls = 'bg-brand text-white';
                }
                return (
                  <motion.button
                    key={i}
                    type="button"
                    onClick={() => answer(i)}
                    whileTap={{ scale: 0.99 }}
                    disabled={phase === 'reveal' || selected !== null}
                    aria-pressed={isMine}
                    className={`flex min-h-[3.25rem] w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-base font-bold shadow-xs transition disabled:cursor-default ${cls}`}
                  >
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md font-display text-sm font-bold ${letterCls}`}>
                      {String.fromCharCode(65 + pos)}
                    </span>
                    <span className="flex-1">{opt}</span>
                    {phase === 'reveal' && isCorrect && <Icon name="checkCircle" className="h-5 w-5 shrink-0" />}
                    {phase === 'reveal' && isMine && !isCorrect && <Icon name="x" className="h-5 w-5 shrink-0" />}
                  </motion.button>
                );
              })}
            </div>

            {phase === 'question' && selected !== null && (
              <p className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-success-50 px-4 py-2.5 text-sm font-bold text-success-700" role="status">
                <Icon name="check" className="h-4 w-4" />
                {t('party.locked')}
              </p>
            )}

            {phase === 'reveal' && <PlayerList players={players} myId={myId} title={t('party.scoreboard')} />}
          </div>
        )}

        {/* ── ENDED ── */}
        {phase === 'ended' && (
          <Results players={players} myId={myId} isHost={isHost} onPlayAgain={startGame} />
        )}
      </div>
    </main>
  );
}

type PartyPlayer = { id: string; name: string; avatar: string; score: number; isHost: boolean };

function RankBadge({ rank }: { rank: number }) {
  const tone =
    rank === 1 ? 'bg-amber-100 text-amber-700' : rank === 2 ? 'bg-surface-3 text-fg-soft' : rank === 3 ? 'bg-warning-100 text-warning-700' : 'bg-surface-2 text-fg-faint';
  return (
    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md font-display text-xs font-bold tabular-nums ${tone}`}>
      {rank}
    </span>
  );
}

function PlayerList({ players, myId, title }: { players: PartyPlayer[]; myId: string; title: string }) {
  const t = useT();
  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="font-display text-sm font-bold text-fg">{title}</p>
        <Icon name="users" className="h-4 w-4 text-fg-faint" />
      </div>
      <ol className="divide-y divide-border">
        {players.map((p, i) => {
          const me = p.id === myId;
          return (
            <li key={p.id} className={`flex items-center gap-3 px-4 py-2.5 ${me ? 'bg-brand-50/60' : ''}`}>
              <RankBadge rank={i + 1} />
              <AvatarBadge avatar={p.avatar} className="h-8 w-8 text-lg" rounded="rounded-md" bg="bg-surface-2" />
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate text-sm font-bold text-fg">{p.name}</span>
                {p.isHost && (
                  <span className="badge-warning inline-flex items-center gap-1">
                    <Icon name="crown" className="h-3 w-3" />
                    {t('case.hostLabel')}
                  </span>
                )}
                {me && <span className="text-xs font-semibold text-fg-faint">{t('party.you')}</span>}
              </span>
              <span className="font-display text-sm font-bold tabular-nums text-fg">{p.score}</span>
            </li>
          );
        })}
        {players.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-fg-faint">{t('party.waitHost')}</li>
        )}
      </ol>
    </section>
  );
}

function Results({ players, myId, isHost, onPlayAgain }: { players: PartyPlayer[]; myId: string; isHost: boolean; onPlayAgain: () => void }) {
  const t = useT();
  const winner = players[0];
  const iWon = winner?.id === myId;
  return (
    <div className="relative space-y-4">
      <Confetti />
      <section className="card text-center">
        <p className="eyebrow">{t('party.winner')}</p>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className="mt-3 grid place-items-center"
        >
          {winner?.avatar ? (
            <AvatarBadge avatar={winner.avatar} className="h-20 w-20 text-5xl" rounded="rounded-2xl" bg="bg-amber-50" />
          ) : (
            <span className="grid h-20 w-20 place-items-center rounded-2xl bg-amber-50 text-amber-600">
              <Icon name="trophy" className="h-10 w-10" />
            </span>
          )}
        </motion.div>
        <h1 className="mt-3 font-display text-2xl font-extrabold tracking-tight text-fg">{winner?.name ?? t('party.champion')}</h1>
        <p className="mt-1 text-sm text-fg-soft">{iWon ? t('party.youWon') : t('party.goodGame')}</p>
      </section>

      <AnimatePresence>
        <PlayerList players={players} myId={myId} title={t('party.finalScores')} />
      </AnimatePresence>

      <div className="flex gap-2">
        <Link href="/party" className="btn-secondary flex-1">{t('party.newRoom')}</Link>
        {isHost && (
          <button type="button" onClick={onPlayAgain} className="btn-primary flex-1">
            <Icon name="refresh" className="h-4 w-4" />
            {t('gs.playAgain')}
          </button>
        )}
      </div>
    </div>
  );
}

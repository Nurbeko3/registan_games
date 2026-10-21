'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { TopBar } from '@/components/layout/TopBar';
import { Icon } from '@/components/ui/Icon';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { Confetti } from '@/components/ui/Confetti';
import { EmptyState, PageLoading } from '@/components/ui/Primitives';
import { useGame } from '@/store/useGame';
import { useT } from '@/lib/i18n';
import { useCaseRoom, type CaseRoomPlayer } from '@/lib/caseFiles/useCaseRoom';
import type { CaseMatchResult } from '@/store/useGame';
import { SourcesPane } from './SourcesPane';
import { ChoiceList } from './ChoiceList';
import { Scoreboard, RankBadge, type Standing } from './Scoreboard';
import { ResultsScreen } from './ResultsScreen';
import { CaseBriefing } from './CaseBriefing';
import { CaseMetaBadges } from './CaseMeta';
import { playSfx } from '@/lib/sound';

type Pane = 'sources' | 'question';

interface Props {
  code: string;
  isHost: boolean;
  caseId?: string;
  playerName: string;
}

/**
 * Full phase machine for a Case Files friendly room. Called from /case/[code].
 * Connects via useCaseRoom and renders:
 *   connecting → lobby → investigation → question → reveal → ended
 */
export function CaseRoomScreen({ code, isHost, caseId, playerName }: Props) {
  const t = useT();
  const router = useRouter();

  const caseXp = useGame((s) => s.caseXp);
  const caseMatchEnd = useGame((s) => s.caseMatchEnd);

  const room = useCaseRoom(code, { caseId, isHost, name: playerName || 'Player' });
  const {
    phase,
    players,
    caseDef,
    qIndex,
    total,
    selected,
    lastAnswer,
    revealCorrect,
    results,
    isClassroom,
    myId,
    myResult,
    startInvestigation,
    advanceQuestion,
    advanceReveal,
    endMatch,
    answer,
  } = room;

  const [pane, setPane] = useState<Pane>('question');
  const [copied, setCopied] = useState(false);
  const [settledResult, setSettledResult] = useState<CaseMatchResult | null>(null);
  const settledRef = useRef(false);

  // Best consecutive-correct run, tracked from SERVER-confirmed answer outcomes
  // (lastAnswer.correct comes back from kcq_case_answer — feeds CASE_STREAK_3).
  const streakRef = useRef({ cur: 0, best: 0, lastQ: -1 });
  useEffect(() => {
    if (!lastAnswer || lastAnswer.qIndex === streakRef.current.lastQ) return;
    const s = streakRef.current;
    s.lastQ = lastAnswer.qIndex;
    s.cur = lastAnswer.correct ? s.cur + 1 : 0;
    playSfx(lastAnswer.correct ? 'success' : 'error');
    s.best = Math.max(s.best, s.cur);
  }, [lastAnswer]);

  // Settle locally once when ended + myResult arrives
  useEffect(() => {
    if (phase !== 'ended' || !myResult || settledRef.current) return;
    settledRef.current = true;
    // placement from the score-sorted player list (server-fed via postgres_changes)
    const idx = players.findIndex((p) => p.id === myId);
    const placement = idx >= 0 ? idx + 1 : players.length || 1;
    const res = caseMatchEnd({
      caseId: caseDef?.id ?? '',
      stars: myResult.stars,
      correct: myResult.correctCount,
      total: myResult.totalQ,
      hintsUsed: myResult.hintUsed,
      bestStreak: streakRef.current.best,
      // isClassroom is echoed from the server room row, not a client flag —
      // exactly what the store's classroom-win gate requires.
      mode: isClassroom ? 'classroom' : 'friendly',
      isClassroomConfirmed: isClassroom,
      placement,
    });
    setSettledResult(res);
  }, [phase, myResult, caseDef, caseMatchEnd, isClassroom, players, myId]);

  const copyCode = () => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const myRank = (() => {
    const idx = players.findIndex((p) => p.id === myId);
    return idx >= 0 ? idx + 1 : players.length;
  })();

  const playersAsStandings: Standing[] = players.map((p) => ({
    id: p.id,
    name: p.name,
    emoji: p.isHost ? '👑' : '🧑',
    score: p.score,
    isPlayer: p.id === myId,
    streak: p.id === myId ? streakRef.current.cur : undefined,
  }));

  const currentQ = caseDef?.questions[qIndex] ?? null;
  const isLastQuestion = qIndex + 1 >= total;

  // ── connecting ──────────────────────────────────────────────────────
  if (phase === 'connecting') {
    return (
      <main id="main" className="min-h-screen pb-8">
        <TopBar showBack backHref="/case/friendly" />
        <PageLoading />
      </main>
    );
  }

  // ── error ───────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <main id="main" className="min-h-screen pb-8">
        <TopBar showBack backHref="/case" />
        <div className="mx-auto max-w-md px-4 py-10">
          <EmptyState
            icon="signal"
            tone="danger"
            title={t('case.offline')}
            action={<Link href="/case" className="btn-primary">{t('case.backToCases')}</Link>}
          />
        </div>
      </main>
    );
  }

  // ── lobby ───────────────────────────────────────────────────────────
  if (phase === 'lobby') {
    return (
      <main id="main" className="min-h-screen pb-8">
        <TopBar showBack backHref="/case/friendly" />
        <div className="mx-auto max-w-xl space-y-4 px-4 py-6 sm:px-6">
          {/* Room code */}
          <section className="card text-center">
            <p className="eyebrow">{t('case.roomCode')}</p>
            <p className="mt-3 font-mono text-5xl font-bold tracking-[0.3em] text-fg sm:text-6xl" aria-label={code}>
              {code}
            </p>
            <button type="button" onClick={copyCode} className="btn-secondary btn-sm mt-4">
              <Icon name={copied ? 'check' : 'copy'} className="h-4 w-4" />
              {copied ? t('case.codeCopied') : t('case.copyCode')}
            </button>
          </section>

          {/* Case info */}
          {caseDef && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-xs">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand ring-1 ring-inset ring-brand-100">
                <Icon name="search" className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-sm font-bold text-fg">{caseDef.title}</p>
                <CaseMetaBadges caseDef={caseDef} className="mt-1" />
              </div>
            </div>
          )}

          {/* Player list */}
          <RoomPlayerList players={players} myId={myId} title={t('case.playersN', { n: players.length })} />

          {isHost ? (
            <button
              type="button"
              onClick={startInvestigation}
              disabled={players.length < 1}
              className="btn-primary btn-lg w-full"
            >
              <Icon name="play" className="h-4 w-4" />
              {t('case.startInvestigation')}
            </button>
          ) : (
            <p className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-surface-2 px-4 py-3 text-sm font-semibold text-fg-soft">
              <Icon name="signal" className="h-4 w-4 text-brand" />
              {t('case.waitHost')}
            </p>
          )}

          <Link href="/case/friendly" className="block text-center text-sm font-bold text-fg-faint transition hover:text-fg">
            {t('case.leaveRoom')}
          </Link>
        </div>
      </main>
    );
  }

  // ── investigation ───────────────────────────────────────────────────
  if (phase === 'investigation' && caseDef) {
    return (
      <main id="main" className="min-h-screen pb-8">
        <TopBar showBack backHref="/case/friendly" />
        <div className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-6">
          <CaseBriefing
            title={caseDef.title}
            briefing={caseDef.briefing}
            caseDef={caseDef}
            aside={
              <span className="inline-flex items-center gap-1.5">
                <Icon name="users" className="h-3.5 w-3.5" />
                {t('case.playersN', { n: players.length })}
              </span>
            }
          />

          <p className="flex items-center gap-2 text-sm font-semibold text-fg-soft">
            <Icon name="eye" className="h-4 w-4 text-brand" />
            {t('case.investigateSub')}
          </p>

          <SourcesPane sources={caseDef.sources} />

          {isHost ? (
            <button type="button" onClick={advanceQuestion} className="btn-primary btn-lg w-full">
              {t('case.beginQuestions')}
              <Icon name="arrowRight" className="h-4 w-4" />
            </button>
          ) : (
            <p className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-surface-2 px-4 py-3 text-sm font-semibold text-fg-soft">
              <Icon name="signal" className="h-4 w-4 text-brand" />
              {t('case.waitHostQuestions')}
            </p>
          )}
        </div>
      </main>
    );
  }

  // ── question + reveal ────────────────────────────────────────────────
  if ((phase === 'question' || phase === 'reveal') && caseDef && currentQ) {
    const isReveal = phase === 'reveal';
    const correctIdx = isReveal ? revealCorrect : null;
    const locked = selected !== null || isReveal;

    // On reveal: ring-highlight the source (no passage — publicCase strips it)
    const highlight = isReveal
      ? { sourceId: currentQ.evidenceSourceId, passage: '' }
      : null;

    return (
      <main id="main" className="min-h-screen pb-24">
        <TopBar showBack backHref="/case/friendly" />
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
          {/* Progress row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <p className="truncate font-display text-sm font-bold text-fg">{caseDef.title}</p>
              <span className="badge-neutral shrink-0">{t('case.questionN', { n: qIndex + 1, total })}</span>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-fg-faint">
              <Icon name="users" className="h-3.5 w-3.5" />
              {t('case.playersN', { n: players.length })}
            </span>
          </div>

          {/* Mobile pane toggle */}
          <SegmentedTabs<Pane>
            className="mt-3 lg:hidden"
            ariaLabel={t('case.paneToggle')}
            value={pane}
            onChange={setPane}
            tabs={[
              { value: 'sources', label: t('case.pane.sources'), icon: 'file' },
              { value: 'question', label: t('case.pane.question'), icon: 'search' },
            ]}
          />

          <div className="mt-4 grid items-start gap-5 lg:grid-cols-[1fr_1.1fr]">
            {/* Sources pane */}
            <section
              className={`${pane === 'sources' ? 'block' : 'hidden'} lg:block`}
              aria-label={t('case.pane.sources')}
            >
              <SourcesPane sources={caseDef.sources} highlight={highlight} />
            </section>

            {/* Question pane */}
            <section
              className={`${pane === 'question' ? 'flex' : 'hidden'} flex-col gap-4 lg:flex`}
              aria-label={t('case.pane.question')}
            >
              <div className="card flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand ring-1 ring-inset ring-brand-100">
                      <Icon name="help" className="h-4 w-4" />
                    </span>
                    <p className="eyebrow">{t('case.questionN', { n: qIndex + 1, total })}</p>
                  </div>
                  <div className="flex items-center gap-1" aria-hidden>
                    {Array.from({ length: total }).map((_, i) => (
                      <span key={i} className={`h-1.5 w-4 rounded-full ${i < qIndex ? 'bg-brand' : i === qIndex ? 'bg-brand-300' : 'bg-border'}`} />
                    ))}
                  </div>
                </div>

                {/* Prompt */}
                <p className="font-display text-lg font-extrabold leading-snug tracking-tight text-fg sm:text-xl">
                  {currentQ.prompt}
                </p>

                {/* Choices — multiplayer: onSelect = answer(), reveal driven by host */}
                <ChoiceList
                  choices={currentQ.choices}
                  selected={selected}
                  correctIndex={correctIdx}
                  locked={locked}
                  onSelect={(i) => answer(i)}
                />

                {/* Answer feedback */}
                {!isReveal && selected !== null && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.18 }}
                    className="flex items-center gap-2 rounded-xl border border-brand-100 bg-brand-50 px-3.5 py-2.5 text-sm font-bold text-brand-700 motion-reduce:animate-none motion-reduce:transition-none"
                    role="status"
                  >
                    <Icon name="check" className="h-4 w-4 shrink-0" />
                    {t('case.answerLocked')}
                    {lastAnswer && lastAnswer.correct && (
                      <span className="ml-auto font-bold text-success-700">+{lastAnswer.xp} XP</span>
                    )}
                  </motion.div>
                )}

                {/* Reveal: correct/incorrect + XP */}
                {isReveal && lastAnswer && (
                  <div
                    className={`flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-bold ${
                      lastAnswer.correct
                        ? 'border-success-100 bg-success-50 text-success-700'
                        : 'border-danger-100 bg-danger-50 text-danger-700'
                    }`}
                    role="status"
                  >
                    <Icon name={lastAnswer.correct ? 'checkCircle' : 'x'} className="h-4 w-4 shrink-0" />
                    {lastAnswer.correct ? t('case.correct') : t('case.incorrect')}
                    {lastAnswer.correct && (
                      <span className="ml-auto">+{lastAnswer.xp} XP</span>
                    )}
                  </div>
                )}

                {/* Host controls during reveal */}
                {isReveal && isHost && (
                  <button
                    type="button"
                    onClick={isLastQuestion ? endMatch : advanceQuestion}
                    className="btn-primary w-full"
                  >
                    {isLastQuestion ? t('case.showResults') : t('case.nextQuestion')}
                    <Icon name="arrowRight" className="h-4 w-4" />
                  </button>
                )}
                {isReveal && !isHost && (
                  <p className="text-center text-sm font-semibold text-fg-soft">
                    {t('case.waitHost')}
                  </p>
                )}

                {/* Player host button: advance to reveal */}
                {!isReveal && isHost && selected !== null && (
                  <button type="button" onClick={advanceReveal} className="btn-secondary w-full">
                    {t('case.showResults')}
                  </button>
                )}
              </div>

              {/* Live scoreboard during reveal */}
              {isReveal && <Scoreboard standings={playersAsStandings} />}
            </section>
          </div>
        </div>
      </main>
    );
  }

  // ── ended ────────────────────────────────────────────────────────────
  if (phase === 'ended') {
    if (!myResult || !settledResult || !caseDef) {
      return (
        <main id="main" className="min-h-screen pb-8">
          <TopBar />
          <PageLoading />
        </main>
      );
    }

    return (
      <main id="main" className="relative min-h-screen pb-8">
        <TopBar />
        <Confetti />
        <div className="mx-auto max-w-md space-y-5 px-4 py-6 sm:px-6">
          <ResultsScreen
            caseTitle={caseDef.title}
            result={settledResult}
            score={myResult.score}
            placement={myRank}
            caseXp={caseXp}
            bestStreak={streakRef.current.best}
            correct={myResult.correctCount}
            total={myResult.totalQ}
            onReplay={() => router.push('/case/friendly')}
            onExit={() => router.push('/case')}
          />
          <Scoreboard
            standings={playersAsStandings}
            title={t('case.finalScores')}
          />
        </div>
      </main>
    );
  }

  // Fallback for unexpected phase
  void results;
  return null;
}

/** Player list for the lobby — highlights self, marks the host */
function RoomPlayerList({
  players,
  myId,
  title,
}: {
  players: CaseRoomPlayer[];
  myId: string;
  title: string;
}) {
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
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate text-sm font-bold text-fg">{p.name}</span>
                {p.isHost && (
                  <span className="badge-warning inline-flex items-center gap-1">
                    <Icon name="crown" className="h-3 w-3" />
                    {t('case.hostLabel')}
                  </span>
                )}
                {me && <span className="text-xs font-semibold text-fg-faint">({t('case.you')})</span>}
              </span>
              <span className="font-display text-sm font-bold tabular-nums text-fg">{p.score}</span>
            </li>
          );
        })}
        {players.length === 0 && (
          <li className="px-4 py-6 text-center text-sm text-fg-faint">{t('case.waitHost')}</li>
        )}
      </ol>
    </section>
  );
}

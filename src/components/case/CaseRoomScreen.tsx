'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { TopBar } from '@/components/layout/TopBar';
import { Icon } from '@/components/ui/Icon';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { Confetti } from '@/components/ui/Confetti';
import { useGame } from '@/store/useGame';
import { useT } from '@/lib/i18n';
import { useCaseRoom, type CaseRoomPlayer } from '@/lib/caseFiles/useCaseRoom';
import type { CaseMatchResult } from '@/store/useGame';
import { SourcesPane } from './SourcesPane';
import { ChoiceList } from './ChoiceList';
import { Scoreboard, type Standing } from './Scoreboard';
import { ResultsScreen } from './ResultsScreen';

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

  // Settle locally once when ended + myResult arrives
  useEffect(() => {
    if (phase !== 'ended' || !myResult || settledRef.current) return;
    settledRef.current = true;
    const res = caseMatchEnd({
      caseId: caseDef?.id ?? '',
      stars: myResult.stars,
      correct: myResult.correctCount,
      total: myResult.totalQ,
      hintsUsed: myResult.hintUsed,
      bestStreak: 0,
      mode: 'friendly',
    });
    setSettledResult(res);
  }, [phase, myResult, caseDef, caseMatchEnd]);

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
  }));

  const currentQ = caseDef?.questions[qIndex] ?? null;
  const isLastQuestion = qIndex + 1 >= total;

  // ── connecting ──────────────────────────────────────────────────────
  if (phase === 'connecting') {
    return (
      <main id="main" className="min-h-screen dotted pb-8">
        <TopBar showBack />
        <div className="grid min-h-[60vh] place-items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-grape-100 border-t-grape" />
        </div>
      </main>
    );
  }

  // ── error ───────────────────────────────────────────────────────────
  if (phase === 'error') {
    return (
      <main id="main" className="min-h-screen dotted pb-8">
        <TopBar showBack />
        <div className="mx-auto max-w-md px-4 py-10">
          <div className="card text-center">
            <Icon name="signal" className="mx-auto h-10 w-10 text-grape" />
            <p className="mt-2 font-display font-extrabold">{t('case.offline')}</p>
            <Link href="/case" className="btn-primary mt-4">
              {t('case.backToCases')}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // ── lobby ───────────────────────────────────────────────────────────
  if (phase === 'lobby') {
    return (
      <main id="main" className="min-h-screen dotted pb-8">
        <TopBar showBack />
        <div className="mx-auto max-w-md px-4 py-5 space-y-4">
          {/* Room code */}
          <div className="card text-center">
            <p className="font-bold text-ink-soft">{t('case.roomCode')}</p>
            <p className="my-2 font-display text-5xl font-extrabold tracking-widest text-grape">
              {code}
            </p>
            <button
              type="button"
              onClick={copyCode}
              className="inline-flex items-center gap-2 rounded-xl bg-grape-50 px-4 py-2 text-sm font-extrabold text-grape transition hover:bg-grape-100"
            >
              <Icon name={copied ? 'check' : 'gift'} className="h-4 w-4" />
              {copied ? t('case.codeCopied') : t('case.copyCode')}
            </button>
          </div>

          {/* Case info */}
          {caseDef && (
            <div className="flex items-center gap-3 rounded-2xl bg-grape-50 px-4 py-3">
              <Icon name="search" className="h-5 w-5 shrink-0 text-grape" />
              <div className="min-w-0">
                <p className="truncate font-display font-extrabold text-ink">{caseDef.title}</p>
                <p className="text-xs font-bold text-ink-faint">
                  {caseDef.gradeBand} · {total || caseDef.questions.length} questions
                </p>
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
              className="btn-primary w-full text-lg disabled:opacity-40"
            >
              <Icon name="rocket" className="mr-2 h-5 w-5" />
              {t('case.startInvestigation')}
            </button>
          ) : (
            <p className="inline-flex w-full items-center justify-center gap-2 text-center font-bold text-ink-soft">
              <Icon name="signal" className="h-4 w-4" />
              {t('case.waitHost')}
            </p>
          )}

          <Link href="/case/friendly" className="block text-center text-sm font-bold text-ink-faint">
            {t('case.leaveRoom')}
          </Link>
        </div>
      </main>
    );
  }

  // ── investigation ───────────────────────────────────────────────────
  if (phase === 'investigation' && caseDef) {
    return (
      <main id="main" className="min-h-screen dotted pb-8">
        <TopBar showBack />
        <div className="mx-auto max-w-2xl px-4 py-6 space-y-5">
          <div className="rounded-3xl bg-gradient-to-br from-sky to-grape p-5 text-white shadow-toy">
            <div className="flex items-center gap-2">
              <Icon name="search" className="h-5 w-5" />
              <span className="font-display text-xs font-extrabold uppercase tracking-wide opacity-90">
                {t('case.investigate')}
              </span>
              <span className="ml-auto text-xs font-bold opacity-75">
                {t('case.playersN', { n: players.length })}
              </span>
            </div>
            <h1 className="mt-1 font-display text-2xl font-extrabold">{caseDef.title}</h1>
            <p className="mt-2 font-semibold leading-relaxed text-white/90">{caseDef.briefing}</p>
          </div>

          <p className="flex items-center gap-2 font-bold text-ink-soft">
            <Icon name="eye" className="h-5 w-5 text-grape" />
            {t('case.investigateSub')}
          </p>

          <SourcesPane sources={caseDef.sources} />

          {isHost ? (
            <button
              type="button"
              onClick={advanceQuestion}
              className="btn-primary w-full"
            >
              {t('case.beginQuestions')} <Icon name="rocket" className="ml-1 h-4 w-4" />
            </button>
          ) : (
            <p className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-cloud px-4 py-3 text-center font-bold text-ink-soft">
              <Icon name="signal" className="h-4 w-4" />
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
        <TopBar showBack />
        <div className="game-surface mx-auto max-w-6xl px-4 py-5">
          {/* Progress bar */}
          <div className="flex items-center justify-between text-sm font-bold text-ink-soft">
            <span>{t('case.questionN', { n: qIndex + 1, total })}</span>
            <span>{t('case.playersN', { n: players.length })}</span>
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
              className={`${pane === 'question' ? 'flex' : 'hidden'} lg:flex flex-col gap-4`}
              aria-label={t('case.pane.question')}
            >
              <div className="card flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-grape to-bubble text-white">
                    <Icon name="search" className="h-5 w-5" />
                  </span>
                  <p className="font-display text-xs font-extrabold uppercase tracking-wide text-ink-faint">
                    {t('case.questionN', { n: qIndex + 1, total })}
                  </p>
                </div>

                {/* Prompt */}
                <p className="font-display text-lg font-extrabold leading-snug text-ink">
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
                    className="flex items-center gap-2 rounded-2xl bg-grape-50 px-4 py-2.5 font-display text-sm font-extrabold text-grape motion-reduce:transition-none motion-reduce:animate-none"
                    role="status"
                  >
                    <Icon name="check" className="h-5 w-5" />
                    {t('case.answerLocked')}
                    {lastAnswer && (
                      <span className="ml-auto font-bold text-mint-600">
                        {lastAnswer.correct ? `+${lastAnswer.xp} XP` : ''}
                      </span>
                    )}
                  </motion.div>
                )}

                {/* Reveal: correct/incorrect + XP */}
                {isReveal && lastAnswer && (
                  <div
                    className={`flex items-center gap-2 rounded-2xl px-4 py-2.5 font-display text-sm font-extrabold ${
                      lastAnswer.correct
                        ? 'bg-mint/15 text-mint-600'
                        : 'bg-bubble/10 text-bubble'
                    }`}
                    role="status"
                  >
                    <Icon name={lastAnswer.correct ? 'check' : 'x'} className="h-5 w-5" />
                    {lastAnswer.correct ? t('case.correct') : t('case.incorrect')}
                    {lastAnswer.correct && (
                      <span className="ml-auto text-mint-600">+{lastAnswer.xp} XP</span>
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
                    <Icon name="rocket" className="ml-1 h-4 w-4" />
                  </button>
                )}
                {isReveal && !isHost && (
                  <p className="text-center text-sm font-bold text-ink-soft">
                    {t('case.waitHost')}
                  </p>
                )}

                {/* Player host button: advance to reveal */}
                {!isReveal && isHost && selected !== null && (
                  <button
                    type="button"
                    onClick={advanceReveal}
                    className="btn-ghost w-full"
                  >
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
        <main id="main" className="min-h-screen dotted pb-8">
          <TopBar />
          <div className="grid min-h-[60vh] place-items-center">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-grape-100 border-t-grape" />
          </div>
        </main>
      );
    }

    return (
      <main id="main" className="relative min-h-screen dotted pb-8">
        <TopBar />
        <Confetti />
        <div className="mx-auto max-w-md px-4 py-6 space-y-5">
          <ResultsScreen
            caseTitle={caseDef.title}
            result={settledResult}
            score={myResult.score}
            placement={myRank}
            caseXp={caseXp}
            bestStreak={0}
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
  return null;
}

/** Player list for the lobby — highlights self, crowns host */
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
    <section className="card">
      <p className="font-display font-extrabold">{title}</p>
      <ol className="mt-2 space-y-1.5">
        {players.map((p, i) => (
          <li
            key={p.id}
            className={`flex items-center gap-3 rounded-2xl p-2 ${
              p.id === myId ? 'bg-grape-50 ring-2 ring-grape' : 'bg-cloud'
            }`}
          >
            <span className="w-5 text-center font-display font-extrabold text-ink-faint">
              {i + 1}
            </span>
            <span className="flex-1 truncate font-bold">
              {p.name}
              {p.isHost && (
                <span className="ml-1.5 text-xs font-bold text-mango-600">
                  {t('case.hostLabel')}
                </span>
              )}
              {p.id === myId && (
                <span className="ml-1.5 text-xs text-ink-faint">({t('case.you')})</span>
              )}
            </span>
            <span className="font-display font-extrabold text-grape">{p.score}</span>
          </li>
        ))}
        {players.length === 0 && (
          <li className="py-2 text-center text-sm font-bold text-ink-faint">
            {t('case.waitHost')}
          </li>
        )}
      </ol>
    </section>
  );
}

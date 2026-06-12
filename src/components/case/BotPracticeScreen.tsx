'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { TopBar } from '@/components/layout/TopBar';
import { Icon } from '@/components/ui/Icon';
import { Stars } from '@/components/ui/Bits';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { useGame, useHydrated, type CaseMatchResult } from '@/store/useGame';
import { useT, useLocale } from '@/lib/i18n';
import { CASES, getCase } from '@/data/cases';
import { localizeCase, localizeCaseTitle } from '@/data/cases/i18n';
import type { CaseDef } from '@/data/cases/types';
import { makeBots, botScoreThrough, questionPoints, type Bot } from '@/lib/caseFiles/botEngine';
import { gradeCaseRun, bestStreak } from '@/lib/caseFiles/grading';
import { SourcesPane, evidenceFor } from './SourcesPane';
import { QuestionPane } from './QuestionPane';
import { Scoreboard, type Standing } from './Scoreboard';
import { ResultsScreen } from './ResultsScreen';

type Phase = 'pick' | 'investigate' | 'question' | 'results';
type Pane = 'sources' | 'question';

/**
 * Offline Bot Practice — the first playable, fully-offline Case Files mode.
 * Pick a case → investigate the sources → answer document-grounded questions
 * (sources stay reachable) → results. Bots are cosmetic scoreboard fillers.
 */
export function BotPracticeScreen({ initialCaseId }: { initialCaseId?: string }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const hydrated = useHydrated();
  const caseAnswerCorrect = useGame((s) => s.caseAnswerCorrect);
  const caseMatchEnd = useGame((s) => s.caseMatchEnd);
  const caseXp = useGame((s) => s.caseXp);
  const caseRecords = useGame((s) => s.cases);

  const [phase, setPhase] = useState<Phase>(initialCaseId ? 'investigate' : 'pick');
  const [caseDef, setCaseDef] = useState<CaseDef | null>(initialCaseId ? getCase(initialCaseId) ?? null : null);
  const [pane, setPane] = useState<Pane>('question');

  // Display copy localised to the active language (uz/ru/en). Grading still
  // runs on the canonical `caseDef` — localizeCase preserves answerIndex/order,
  // so scoring is identical across locales. Re-derives if the user switches lang.
  const lc = useMemo(() => (caseDef ? localizeCase(caseDef, locale) : null), [caseDef, locale]);

  // per-match state
  const [bots, setBots] = useState<Bot[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [playerPoints, setPlayerPoints] = useState<number[]>([]);
  const [lastAward, setLastAward] = useState<number | null>(null);
  const [result, setResult] = useState<CaseMatchResult | null>(null);

  const streakRef = useRef(0);
  const qStartRef = useRef(0);

  const startMatch = (c: CaseDef) => {
    setCaseDef(c);
    setBots(makeBots(c.gradeBand, c.questions.length, 3));
    setQIndex(0);
    setSelected(null);
    setRevealed(false);
    setAnswers([]);
    setPlayerPoints([]);
    setLastAward(null);
    setResult(null);
    streakRef.current = 0;
    setPhase('investigate');
  };

  const beginQuestions = () => {
    qStartRef.current = Date.now();
    setPane('question');
    setPhase('question');
  };

  const submit = () => {
    if (selected === null || !caseDef) return;
    const q = caseDef.questions[qIndex];
    const correct = selected === q.answerIndex;
    const elapsed = Date.now() - qStartRef.current;

    if (correct) {
      streakRef.current += 1;
      const award = caseAnswerCorrect(streakRef.current); // live per-answer XP (offline)
      setLastAward(award.xp);
    } else {
      streakRef.current = 0;
      setLastAward(null);
    }
    setAnswers((a) => { const next = [...a]; next[qIndex] = selected; return next; });
    setPlayerPoints((p) => { const next = [...p]; next[qIndex] = questionPoints(correct, elapsed); return next; });
    setRevealed(true);
  };

  const next = () => {
    if (!caseDef) return;
    if (qIndex + 1 >= caseDef.questions.length) {
      settle();
      return;
    }
    setQIndex((i) => i + 1);
    setSelected(null);
    setRevealed(false);
    setLastAward(null);
    setPane('question');
    qStartRef.current = Date.now();
  };

  const settle = () => {
    if (!caseDef) return;
    const grade = gradeCaseRun(caseDef, answers, false); // no hints in Bot Practice MVP
    const streak = bestStreak(grade.perQuestionCorrect);
    const res = caseMatchEnd({
      caseId: caseDef.id,
      stars: grade.stars,
      correct: grade.correct,
      total: grade.total,
      hintsUsed: false,
      bestStreak: streak,
      mode: 'bot',
    });
    setResult(res);
    setPhase('results');
  };

  // ── derived: player display score + standings ──
  const playerScore = playerPoints.reduce((s, p) => s + (p ?? 0), 0);
  const standings: Standing[] = useMemo(() => {
    const upTo = revealed ? qIndex : qIndex - 1;
    const player: Standing = { id: 'you', name: t('case.you'), emoji: '🧑‍💻', score: playerScore, isPlayer: true };
    const botStandings = bots.map((b) => ({
      id: b.id, name: b.name, emoji: b.emoji, score: upTo >= 0 ? botScoreThrough(b, upTo) : 0,
    }));
    return [player, ...botStandings];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bots, playerScore, qIndex, revealed]);

  const placement = useMemo(() => {
    const sorted = [...standings].sort((a, b) => b.score - a.score);
    return sorted.findIndex((s) => s.isPlayer) + 1 || 1;
  }, [standings]);

  // ── render ──
  if (phase === 'pick' || !caseDef || !lc) {
    return (
      <main id="main" className="min-h-screen dotted page-pad-bottom">
        <TopBar showBack />
        <div className="mx-auto max-w-2xl px-4 py-6">
          <Header t={t} />
          <p className="mt-5 font-display text-sm font-extrabold uppercase tracking-wide text-ink-faint">
            {t('case.pickCase')}
          </p>
          <ul className="mt-3 space-y-2">
            {CASES.map((c) => {
              const stars = hydrated ? caseRecords[c.id]?.stars ?? 0 : 0;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => startMatch(c)}
                    className="flex w-full items-center gap-3 rounded-2xl border-2 border-grape-100 bg-white px-4 py-3 text-left transition hover:border-grape-400 hover:shadow-card"
                  >
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sky to-grape text-white">
                      <Icon name="search" className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display font-extrabold text-ink">{localizeCaseTitle(c, locale)}</p>
                      <p className="text-xs font-bold text-ink-faint">
                        {c.gradeBand} · {t(`case.doc.${c.sources[0].kind}`)} · {c.questions.length} ❓
                      </p>
                    </div>
                    <Stars count={stars} size="text-base" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </main>
    );
  }

  if (phase === 'investigate') {
    return (
      <main id="main" className="min-h-screen dotted page-pad-bottom">
        <TopBar showBack />
        <div className="mx-auto max-w-2xl px-4 py-6">
          <div className="rounded-3xl bg-gradient-to-br from-sky to-grape p-5 text-white shadow-toy">
            <div className="flex items-center gap-2">
              <Icon name="search" className="h-5 w-5" />
              <span className="font-display text-xs font-extrabold uppercase tracking-wide opacity-90">
                {t('case.investigate')}
              </span>
            </div>
            <h1 className="mt-1 font-display text-2xl font-extrabold">{lc.title}</h1>
            <p className="mt-2 font-semibold leading-relaxed text-white/90">{lc.briefing}</p>
          </div>

          <p className="mt-5 flex items-center gap-2 font-bold text-ink-soft">
            <Icon name="eye" className="h-5 w-5 text-grape" /> {t('case.investigateSub')}
          </p>

          <div className="mt-3">
            <SourcesPane sources={lc.sources} />
          </div>

          <button type="button" onClick={beginQuestions} className="btn-primary mt-5 w-full">
            {t('case.beginQuestions')} <Icon name="rocket" className="ml-1 h-4 w-4" />
          </button>
        </div>
      </main>
    );
  }

  if (phase === 'results' && result) {
    return (
      <main id="main" className="min-h-screen dotted page-pad-bottom">
        <TopBar showBack />
        <div className="px-4 py-6">
          <ResultsScreen
            caseTitle={lc.title}
            result={result}
            score={playerScore}
            placement={placement}
            caseXp={caseXp}
            bestStreak={bestStreak(gradeCaseRun(caseDef, answers, false).perQuestionCorrect)}
            correct={answers.filter((a, i) => a === caseDef.questions[i].answerIndex).length}
            total={caseDef.questions.length}
            onReplay={() => startMatch(caseDef)}
            onExit={() => router.push('/case')}
          />
        </div>
      </main>
    );
  }

  // phase === 'question' — display from the localised case so the question AND
  // its evidence passage match the localised source bodies shown alongside.
  const q = lc.questions[qIndex];
  const highlight = revealed ? evidenceFor(q) : null;

  return (
    <main id="main" className="min-h-screen pb-24">
      <TopBar showBack />
      <div className="game-surface mx-auto max-w-6xl px-4 py-5">
        {/* mobile pane toggle */}
        <SegmentedTabs<Pane>
          className="lg:hidden"
          ariaLabel={t('case.paneToggle')}
          value={pane}
          onChange={setPane}
          tabs={[
            { value: 'sources', label: t('case.pane.sources'), icon: 'file' },
            { value: 'question', label: t('case.pane.question'), icon: 'search' },
          ]}
        />

        <div className="mt-4 grid items-start gap-5 lg:grid-cols-[1fr_1.1fr]">
          {/* Sources — always reachable during questions (core pedagogy) */}
          <section
            className={`${pane === 'sources' ? 'block' : 'hidden'} lg:block`}
            aria-label={t('case.pane.sources')}
          >
            <SourcesPane sources={lc.sources} highlight={highlight} />
          </section>

          {/* Question + live scoreboard */}
          <section
            className={`${pane === 'question' ? 'flex' : 'hidden'} lg:flex flex-col gap-4`}
            aria-label={t('case.pane.question')}
          >
            <div className="relative">
              {lastAward !== null && revealed && (
                <span className="absolute -top-2 right-2 z-10 rounded-full bg-mint px-2.5 py-1 font-display text-xs font-extrabold text-white shadow-card">
                  +{lastAward} XP
                </span>
              )}
              <QuestionPane
                question={q}
                index={qIndex}
                total={caseDef.questions.length}
                selected={selected}
                revealed={revealed}
                onSelect={setSelected}
                onSubmit={submit}
                onNext={next}
              />
            </div>
            {revealed && <Scoreboard standings={standings} />}
          </section>
        </div>
      </div>
    </main>
  );
}

function Header({ t }: { t: (k: string) => string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-grape-50 text-grape">
        <Icon name="search" className="h-6 w-6" />
      </span>
      <div>
        <h1 className="h-section">{t('case.title')}</h1>
        <p className="text-sm text-ink-soft">{t('case.sub')}</p>
      </div>
    </div>
  );
}

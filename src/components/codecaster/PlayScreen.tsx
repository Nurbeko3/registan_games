'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { TopBar } from '@/components/layout/TopBar';
import { AIMentor } from '@/components/AIMentor';
import { Icon } from '@/components/ui/Icon';
import { DungeonView } from './DungeonView';
import { CodePane, type RunState } from './CodePane';
import { MissionPanel } from './MissionPanel';
import { FeedbackModal, type FeedbackPayload } from './FeedbackModal';
import { DungeonEngine } from '@/lib/codecaster/engine';
import { createRunner } from '@/lib/codecaster/pyrunner';
import type { CodecasterRunner, RunFrame } from '@/lib/codecaster/pyrunner';
import { gradeCodecaster } from '@/lib/codecaster/grading';
import { explainError, type ExplainedError } from '@/lib/codecaster/errors';
import { saveCodecasterProgress, hashCode } from '@/lib/codecaster/cloud';
import { CODECASTER_LEVELS, getLevel } from '@/data/codecaster/levels';
import { commandsForLevel } from '@/data/codecaster/commands';
import { useGame, useHydrated } from '@/store/useGame';
import { useT } from '@/lib/i18n';
import type { EngineState } from '@/lib/codecaster/types';
import type { CodecasterLevel } from '@/data/codecaster/types';

const FRAME_MS = 350;

/** Find the next level in the curriculum sequence, if any. */
function nextLevelId(levelId: string): string | undefined {
  const idx = CODECASTER_LEVELS.findIndex((l) => l.id === levelId);
  if (idx < 0 || idx >= CODECASTER_LEVELS.length - 1) return undefined;
  return CODECASTER_LEVELS[idx + 1]?.id;
}

type Pane = 'world' | 'code';

/**
 * Two-pane Codecaster play screen — the orchestrator.
 *
 * Owns: the editable `code`, the runner instance (created once in a ref), and
 * the currently-displayed `EngineState`. The dungeon's INITIAL board is read
 * from a pure `new DungeonEngine(level).state` (a side-effect-free read of the
 * starting position) so Reset can restore it instantly without re-running Python.
 */
export function PlayScreen({ level }: { level: CodecasterLevel }) {
  const t = useT();
  const shouldReduceMotion = useReducedMotion();
  const reducedMotionSetting = useGame((s) => s.settings.reducedMotion);
  const reduced = shouldReduceMotion || reducedMotionSetting;
  const hydrated = useHydrated();
  const codecasterComplete = useGame((s) => s.codecasterComplete);

  const initialState = useMemo<EngineState>(() => new DungeonEngine(level).state, [level]);
  const levelCommands = useMemo(() => commandsForLevel(level), [level]);

  const [code, setCode] = useState(level.starterCode);
  const [displayState, setDisplayState] = useState<EngineState>(initialState);
  const [runState, setRunState] = useState<RunState>('idle');
  const [output, setOutput] = useState<string[]>([]);
  const [error, setError] = useState<ExplainedError | null>(null);
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackPayload | null>(null);
  const [pane, setPane] = useState<Pane>('world');

  const runnerRef = useRef<CodecasterRunner | null>(null);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runIdRef = useRef(0);

  // Reset all per-attempt state when navigating to a different level.
  useEffect(() => {
    setCode(level.starterCode);
    setDisplayState(initialState);
    setRunState('idle');
    setOutput([]);
    setError(null);
    setHintsRevealed(0);
    setFeedback(null);
    setPane('world');
    runIdRef.current += 1;
    if (animTimerRef.current) clearTimeout(animTimerRef.current);
    runnerRef.current?.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level.id]);

  // Create the runner once (client-only) and dispose on unmount.
  useEffect(() => {
    runnerRef.current = createRunner();
    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current);
      runnerRef.current?.dispose();
      runnerRef.current = null;
    };
  }, []);

  const playFrames = (frames: RunFrame[], finalStatus: EngineState['status'], myRunId: number, onDone: () => void) => {
    if (frames.length === 0 || reduced) {
      const last = frames[frames.length - 1];
      if (last) setDisplayState(last.state);
      onDone();
      return;
    }
    let i = 0;
    const tick = () => {
      if (runIdRef.current !== myRunId) return; // a newer run/reset superseded this animation
      const frame = frames[i];
      if (!frame) { onDone(); return; }
      setDisplayState(frame.state);
      i += 1;
      if (i < frames.length) {
        animTimerRef.current = setTimeout(tick, FRAME_MS);
      } else {
        onDone();
      }
    };
    tick();
  };

  const handleRun = async () => {
    const runner = runnerRef.current;
    if (!runner || runState === 'running') return;

    runIdRef.current += 1;
    const myRunId = runIdRef.current;

    setRunState('running');
    setError(null);
    setOutput([]);
    setFeedback(null);
    setPane('world');

    let result;
    try {
      result = await runner.run(level, code, 1500);
    } catch {
      if (runIdRef.current !== myRunId) return;
      setRunState('error');
      setError(explainError({ kind: 'internal', message: 'internal' }));
      return;
    }
    if (runIdRef.current !== myRunId) return; // superseded by Reset/another Run

    if (!result.ok || result.error) {
      // Show whatever partial frames we have, then the kind error explanation.
      playFrames(result.frames, result.finalStatus, myRunId, () => {
        if (runIdRef.current !== myRunId) return;
        setOutput(result.output);
        setRunState('error');
        if (result.error) setError(explainError(result.error));
      });
      return;
    }

    playFrames(result.frames, result.finalStatus, myRunId, () => {
      if (runIdRef.current !== myRunId) return;
      setOutput(result.output);

      if (result.finalStatus === 'won') {
        setRunState('won');
        const grade = gradeCodecaster(
          { status: result.finalStatus, steps: result.steps, actions: result.actions, code },
          level,
          { hintsUsed: hintsRevealed },
        );
        const completion = codecasterComplete(level.id, grade.stars);
        setFeedback({ kind: 'win', result: completion });
        // Fire-and-forget cloud save — never blocks the UI, no-ops offline.
        void saveCodecasterProgress(level.id, {
          stars: grade.stars,
          steps: grade.steps,
          conceptOk: grade.conceptUsed,
          hintsUsed: hintsRevealed,
          codeHash: hashCode(code),
          commandCount: result.actions.length,
        });
      } else {
        setRunState('lost');
        setFeedback({
          kind: 'retry',
          reasonKey: result.finalStatus === 'lost' ? 'cc.retry.lost' : 'cc.retry.notReached',
        });
      }
    });
  };

  const handleReset = () => {
    runIdRef.current += 1;
    if (animTimerRef.current) clearTimeout(animTimerRef.current);
    runnerRef.current?.cancel();
    setCode(level.starterCode);
    setDisplayState(initialState);
    setRunState('idle');
    setOutput([]);
    setError(null);
    setFeedback(null);
  };

  const handleHint = () => {
    setHintsRevealed((n) => Math.min(level.hints.length, n + 1));
  };

  const closeFeedback = () => setFeedback(null);
  const replay = () => {
    setFeedback(null);
    handleReset();
  };

  const next = nextLevelId(level.id);
  const nextLevel = next ? getLevel(next) : undefined;

  return (
    <div className="min-h-screen pb-24">
      <TopBar showBack />

      <div className="game-surface mx-auto max-w-7xl px-4 py-6">
        <MissionPanel level={level} />

        {/* Phone-only segmented toggle */}
        <div className="mt-4 flex items-center gap-2 lg:hidden" role="tablist" aria-label={t('cc.paneToggle')}>
          <PaneTab active={pane === 'world'} onClick={() => setPane('world')} icon="map" label={t('cc.paneWorld')} />
          <PaneTab active={pane === 'code'} onClick={() => setPane('code')} icon="binary" label={t('cc.paneCode')} />
        </div>

        <div className="mt-4 grid items-start gap-5 lg:grid-cols-[1.3fr_1fr] xl:grid-cols-[1.5fr_1fr]">
          {/* Game arena — its own large, prominent panel */}
          <section
            className={`${pane === 'world' ? 'flex' : 'hidden'} lg:flex flex-col gap-3`}
            aria-label={t('cc.paneWorld')}
          >
            <div className="card flex min-h-[420px] flex-col gap-3 lg:min-h-[560px]">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-sky to-grape text-white">
                  <Icon name="map" className="h-5 w-5" />
                </span>
                <p className="font-display text-base font-extrabold text-ink">{t('cc.arena')}</p>
              </div>
              <div className="flex-1">
                <DungeonView state={displayState} />
              </div>
            </div>
          </section>

          {/* Code pane — its own separate, comfortable panel */}
          <section className={`${pane === 'code' ? 'flex' : 'hidden'} lg:flex flex-col gap-4`} aria-label={t('cc.paneCode')}>
            {hydrated && hintsRevealed > 0 && (
              <div className="card !p-0 overflow-hidden">
                <p className="border-b border-grape-100/60 px-4 py-2 text-xs font-extrabold uppercase tracking-wide text-ink-faint">
                  {t('cc.hintsFromByte')}
                </p>
                <ul className="space-y-2 px-4 py-3">
                  {level.hints.slice(0, hintsRevealed).map((h, i) => (
                    <li key={i} className="flex items-start gap-2 rounded-xl bg-sun/15 px-3 py-2 text-sm font-bold leading-relaxed text-ink-soft whitespace-pre-line">
                      <Icon name="spark" className="mt-0.5 h-4 w-4 shrink-0 text-mango-600" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="card flex flex-1 flex-col gap-3">
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-grape to-bubble text-white">
                  <Icon name="binary" className="h-5 w-5" />
                </span>
                <p className="font-display text-base font-extrabold text-ink">{t('cc.paneCode')}</p>
              </div>
              <CodePane
                code={code}
                onChange={setCode}
                onRun={handleRun}
                onReset={handleReset}
                onHint={handleHint}
                runState={runState}
                output={output}
                error={error}
                hintsRevealed={hintsRevealed}
                hintsTotal={level.hints.length}
                commands={levelCommands}
              />
            </div>
          </section>
        </div>
      </div>

      <AIMentor game="codecaster" />

      <FeedbackModal
        feedback={feedback}
        onReplay={replay}
        onClose={closeFeedback}
        nextLevelId={feedback?.kind === 'win' && feedback.result.stars > 0 ? nextLevel?.id : undefined}
      />
    </div>
  );
}

function PaneTab({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: 'map' | 'binary'; label: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl2 px-4 py-2.5 font-display text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grape focus-visible:ring-offset-2 ${
        active ? 'bg-grape text-white shadow-card' : 'bg-white text-ink-soft ring-1 ring-grape-100/70'
      }`}
    >
      <Icon name={icon} className="h-4 w-4" /> {label}
    </button>
  );
}

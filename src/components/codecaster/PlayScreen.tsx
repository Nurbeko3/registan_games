'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { TopBar } from '@/components/layout/TopBar';
import { useRegisterByte } from '@/lib/mentor/context';
import { Icon } from '@/components/ui/Icon';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
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
  // starterCode is an i18n key — resolve it to the active locale. The per-level
  // reset effect below re-seeds the editor when this changes (level or locale).
  const starter = t(level.starterCode);

  const [code, setCode] = useState(starter);
  const [displayState, setDisplayState] = useState<EngineState>(initialState);
  const [runState, setRunState] = useState<RunState>('idle');
  const [output, setOutput] = useState<string[]>([]);
  const [error, setError] = useState<ExplainedError | null>(null);
  const [hintsRevealed, setHintsRevealed] = useState(0);
  const [feedback, setFeedback] = useState<FeedbackPayload | null>(null);
  const [pane, setPane] = useState<Pane>('world');

  // Expose this level's live context to the site-wide Byte assistant, so its
  // "Hint" action reasons about the student's actual code/error/objective.
  useRegisterByte('codecaster', () => ({
    level: level.id,
    objective: t(level.objective),
    code,
    error: error ? t(error.bodyKey, error.vars) : undefined,
  }));

  const runnerRef = useRef<CodecasterRunner | null>(null);
  const animTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const runIdRef = useRef(0);

  // Reset all per-attempt state when navigating to a different level, or when
  // the locale resolves/changes (so the seeded starter code is localized too).
  useEffect(() => {
    setCode(starter);
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
  }, [level.id, starter]);

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
    setCode(starter);
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
    <div className="min-h-screen pb-24 md:pb-10">
      <TopBar showBack backHref="/quest" />

      <div className="game-surface mx-auto max-w-7xl px-4 py-5 sm:px-6">
        <MissionPanel level={level} />

        {/* Phone-only segmented toggle */}
        <SegmentedTabs
          className="mt-4 lg:hidden"
          ariaLabel={t('cc.paneToggle')}
          value={pane}
          onChange={setPane}
          tabs={[
            { value: 'world', label: t('cc.paneWorld'), icon: 'map' },
            { value: 'code', label: t('cc.paneCode'), icon: 'binary' },
          ]}
        />

        <div className="panel mt-4 grid items-stretch overflow-hidden lg:grid-cols-[1.3fr_1fr] lg:divide-x lg:divide-border xl:grid-cols-[1.5fr_1fr]">
          {/* Game arena */}
          <section
            className={`${pane === 'world' ? 'flex' : 'hidden'} min-w-0 flex-col lg:flex`}
            aria-label={t('cc.paneWorld')}
          >
            <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-info-50 text-info-600">
                <Icon name="map" className="h-4 w-4" />
              </span>
              <p className="font-display text-sm font-bold text-fg">{t('cc.arena')}</p>
            </div>
            <div className="flex min-h-[420px] flex-1 flex-col p-4 lg:min-h-[560px]">
              <DungeonView state={displayState} />
            </div>
          </section>

          {/* Code pane */}
          <section className={`${pane === 'code' ? 'flex' : 'hidden'} min-w-0 flex-col lg:flex`} aria-label={t('cc.paneCode')}>
            <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand">
                <Icon name="binary" className="h-4 w-4" />
              </span>
              <p className="font-display text-sm font-bold text-fg">{t('cc.paneCode')}</p>
              <span className="ml-auto font-mono text-2xs font-semibold text-fg-faint">main.py</span>
            </div>

            {hydrated && hintsRevealed > 0 && (
              <div className="border-b border-border bg-amber-50/60 px-4 py-3 dark:bg-amber-50/30">
                <p className="eyebrow">{t('cc.hintsFromByte')}</p>
                <ul className="mt-2 space-y-1.5">
                  {level.hints.slice(0, hintsRevealed).map((h, i) => (
                    <li key={i} className="flex items-start gap-2 whitespace-pre-line text-sm font-medium leading-relaxed text-fg-soft">
                      <Icon name="spark" className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                      <span>{t(h)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-1 flex-col p-4">
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

      <FeedbackModal
        feedback={feedback}
        onReplay={replay}
        onClose={closeFeedback}
        nextLevelId={feedback?.kind === 'win' && feedback.result.stars > 0 ? nextLevel?.id : undefined}
      />
    </div>
  );
}

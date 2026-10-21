'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { TopBar } from '@/components/layout/TopBar';
import { useRegisterByte } from '@/lib/mentor/context';
import { Icon } from '@/components/ui/Icon';
import { SegmentedTabs } from '@/components/ui/SegmentedTabs';
import { DungeonView } from './DungeonView';
import { CodePane, type CursorPos, type RunState } from './CodePane';
import { MissionBrief, MissionPanel } from './MissionPanel';
import { FeedbackModal, type FeedbackPayload } from './FeedbackModal';
import { BlocksPane } from './BlocksPane';
import { ActivityBar, type SideView } from './studio/ActivityBar';
import { SidePanel } from './studio/SidePanel';
import { EditorTabs, type EditorTab } from './studio/EditorTabs';
import { BottomPanel, type BottomTab } from './studio/BottomPanel';
import { StatusBar } from './studio/StatusBar';
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
import { playSfx, playStars } from '@/lib/sound';
import type { EngineState } from '@/lib/codecaster/types';
import type { CodecasterLevel } from '@/data/codecaster/types';

const FRAME_MS = 350;

/** Find the next level in the curriculum sequence, if any. */
function nextLevelId(levelId: string): string | undefined {
  const idx = CODECASTER_LEVELS.findIndex((l) => l.id === levelId);
  if (idx < 0 || idx >= CODECASTER_LEVELS.length - 1) return undefined;
  return CODECASTER_LEVELS[idx + 1]?.id;
}

type Pane = 'world' | 'code' | 'blocks';

/**
 * Code Studio — the Codecaster play screen, laid out like a small IDE on
 * desktop (activity bar · side panel · editor tabs · bottom panel · status
 * bar, with the dungeon beside the code) and as a World | Code | Blocks
 * segmented view on phones. This component owns the orchestration: the
 * editable `code`, the runner instance (created once in a ref), and the
 * currently-displayed `EngineState`. The dungeon's INITIAL board is read from
 * a pure `new DungeonEngine(level).state` so Reset can restore it instantly
 * without re-running Python.
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

  // ── studio chrome state ──
  const [pane, setPane] = useState<Pane>('world'); // phones
  const [sideView, setSideView] = useState<SideView>('explorer');
  const [sideOpen, setSideOpen] = useState(true);
  const [tabs, setTabs] = useState<EditorTab[]>(['main']);
  const [tab, setTab] = useState<EditorTab>('main');
  const [bottomTab, setBottomTab] = useState<BottomTab>('terminal');
  const [bottomOpen, setBottomOpen] = useState(true);
  const [cursor, setCursor] = useState<CursorPos>({ line: 1, col: 1 });
  const [savedFlash, setSavedFlash] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setTabs(['main']);
    setTab('main');
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
      if (savedTimer.current) clearTimeout(savedTimer.current);
      runnerRef.current?.dispose();
      runnerRef.current = null;
    };
  }, []);

  const playFrames = (frames: RunFrame[], myRunId: number, onDone: () => void) => {
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

    playSfx('click');
    runIdRef.current += 1;
    const myRunId = runIdRef.current;

    setRunState('running');
    setError(null);
    setOutput([]);
    setFeedback(null);
    setPane('world');
    setBottomTab('terminal');

    let result;
    try {
      result = await runner.run(level, code, 1500);
    } catch {
      if (runIdRef.current !== myRunId) return;
      setRunState('error');
      setError(explainError({ kind: 'internal', message: 'internal' }));
      setBottomTab('problems');
      setBottomOpen(true);
      playSfx('error');
      return;
    }
    if (runIdRef.current !== myRunId) return; // superseded by Reset/another Run

    if (!result.ok || result.error) {
      // Show whatever partial frames we have, then the kind error explanation.
      playFrames(result.frames, myRunId, () => {
        if (runIdRef.current !== myRunId) return;
        setOutput(result.output);
        setRunState('error');
        if (result.error) setError(explainError(result.error));
        setBottomTab('problems');
        setBottomOpen(true);
        playSfx('error');
      });
      return;
    }

    playFrames(result.frames, myRunId, () => {
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
        playSfx('success');
        playStars(grade.stars);
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
        playSfx('error');
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

  // Mod+S: nothing to persist (the level keeps your code in memory) — flash
  // "Saved" so the muscle memory is answered instead of the browser's dialog.
  const handleSave = () => {
    setSavedFlash(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSavedFlash(false), 1200);
  };

  const openTab = (next: EditorTab) => {
    setTabs((list) => (list.includes(next) ? list : [...list, next]));
    setTab(next);
  };
  const closeTab = (closing: EditorTab) => {
    setTabs((list) => list.filter((x) => x !== closing));
    if (tab === closing) setTab('main');
  };
  const selectSide = (view: SideView) => {
    if (sideOpen && sideView === view) { setSideOpen(false); return; }
    setSideView(view);
    setSideOpen(true);
    if (view === 'blocks') openTab('blocks');
  };

  const closeFeedback = () => setFeedback(null);
  const replay = () => {
    setFeedback(null);
    handleReset();
  };

  const next = nextLevelId(level.id);
  const nextLevel = next ? getLevel(next) : undefined;
  const running = runState === 'running';

  // The Blocks pane stays mounted (hidden) so a student's block stack survives
  // switching to the code tab and back.
  const blocksPane = (
    <BlocksPane level={level} onCodeChange={setCode} disabled={running} resetKey={level.id} />
  );

  const editorArea = (showPalette: boolean) => (
    <>
      <div className={`${tab === 'main' ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col`}>
        <CodePane
          code={code}
          onChange={setCode}
          onRun={() => { void handleRun(); }}
          onSave={handleSave}
          onCursor={setCursor}
          running={running}
          commands={levelCommands}
          showPalette={showPalette}
        />
      </div>
      <div className={`${tab === 'readme' ? 'block' : 'hidden'} min-h-0 flex-1 overflow-y-auto p-4`}>
        <p className="eyebrow mb-2">{t('studio.readme')}</p>
        <MissionBrief level={level} compact />
      </div>
      <div className={`${tab === 'blocks' ? 'block' : 'hidden'} min-h-0 flex-1 overflow-y-auto p-4`}>
        <p className="mb-3 text-sm text-fg-soft">{t('blocks.hint')}</p>
        {blocksPane}
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col pb-20 lg:pb-0">
      <TopBar showBack backHref="/quest" />

      {/* ───────── Desktop: IDE frame ───────── */}
      <div className="hidden min-h-0 flex-1 flex-col lg:flex">
        <div className="flex h-8 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 text-xs">
          <Icon name="binary" className="h-3.5 w-3.5 text-brand" />
          <span className="font-display font-bold text-fg">{t('studio.editorTitle')}</span>
          <span className="text-fg-faint">·</span>
          <span className="truncate text-fg-soft">{t(level.title)}</span>
          <span className="ml-auto font-mono text-2xs text-fg-faint">{level.id}</span>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[auto_1fr] xl:grid-cols-[auto_1fr_minmax(380px,0.75fr)]">
          {/* activity bar + side panel */}
          <div className="flex min-h-0">
            <ActivityBar active={sideView} open={sideOpen} onSelect={selectSide} hintBadge={hintsRevealed || undefined} />
            {sideOpen && (
              <SidePanel
                view={sideView}
                level={level}
                activeTab={tab}
                onOpenTab={openTab}
                hintsRevealed={hintsRevealed}
                onHint={handleHint}
              />
            )}
          </div>

          {/* editor column */}
          <div className="flex min-h-[640px] min-w-0 flex-col border-r border-border bg-surface">
            <EditorTabs tabs={tabs} active={tab} onSelect={setTab} onClose={closeTab} onRun={() => { void handleRun(); }} onReset={handleReset} running={running} />
            {/* breadcrumb */}
            <div className="flex h-7 shrink-0 items-center gap-1 border-b border-border px-3 font-mono text-2xs text-fg-faint">
              <span>{t('studio.project')}</span>
              <Icon name="chevronRight" className="h-3 w-3" />
              <span className="text-fg-soft">{tab === 'main' ? 'main.py' : tab === 'readme' ? 'README.md' : t('studio.blocks')}</span>
            </div>
            <div className="flex min-h-[360px] min-w-0 flex-1 flex-col">{editorArea(true)}</div>
            <BottomPanel tab={bottomTab} onTab={setBottomTab} open={bottomOpen} onToggle={() => setBottomOpen((o) => !o)} output={output} error={error} />
            <StatusBar runState={runState} line={cursor.line} col={cursor.col} savedFlash={savedFlash} problems={error ? 1 : 0} />
          </div>

          {/* world — beside the editor on xl, below it on lg */}
          <section className="col-span-2 flex min-h-[420px] flex-col border-t border-border bg-surface xl:col-span-1 xl:border-t-0" aria-label={t('cc.paneWorld')}>
            <div className="flex h-10 shrink-0 items-center gap-2.5 border-b border-border px-4">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-info-50 text-info-600">
                <Icon name="map" className="h-4 w-4" />
              </span>
              <p className="font-display text-sm font-bold text-fg">{t('cc.arena')}</p>
              <span className={`ml-auto ${runState === 'won' ? 'badge-success' : runState === 'error' ? 'badge-danger' : runState === 'lost' ? 'badge-warning' : runState === 'running' ? 'badge-brand' : 'badge-neutral'}`}>
                {runState === 'idle' ? t('studio.ready') : runState === 'running' ? t('cc.running') : runState === 'won' ? t('studio.won') : runState === 'lost' ? t('studio.lost') : t('studio.errorState')}
              </span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col p-4">
              <DungeonView state={displayState} />
            </div>
          </section>
        </div>
      </div>

      {/* ───────── Phone / tablet ───────── */}
      <div className="game-surface mx-auto w-full max-w-3xl px-4 py-4 lg:hidden">
        <MissionPanel level={level} />

        <SegmentedTabs
          className="mt-4"
          ariaLabel={t('cc.paneToggle')}
          value={pane}
          onChange={(p) => { setPane(p); if (p === 'blocks') openTab('blocks'); else if (p === 'code') setTab('main'); }}
          tabs={[
            { value: 'world', label: t('cc.paneWorld'), icon: 'map' },
            { value: 'code', label: t('cc.paneCode'), icon: 'binary' },
            { value: 'blocks', label: t('blocks.mode'), icon: 'blocks' },
          ]}
        />

        <div className="panel mt-4 overflow-hidden">
          {pane === 'world' && (
            <section className="flex min-h-[380px] flex-col p-4" aria-label={t('cc.paneWorld')}>
              <DungeonView state={displayState} />
            </section>
          )}

          {pane !== 'world' && (
            <section className="flex flex-col" aria-label={t('cc.paneCode')}>
              <EditorTabs
                tabs={pane === 'blocks' ? ['blocks'] : ['main']}
                active={pane === 'blocks' ? 'blocks' : 'main'}
                onSelect={() => {}}
                onClose={() => {}}
                onRun={() => { void handleRun(); }}
                onReset={handleReset}
                running={running}
              />
              {pane === 'code' ? (
                <div className="flex min-h-[320px] flex-col">
                  <CodePane
                    code={code}
                    onChange={setCode}
                    onRun={() => { void handleRun(); }}
                    onSave={handleSave}
                    running={running}
                    commands={levelCommands}
                    height="320px"
                  />
                </div>
              ) : (
                <div className="space-y-3 p-4">
                  <p className="text-sm text-fg-soft">{t('blocks.hint')}</p>
                  {blocksPane}
                </div>
              )}

              {hydrated && hintsRevealed > 0 && (
                <div className="border-t border-border bg-amber-50/60 px-4 py-3 dark:bg-amber-50/30">
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
              <div className="border-t border-border px-4 py-2.5">
                <button type="button" onClick={handleHint} disabled={hintsRevealed >= level.hints.length} className="btn-subtle btn-sm gap-1.5 text-amber-700">
                  <Icon name="lightbulb" className="h-4 w-4" /> {t('cc.hint')}{hintsRevealed > 0 ? ` (${hintsRevealed}/${level.hints.length})` : ''}
                </button>
              </div>
              <BottomPanel tab={bottomTab} onTab={setBottomTab} open={bottomOpen} onToggle={() => setBottomOpen((o) => !o)} output={output} error={error} />
              <StatusBar runState={runState} line={cursor.line} col={cursor.col} savedFlash={savedFlash} problems={error ? 1 : 0} />
            </section>
          )}
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

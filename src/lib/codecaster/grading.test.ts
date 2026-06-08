/**
 * grading.ts — anti-cheat / reward-gate hardening tests.
 *
 * gradeCodecaster is the sole reward gate for Codecaster: it must NEVER trust
 * the client's claimed `status`, and must never award stars for a run that
 * does not actually win when replayed deterministically through the engine.
 *
 * These tests build small synthetic LevelDefs (mirroring engine.test.ts's
 * ASCII-map convention) and drive `gradeCodecaster` directly — the same
 * "submit {status, steps, actions, code}" shape a malicious client would send.
 */

import { describe, it, expect } from 'vitest';
import { gradeCodecaster } from './grading';
import type { Command, GameStatus } from './types';
import type { CodecasterLevel } from '@/data/codecaster/types';

// ── tiny level builder (mirrors engine.test.ts's ASCII convention) ───────────

function makeLevel(over: Partial<CodecasterLevel> = {}): CodecasterLevel {
  const base: CodecasterLevel = {
    id: 'TEST',
    cols: 4,
    rows: 1,
    tiles: [['floor', 'floor', 'floor', 'goal']],
    entities: [],
    heroStart: { x: 0, y: 0 },
    heroFacing: 'right',
    heroHp: 3,
    victory: { reachGoal: true },
    maxSteps: 20,
    // curriculum metadata (irrelevant to the engine, required by the type)
    title: 'Test Level',
    band: 'A',
    concept: 'test',
    objective: 'test',
    starterCode: '',
    parSteps: 3,
    requireConcept: null,
    hints: ['', '', ''],
    commands: ['moveRight'],
  };
  return { ...base, ...over };
}

const right = (n: number): Command[] => Array.from({ length: n }, () => ({ op: 'move', dir: 'right' }) as Command);
const collect = (): Command => ({ op: 'collect' });
const useKey = (): Command => ({ op: 'useKey' });
const say = (text: string): Command => ({ op: 'say', text });

// A trace that wins L-shaped "TEST" level (4 cols, reachGoal at x=3) in 3 steps.
const WINNING_ACTIONS = right(3);

describe('gradeCodecaster — anti-cheat: replay overrides claimed status', () => {
  it('AC-01: a LOSING run (status "lost") never yields stars > 0, even if actions happen to win on replay (engine is authoritative either way)', () => {
    const level = makeLevel();
    // Claimed status is a lie in the OTHER direction: client says "lost" but
    // actions actually win. The engine replay is authoritative — it should win.
    const grade = gradeCodecaster(
      { status: 'lost', steps: 3, actions: WINNING_ACTIONS, code: 'hero.moveRight()' },
      level,
      { hintsUsed: 0 },
    );
    // Replay shows a genuine win — the claimed 'lost' status must NOT suppress it.
    expect(grade.won).toBe(true);
    expect(grade.stars).toBeGreaterThan(0);
  });

  it('AC-02: client claims status "won" but the actions do NOT reach the goal → 0 stars (replay overrides the lie)', () => {
    const level = makeLevel();
    const losingActions = right(1); // only one step — goal is 3 tiles away
    const grade = gradeCodecaster(
      { status: 'won', steps: 99, actions: losingActions, code: 'hero.moveRight()' },
      level,
      { hintsUsed: 0 },
    );
    expect(grade.won).toBe(false);
    expect(grade.stars).toBe(0);
  });

  it('AC-03: client claims status "playing" (never finished) but actions DO win on replay → engine replay still grants the win/stars (claimed status is irrelevant either way)', () => {
    const level = makeLevel();
    const grade = gradeCodecaster(
      { status: 'playing', steps: 1, actions: WINNING_ACTIONS, code: 'hero.moveRight()' },
      level,
      { hintsUsed: 0 },
    );
    expect(grade.won).toBe(true);
    expect(grade.stars).toBeGreaterThan(0);
  });

  it('AC-04: empty actions array can never win or earn stars regardless of claimed status/steps', () => {
    const level = makeLevel();
    for (const claimed of ['won', 'lost', 'playing'] satisfies GameStatus[]) {
      const grade = gradeCodecaster(
        { status: claimed, steps: 1000, actions: [], code: '' },
        level,
        { hintsUsed: 0 },
      );
      expect(grade.won).toBe(false);
      expect(grade.stars).toBe(0);
    }
  });

  it('AC-05: a fabricated huge `steps` count in the input does not influence the grade — `gradeCodecaster` recomputes steps from the replay', () => {
    // requireConcept gate that the trace will NOT satisfy, so we can isolate
    // the "steps reported" assertion from the concept/star-3 logic.
    const level = makeLevel({ parSteps: 3, requireConcept: 'useKey' });
    const grade = gradeCodecaster(
      { status: 'won', steps: 1, actions: WINNING_ACTIONS, code: 'hero.moveRight()' }, // claims steps=1 (would be "under par")
      level,
      { hintsUsed: 0 },
    );
    // Real replay used 3 steps (== parSteps) → reported correctly, not the lied "1".
    expect(grade.steps).toBe(3);
    expect(grade.stars).toBe(2); // win at-or-under par, concept gate not met → capped at 2
  });

  it('AC-06: actions that overshoot maxSteps lose on replay → 0 stars, even if client claims "won" with a short step count', () => {
    const level = makeLevel({ maxSteps: 2 }); // goal needs 3 steps but cap is 2
    const grade = gradeCodecaster(
      { status: 'won', steps: 3, actions: WINNING_ACTIONS, code: 'hero.moveRight()' },
      level,
      { hintsUsed: 0 },
    );
    expect(grade.won).toBe(false);
    expect(grade.stars).toBe(0);
  });

  it('AC-07: a trace that wins a DIFFERENT (mismatched) level layout does not fool grading — replay runs against the canonical level passed in', () => {
    // "WINNING_ACTIONS" (right x3) walks the hero straight into a wall one tile
    // to its right on THIS level — it never reaches the goal at x=3.
    const blockedLevel = makeLevel({
      cols: 4,
      tiles: [['floor', 'wall', 'floor', 'goal']],
      victory: { reachGoal: true },
    });
    const grade = gradeCodecaster(
      { status: 'won', steps: 3, actions: WINNING_ACTIONS, code: 'hero.moveRight()' },
      blockedLevel,
      { hintsUsed: 0 },
    );
    expect(grade.won).toBe(false);
    expect(grade.stars).toBe(0);
  });
});

describe('gradeCodecaster — star boundary correctness', () => {
  it('GB-01: win exactly AT par earns at least ⭐⭐ (under-or-equal-par rule, off-by-one boundary)', () => {
    // requireConcept null → conceptUsed defaults true → at-par + no hints + concept ⇒ all 3 conditions of star 3 hold.
    // To isolate the PAR boundary itself (>= 2, i.e. "under-par achieved"), use
    // a concept gate the trace won't satisfy so we can read off star===2 cleanly.
    const level = makeLevel({ parSteps: 3, requireConcept: 'useKey' });
    const grade = gradeCodecaster(
      { status: 'won', steps: 3, actions: right(3), code: '' },
      level,
      { hintsUsed: 0 },
    );
    expect(grade.steps).toBe(3);
    expect(grade.stars).toBe(2); // at par counts as "under or equal par" → star 2
  });

  it('GB-01b: with NO concept gate, an at-par hint-free win earns the full ⭐⭐⭐ (confirms "underPar" includes equality)', () => {
    const level = makeLevel({ parSteps: 3, requireConcept: null });
    const grade = gradeCodecaster(
      { status: 'won', steps: 3, actions: right(3), code: '' },
      level,
      { hintsUsed: 0 },
    );
    expect(grade.steps).toBe(3);
    expect(grade.stars).toBe(3);
  });

  it('GB-02: win ONE step OVER par earns only ⭐ (boundary the other side)', () => {
    // Add a detour: wait once before moving, costing one extra step (still wins).
    const level = makeLevel({ parSteps: 3, requireConcept: null });
    const grade = gradeCodecaster(
      { status: 'won', steps: 4, actions: [{ op: 'wait' }, ...right(3)], code: '' },
      level,
      { hintsUsed: 0 },
    );
    expect(grade.steps).toBe(4);
    expect(grade.stars).toBe(1);
  });

  it('GB-03: win under par WITH concept but hintsUsed > 0 caps at ⭐⭐ (hint honesty rule)', () => {
    const level = makeLevel({ parSteps: 3, requireConcept: 'sequence' });
    const grade = gradeCodecaster(
      { status: 'won', steps: 3, actions: right(3), code: 'hero.moveRight()\nhero.moveRight()\nhero.moveRight()' },
      level,
      { hintsUsed: 1 },
    );
    expect(grade.conceptUsed).toBe(true);
    expect(grade.stars).toBe(2); // capped — no 3rd star with hints
  });

  it('GB-04: win under par, no hints, but concept NOT demonstrated caps at ⭐⭐ (brute force gets no 3rd star)', () => {
    const level = makeLevel({ parSteps: 3, requireConcept: 'useKey' }); // requires a useKey op in the trace
    const grade = gradeCodecaster(
      { status: 'won', steps: 3, actions: right(3), code: 'hero.moveRight()\nhero.moveRight()\nhero.moveRight()' },
      level,
      { hintsUsed: 0 },
    );
    expect(grade.conceptUsed).toBe(false);
    expect(grade.stars).toBe(2);
  });

  it('GB-05: a losing run never yields more than 0 stars regardless of par/concept/hints inputs', () => {
    const level = makeLevel({ parSteps: 99, requireConcept: null });
    const grade = gradeCodecaster(
      { status: 'won', steps: 1, actions: right(1), code: '' }, // doesn't reach the goal
      level,
      { hintsUsed: 0 },
    );
    expect(grade.won).toBe(false);
    expect(grade.stars).toBe(0);
    expect(grade.steps).toBe(1); // still reports the real (losing) replay step count
  });

  it('GB-06: win + under par + concept + zero hints earns the full ⭐⭐⭐', () => {
    const level = makeLevel({ parSteps: 3, requireConcept: 'sequence' });
    const grade = gradeCodecaster(
      { status: 'won', steps: 3, actions: right(3), code: 'hero.moveRight()\nhero.moveRight()\nhero.moveRight()' },
      level,
      { hintsUsed: 0 },
    );
    expect(grade.stars).toBe(3);
  });
});

describe('gradeCodecaster — concept gate: command-trace concepts derived from ACTIONS, not claims', () => {
  it('CT-01: "collect" concept requires an actual collect op in the replayed trace, not just code text mentioning it', () => {
    const level = makeLevel({
      cols: 4,
      tiles: [['floor', 'floor', 'floor', 'goal']],
      entities: [{ id: 'coin-0', kind: 'coin', pos: { x: 1, y: 0 } }],
      victory: { reachGoal: true },
      parSteps: 5,
      requireConcept: 'collect',
    });
    // Code TEXT mentions collect, but the action trace never actually calls it
    // (walks past the coin without collecting — e.g. client forged the code field).
    const grade = gradeCodecaster(
      { status: 'won', steps: 3, actions: right(3), code: '# hero.collect()\nhero.moveRight()\nhero.moveRight()\nhero.moveRight()' },
      level,
      { hintsUsed: 0 },
    );
    expect(grade.won).toBe(true);
    expect(grade.conceptUsed).toBe(false); // no 'collect' op in the realized trace
    expect(grade.stars).toBe(2); // capped — concept not actually demonstrated
  });

  it('CT-02: "collect_multi" requires >= 3 collect ops; exactly 2 does not satisfy it (off-by-one)', () => {
    const level = makeLevel({
      cols: 5,
      tiles: [['floor', 'floor', 'floor', 'floor', 'goal']],
      entities: [
        { id: 'coin-0', kind: 'coin', pos: { x: 1, y: 0 } },
        { id: 'coin-1', kind: 'coin', pos: { x: 2, y: 0 } },
      ],
      victory: { reachGoal: true },
      parSteps: 6,
      requireConcept: 'collect_multi',
    });
    const actions: Command[] = [
      { op: 'move', dir: 'right' }, collect(),
      { op: 'move', dir: 'right' }, collect(),
      { op: 'move', dir: 'right' },
      { op: 'move', dir: 'right' },
    ];
    const grade = gradeCodecaster({ status: 'won', steps: 6, actions, code: '' }, level, { hintsUsed: 0 });
    expect(grade.won).toBe(true);
    expect(grade.conceptUsed).toBe(false); // only 2 collects, needs >= 3
    expect(grade.stars).toBe(2);
  });

  it('CT-03: "useKey" concept requires the replay to actually OPEN a door — a whiffed useKey call (no key/door) does NOT count', () => {
    // Tightened (anti-cheat): evalConcept for 'useKey' is now outcome-based — it
    // requires the deterministic replay to emit a 'door' GameEvent, so spamming
    // a no-op hero.useKey() on a doorless level can't farm the concept badge.
    const level = makeLevel({
      cols: 4,
      tiles: [['floor', 'floor', 'floor', 'goal']],
      entities: [],
      victory: { reachGoal: true },
      parSteps: 5,
      requireConcept: 'useKey',
    });
    const actions: Command[] = [useKey(), { op: 'move', dir: 'right' }, { op: 'move', dir: 'right' }, { op: 'move', dir: 'right' }];
    const grade = gradeCodecaster({ status: 'won', steps: 4, actions, code: '' }, level, { hintsUsed: 0 });
    expect(grade.won).toBe(true);
    expect(grade.conceptUsed).toBe(false); // whiffed useKey opened no door → no concept
    expect(grade.stars).toBe(2); // win + under par, but capped without the concept
  });

  it('CT-03b: "useKey" concept IS earned when the run actually opens a door', () => {
    // key at x=1, closed door at x=2, goal at x=3. Pick up key, open door, walk through.
    const level = makeLevel({
      cols: 4,
      tiles: [['floor', 'floor', 'door', 'goal']],
      entities: [{ id: 'k1', kind: 'key', pos: { x: 1, y: 0 } }],
      victory: { reachGoal: true },
      parSteps: 8,
      requireConcept: 'useKey',
    });
    const actions: Command[] = [
      { op: 'move', dir: 'right' }, // onto key
      { op: 'collect' }, // pick up key
      useKey(), // facing right → opens door at x=2
      { op: 'move', dir: 'right' }, // onto former door
      { op: 'move', dir: 'right' }, // onto goal
    ];
    const grade = gradeCodecaster({ status: 'won', steps: 5, actions, code: '' }, level, { hintsUsed: 0 });
    expect(grade.won).toBe(true);
    expect(grade.conceptUsed).toBe(true); // a real door was opened
  });

  it('CT-04: "say" concept requires an actual say op in the trace', () => {
    const level = makeLevel({ parSteps: 5, requireConcept: 'say' });
    const noSay = gradeCodecaster(
      { status: 'won', steps: 3, actions: right(3), code: 'hero.say("open")' }, // code claims it; trace doesn't
      level, { hintsUsed: 0 },
    );
    expect(noSay.conceptUsed).toBe(false);

    const withSay = gradeCodecaster(
      { status: 'won', steps: 4, actions: [say('open'), ...right(3)], code: 'hero.say("open")' },
      level, { hintsUsed: 0 },
    );
    expect(withSay.conceptUsed).toBe(true);
  });

  it('CT-05: "boss_defeat" requires an actual win on a defeatBoss level — cannot be faked by code text or non-boss wins', () => {
    const bossLevel = makeLevel({
      cols: 4,
      tiles: [['floor', 'floor', 'floor', 'goal']],
      entities: [{ id: 'boss-0', kind: 'boss', pos: { x: 1, y: 0 }, hp: 1 }],
      victory: { defeatBoss: true, reachGoal: true },
      parSteps: 6,
      requireConcept: 'boss_defeat',
      heroFacing: 'right',
    });
    // Win without ever fighting the boss is impossible here (boss blocks the path),
    // so prove the gate via a genuine defeat vs. a non-defeating attempt.
    const winningActions: Command[] = [{ op: 'attack' }, { op: 'move', dir: 'right' }, { op: 'move', dir: 'right' }, { op: 'move', dir: 'right' }];
    const grade = gradeCodecaster({ status: 'won', steps: 4, actions: winningActions, code: '' }, bossLevel, { hintsUsed: 0 });
    expect(grade.won).toBe(true);
    expect(grade.conceptUsed).toBe(true);

    // A losing attempt against the same level can never claim boss_defeat.
    const losing = gradeCodecaster({ status: 'won', steps: 1, actions: [{ op: 'wait' }], code: '' }, bossLevel, { hintsUsed: 0 });
    expect(losing.won).toBe(false);
    expect(losing.conceptUsed).toBe(false);
  });
});

describe('gradeCodecaster — Python-structure concepts via static analysis', () => {
  it('PS-01: "single_call" requires analyzePython(code).call — a code string with no calls fails the gate even on a winning run', () => {
    const level = makeLevel({ parSteps: 3, requireConcept: 'single_call' });
    const grade = gradeCodecaster(
      { status: 'won', steps: 3, actions: right(3), code: '# just a comment, no calls' },
      level, { hintsUsed: 0 },
    );
    expect(grade.won).toBe(true);
    expect(grade.conceptUsed).toBe(false);
    expect(grade.stars).toBe(2);
  });

  it('PS-02: "comment" gate is satisfied only by a real # comment, not text containing "#" inside a string', () => {
    const level = makeLevel({ parSteps: 3, requireConcept: 'comment' });
    const fakeComment = gradeCodecaster(
      { status: 'won', steps: 3, actions: right(3), code: 'hero.say("# not a real comment")\nhero.moveRight()' },
      level, { hintsUsed: 0 },
    );
    expect(fakeComment.conceptUsed).toBe(false);

    const realComment = gradeCodecaster(
      { status: 'won', steps: 3, actions: right(3), code: '# a real comment\nhero.moveRight()' },
      level, { hintsUsed: 0 },
    );
    expect(realComment.conceptUsed).toBe(true);
  });
});

describe('gradeCodecaster — no concept gate (requireConcept: null)', () => {
  it('NG-01: a flawless hint-free win earns ⭐⭐⭐ even with empty code when there is no concept gate', () => {
    const level = makeLevel({ parSteps: 3, requireConcept: null });
    const grade = gradeCodecaster({ status: 'won', steps: 3, actions: right(3), code: '' }, level, { hintsUsed: 0 });
    expect(grade.conceptUsed).toBe(true); // defaults true — no gate
    expect(grade.stars).toBe(3);
  });
});

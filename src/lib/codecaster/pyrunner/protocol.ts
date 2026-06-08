/**
 * Codecaster PyRunner — shared protocol contract.
 *
 * This file is the single source of truth that the Runtime, Frontend, and
 * UX-logic layers all build against. It is PURE types (no Skulpt, no DOM, no
 * React) so it can be imported anywhere — main thread, worker, or server.
 *
 * Flow:  Python source ──(Skulpt in a Web Worker)──▶ hero.* calls drive a
 * DungeonEngine inside the worker ──▶ a recorded `RunResult` timeline ──▶ the
 * main thread animates it and grades it.
 *
 * Determinism note: `RunResult.actions` is the realized primitive trace; the
 * server can re-run it through the SAME engine (runActions) to validate a win
 * (anti-cheat). See docs/codecaster-design.md §7.
 */

import type { Command, EngineState, GameEvent, GameStatus, LevelDef } from '../types';

/** Categorised error so the UI can explain it kindly (see errors.ts). */
export interface PyError {
  kind: 'syntax' | 'runtime' | 'timeout' | 'internal';
  /** Raw Skulpt message (English, technical) — the UX layer translates it. */
  message: string;
  /** 1-based source line, when Skulpt reports one. */
  line?: number;
}

/** One animation frame: the world state AFTER an action, plus what happened. */
export interface RunFrame {
  /** Serializable snapshot to render (already a fresh copy from the engine). */
  state: EngineState;
  /** Side-effects of this step (move/attack/collect/damage/…) for anim+audio. */
  events: GameEvent[];
  /** 1-based source line that produced this step, best-effort. */
  line?: number;
}

/** Everything the play screen needs after a Run completes. */
export interface RunResult {
  /** True if the program compiled and ran to completion without a thrown error.
   *  (Note: ok=true does NOT mean the level was won — check `finalStatus`.) */
  ok: boolean;
  /** The world before any action runs (for the pre-run / reset view). */
  initialState: EngineState;
  /** Timeline to play back, in order. May be empty (e.g. immediate syntax error). */
  frames: RunFrame[];
  /** Engine status after the last frame: 'won' | 'lost' | 'playing'. */
  finalStatus: GameStatus;
  /** Realized primitive action trace — deterministic, for server validation. */
  actions: Command[];
  /** Captured hero.say()/print output, in order. */
  output: string[];
  /** Number of hero actions executed. */
  steps: number;
  /** Present when ok=false, or when a runtime error interrupted a partial run. */
  error?: PyError;
}

// ── worker message envelopes ──────────────────────────────────────────────────

/** main → worker */
export type RunnerRequest = {
  type: 'run';
  /** correlation id so the client can match the response. */
  id: number;
  level: LevelDef;
  code: string;
  /** ms budget for Python execution before a 'timeout' error (default 1500). */
  execLimitMs?: number;
};

/** worker → main */
export type RunnerResponse =
  | { type: 'result'; id: number; result: RunResult }
  | { type: 'ready' };

/** The client-facing API the Frontend consumes (implemented in client.ts). */
export interface CodecasterRunner {
  /** Compile+run `code` against `level`; resolves with the full timeline. */
  run(level: LevelDef, code: string, execLimitMs?: number): Promise<RunResult>;
  /** Hard-terminate any in-flight run (e.g. user hit Reset). */
  cancel(): void;
  /** Release the worker. */
  dispose(): void;
}

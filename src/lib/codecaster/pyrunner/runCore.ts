/**
 * Codecaster PyRunner — core execution logic.
 *
 * This module contains the pure "run Python against an engine" function that
 * the worker and (in tests) the main-thread fallback both share. It is
 * intentionally decoupled from the Worker/window/importScripts surface so that
 * Vitest can import and test it directly by loading Skulpt via the npm package.
 *
 * The Sk global is passed in as a parameter rather than imported so this file
 * stays free of any Skulpt-specific import (Skulpt is loaded via importScripts
 * in the worker, or via a script-injection in the main-thread fallback).
 */

import { DungeonEngine } from '../engine';
import type { Command, Direction, EngineState } from '../types';
import type { PyError, RunFrame, RunResult } from './protocol';
import type { LevelDef } from '../types';

// ---------------------------------------------------------------------------
// Skulpt type shims — we only need the subset the core uses.
// These match the real Sk global attached by skulpt.min.js.
// ---------------------------------------------------------------------------

export interface SkulptBuiltin {
  func: new (fn: (...args: SkulptObj[]) => SkulptObj) => SkulptObj;
  str: new (s: string) => SkulptObj;
  int_: new (n: number) => SkulptObj;
  bool: { true$: SkulptObj; false$: SkulptObj };
  none: { none$: SkulptObj };
  SyntaxError: abstract new (...args: unknown[]) => SkulptException;
}

export interface SkulptFfi {
  remapToPy(value: unknown): SkulptObj;
  remapToJs(pyObj: SkulptObj): unknown;
}

export interface SkulptException {
  tp$name?: string;
  traceback?: Array<{ lineno?: number; filename?: string }>;
  toString(): string;
  args?: { v?: Array<{ v?: string }> };
}

export interface SkulptObj {
  v?: unknown;
}

export interface SkulptBuiltins {
  [key: string]: SkulptObj;
}

export interface SkulptGlobal {
  configure(opts: {
    output?: (text: string) => void;
    read?: (fname: string) => string;
    execLimit?: number;
  }): void;
  importMainWithBody(
    name: string,
    dumpJS: boolean,
    body: string,
    canSuspend: boolean,
  ): SkulptObj;
  builtin: SkulptBuiltin;
  ffi: SkulptFfi;
  builtins: SkulptBuiltins;
  builtinFiles?: { files: Record<string, string> };
  execLimit: number;
}

// ---------------------------------------------------------------------------
// Hero API builder — injects the `hero` Python object into Skulpt's builtins.
// ---------------------------------------------------------------------------

interface HeroApiContext {
  engine: DungeonEngine;
  frames: RunFrame[];
  actions: Command[];
  output: string[];
}

/**
 * Build and return a Skulpt Python object that exposes the hero API.
 * Every ACTION method records a RunFrame + Command; sensors are pure reads.
 */
function buildHeroObject(Sk: SkulptGlobal, ctx: HeroApiContext): SkulptObj {
  const { engine, frames, actions } = ctx;

  // Wrap a JS function as a zero-or-more-arg Skulpt callable.
  const fn = (jsFunc: (...args: SkulptObj[]) => SkulptObj) =>
    new Sk.builtin.func(jsFunc);

  // After each action, snapshot the engine state and push a RunFrame.
  function recordAction(cmd: Command): void {
    const result = engine.apply(cmd);
    actions.push(cmd);
    frames.push({
      state: engine.state as EngineState,
      events: result.events,
      // line: best-effort undefined (see §architecture note in protocol.ts)
    });
  }

  // Direction helpers — accept Python strings and map to Direction.
  function pyStrToDirection(pyArg: SkulptObj | undefined): Direction {
    const raw = pyArg ? (Sk.ffi.remapToJs(pyArg) as string) : 'right';
    const valid: Direction[] = ['up', 'down', 'left', 'right'];
    if (valid.includes(raw as Direction)) return raw as Direction;
    throw new Error(`Invalid direction: "${raw}". Use "up", "down", "left", or "right".`);
  }

  // Optional string arg (for attack/collect target).
  function pyOptStr(pyArg: SkulptObj | undefined): string | undefined {
    if (!pyArg || pyArg === Sk.builtin.none.none$) return undefined;
    return Sk.ffi.remapToJs(pyArg) as string;
  }

  // ── Action methods ─────────────────────────────────────────────────────────

  const moveRight = fn(() => {
    recordAction({ op: 'move', dir: 'right' });
    return Sk.builtin.none.none$;
  });

  const moveLeft = fn(() => {
    recordAction({ op: 'move', dir: 'left' });
    return Sk.builtin.none.none$;
  });

  const moveUp = fn(() => {
    recordAction({ op: 'move', dir: 'up' });
    return Sk.builtin.none.none$;
  });

  const moveDown = fn(() => {
    recordAction({ op: 'move', dir: 'down' });
    return Sk.builtin.none.none$;
  });

  const move = fn((dirArg?: SkulptObj) => {
    recordAction({ op: 'move', dir: pyStrToDirection(dirArg) });
    return Sk.builtin.none.none$;
  });

  const attack = fn((targetArg?: SkulptObj) => {
    recordAction({ op: 'attack', target: pyOptStr(targetArg) });
    return Sk.builtin.none.none$;
  });

  const collect = fn((targetArg?: SkulptObj) => {
    recordAction({ op: 'collect', target: pyOptStr(targetArg) });
    return Sk.builtin.none.none$;
  });

  const useKey = fn(() => {
    recordAction({ op: 'useKey' });
    return Sk.builtin.none.none$;
  });

  const wait = fn(() => {
    recordAction({ op: 'wait' });
    return Sk.builtin.none.none$;
  });

  const say = fn((textArg?: SkulptObj) => {
    const text = textArg ? (Sk.ffi.remapToJs(textArg) as string) : '';
    ctx.output.push(String(text));
    recordAction({ op: 'say', text: String(text) });
    return Sk.builtin.none.none$;
  });

  // ── Sensor methods (pure reads — no frame recorded) ───────────────────────

  const canMove = fn((dirArg?: SkulptObj) => {
    const result = engine.canMove(pyStrToDirection(dirArg));
    return Sk.ffi.remapToPy(result);
  });

  const seeEnemy = fn(() => {
    return Sk.ffi.remapToPy(engine.seeEnemy());
  });

  const seeCoin = fn(() => {
    return Sk.ffi.remapToPy(engine.seeCoin());
  });

  const health = fn(() => {
    return Sk.ffi.remapToPy(engine.health());
  });

  const nearbyEnemy = fn(() => {
    const result = engine.nearbyEnemy();
    if (result === null) return Sk.builtin.none.none$;
    return Sk.ffi.remapToPy(result);
  });

  // ── Assemble the hero object ───────────────────────────────────────────────
  // We create a plain JS object that Skulpt will recognize as a Python object
  // by giving it the attribute-lookup methods Skulpt uses.

  const attrMap: Record<string, SkulptObj> = {
    moveRight,
    moveLeft,
    moveUp,
    moveDown,
    move,
    attack,
    collect,
    useKey,
    wait,
    say,
    canMove,
    seeEnemy,
    seeCoin,
    health,
    nearbyEnemy,
  };

  // Use a Skulpt builtin object as the base so Python isinstance checks work.
  // We override tp$getattr to route attribute lookups to our map.
  const heroObj = new (Sk.builtin as unknown as Record<string, new () => SkulptObj> )['object']();
  (heroObj as unknown as Record<string, unknown>)['tp$getattr'] = function (
    nameObj: SkulptObj,
  ): SkulptObj | undefined {
    const name = nameObj && (nameObj as { v?: string }).v;
    if (name && Object.prototype.hasOwnProperty.call(attrMap, name)) {
      return attrMap[name];
    }
    // Fall through to base object lookup (handles __class__, etc.)
    const base = (Sk.builtin as unknown as Record<string, { prototype: Record<string, unknown> }>)['object']
      ?.prototype?.['tp$getattr'];
    if (typeof base === 'function') {
      return (base as (this: SkulptObj, n: SkulptObj) => SkulptObj).call(heroObj, nameObj);
    }
    return undefined;
  };

  return heroObj;
}

// ---------------------------------------------------------------------------
// Error mapping — Skulpt exception → PyError
// ---------------------------------------------------------------------------

/**
 * Map a thrown Skulpt exception to a typed PyError.
 *
 * Important: Skulpt exceptions do NOT extend the native JS Error class —
 * `err instanceof Error` is always false for them. We identify them via
 * `tp$name` (Skulpt's Python type name string) or by checking the stringified
 * message as a fallback.
 */
function mapSkulptError(err: unknown): PyError {
  if (err !== null && typeof err === 'object') {
    const skErr = err as SkulptException;
    const msg = (typeof skErr.toString === 'function' ? skErr.toString() : null) ?? String(err);
    // tp$name is the Python class name set by Skulpt on every exception object.
    const tpName: string =
      (skErr.tp$name as string | undefined) ??
      (err as { constructor?: { name?: string } }).constructor?.name ??
      '';

    // Extract the 1-based source line from the traceback array.
    const line = skErr.traceback?.[0]?.lineno;

    if (tpName === 'SyntaxError' || tpName === 'TokenError' || msg.startsWith('SyntaxError')) {
      return { kind: 'syntax', message: msg, line };
    }
    if (tpName === 'TimeLimitError' || msg.includes('TimeLimitError') || msg.includes('exceeded run time limit')) {
      return {
        kind: 'timeout',
        message: 'Your program ran too long. Check for infinite loops.',
        line,
      };
    }
    // Any other Skulpt exception (NameError, TypeError, IndentationError, etc.)
    return { kind: 'runtime', message: msg, line };
  }
  // Non-object throw — very rare, but be safe.
  return { kind: 'internal', message: String(err) };
}

// ---------------------------------------------------------------------------
// Main exported function — the testable core.
// ---------------------------------------------------------------------------

export interface CoreRunOptions {
  level: LevelDef;
  code: string;
  execLimitMs: number;
  Sk: SkulptGlobal;
}

export function runPythonCore(opts: CoreRunOptions): RunResult {
  const { level, code, execLimitMs, Sk } = opts;

  const engine = new DungeonEngine(level);
  // Snapshot BEFORE any hero action runs — used for the pre-run/reset view.
  const initialState: EngineState = engine.state as EngineState;

  const frames: RunFrame[] = [];
  const actions: Command[] = [];
  const output: string[] = [];

  const ctx: HeroApiContext = { engine, frames, actions, output };

  // Configure Skulpt — output captures print() statements.
  Sk.configure({
    output: (text: string) => {
      output.push(text.replace(/\n$/, '')); // strip trailing newline from print()
    },
    read: (fname: string) => {
      if (!Sk.builtinFiles?.files[fname]) {
        throw new Error(`File not found: "${fname}"`);
      }
      return Sk.builtinFiles.files[fname];
    },
    execLimit: execLimitMs,
  });

  // Inject the hero object as a Python global.
  const heroObj = buildHeroObject(Sk, ctx);
  Sk.builtins['hero'] = heroObj;

  let error: PyError | undefined;
  let ok = true;

  try {
    Sk.importMainWithBody('<stdin>', false, code, true);
  } catch (err) {
    ok = false;
    error = mapSkulptError(err);
  } finally {
    // Clean up — don't leak hero across runs.
    delete Sk.builtins['hero'];
  }

  return {
    ok,
    initialState,
    frames,
    finalStatus: engine.status,
    actions,
    output,
    steps: engine.turn,
    error,
  };
}

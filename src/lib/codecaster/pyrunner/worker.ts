/**
 * Codecaster PyRunner — Web Worker host.
 *
 * This file is bundled as a CLASSIC worker (no `type: 'module'` option) so that
 * `importScripts` works. The bundler (Turbopack/Webpack) inlines `runPythonCore`
 * and `DungeonEngine` at build time. Skulpt itself is loaded at runtime via
 * `importScripts` from our own origin (offline-first, no CDN).
 *
 * Message flow:
 *   main → worker : RunnerRequest  { type:'run', id, level, code, execLimitMs? }
 *   worker → main : RunnerResponse { type:'result', id, result } | { type:'ready' }
 */

import type { RunnerRequest, RunnerResponse } from './protocol';
import { runPythonCore } from './runCore';
import type { SkulptGlobal } from './runCore';

// `declare` tells TypeScript that `importScripts` exists in this Worker context.
declare function importScripts(...urls: string[]): void;

// The Sk global is attached to `self` by skulpt.min.js after importScripts.
declare const Sk: SkulptGlobal;

let skulptLoaded = false;

function ensureSkulpt(): void {
  if (skulptLoaded) return;
  // Load from our own origin — works offline, no CDN needed.
  importScripts('/skulpt/skulpt.min.js', '/skulpt/skulpt-stdlib.js');
  skulptLoaded = true;
}

self.addEventListener('message', (event: MessageEvent<RunnerRequest>) => {
  const req = event.data;
  if (req.type !== 'run') return;

  try {
    ensureSkulpt();

    const result = runPythonCore({
      level: req.level,
      code: req.code,
      execLimitMs: req.execLimitMs ?? 1500,
      Sk,
    });

    const response: RunnerResponse = { type: 'result', id: req.id, result };
    self.postMessage(response);
  } catch (err) {
    // Internal worker error (not a Python error) — still respond so the
    // Promise on the client side doesn't hang forever.
    const response: RunnerResponse = {
      type: 'result',
      id: req.id,
      result: {
        ok: false,
        initialState: {
          tiles: req.level.tiles.map((row) => row.slice()),
          hero: {
            pos: { ...req.level.heroStart },
            facing: req.level.heroFacing ?? 'right',
            hp: req.level.heroHp ?? 3,
            keys: req.level.startKeys ?? 0,
            coins: 0,
            gems: 0,
          },
          entities: req.level.entities.map((e) => ({ ...e, pos: { ...e.pos } })),
          turn: 0,
          status: 'playing',
          log: [],
        },
        frames: [],
        finalStatus: 'playing',
        actions: [],
        output: [],
        steps: 0,
        error: {
          kind: 'internal',
          message: err instanceof Error ? err.message : String(err),
        },
      },
    };
    self.postMessage(response);
  }
});

// Signal readiness — lets the client know the worker is alive and listening.
self.postMessage({ type: 'ready' } as RunnerResponse);

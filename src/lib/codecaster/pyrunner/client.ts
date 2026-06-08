/**
 * Codecaster PyRunner — client-side runner implementation.
 *
 * Strategy:
 *  PRIMARY PATH — Web Worker created via `new Worker(new URL('./worker.ts',
 *    import.meta.url))`. The worker loads Skulpt via importScripts and calls
 *    runPythonCore. This keeps Python execution off the main thread.
 *
 *  FALLBACK PATH — If worker construction fails (e.g. some bundler configs
 *    refuse to serve a classic worker in dev), we fall back to a main-thread
 *    implementation that loads Skulpt by injecting <script> tags. This still
 *    prevents infinite hangs because `Sk.execLimit` throws TimeLimitError, but
 *    it briefly blocks the main thread during execution (acceptable trade-off
 *    for an educational game where runs are typically <100 ms).
 *
 *  Both paths expose the same `CodecasterRunner` interface so consumers never
 *  need to know which path is active.
 *
 * SSR safety: every reference to `Worker`, `window`, and `document` is guarded
 * by a `typeof window !== 'undefined'` check. This module can safely be
 * imported in a Next.js Server Component or Edge function — it just won't do
 * anything useful until it runs in a browser.
 */

import type { CodecasterRunner, RunnerRequest, RunnerResponse, RunResult } from './protocol';
import type { LevelDef } from '../types';
import { runPythonCore } from './runCore';
import type { SkulptGlobal } from './runCore';

// ── Skulpt loader for the main-thread fallback ──────────────────────────────

let skulptLoadPromise: Promise<SkulptGlobal> | null = null;

/**
 * Load Skulpt on the main thread by injecting two <script> tags.
 * Resolves with the `Sk` global once both scripts have fired their `load` events.
 * Idempotent — calling it multiple times returns the same promise.
 */
function loadSkulptOnMainThread(): Promise<SkulptGlobal> {
  if (skulptLoadPromise) return skulptLoadPromise;

  skulptLoadPromise = new Promise<SkulptGlobal>((resolve, reject) => {
    function loadScript(src: string): Promise<void> {
      return new Promise((res, rej) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
          res();
          return;
        }
        const el = document.createElement('script');
        el.src = src;
        el.onload = () => res();
        el.onerror = () => rej(new Error(`Failed to load script: ${src}`));
        document.head.appendChild(el);
      });
    }

    loadScript('/skulpt/skulpt.min.js')
      .then(() => loadScript('/skulpt/skulpt-stdlib.js'))
      .then(() => {
        const sk = (window as unknown as Record<string, unknown>)['Sk'] as SkulptGlobal | undefined;
        if (!sk) {
          reject(new Error('Skulpt loaded but window.Sk is undefined'));
          return;
        }
        resolve(sk);
      })
      .catch(reject);
  });

  return skulptLoadPromise;
}

// ── Worker-backed runner ─────────────────────────────────────────────────────

type PendingRun = {
  resolve: (result: RunResult) => void;
  reject: (err: Error) => void;
};

class WorkerRunner implements CodecasterRunner {
  private worker: Worker;
  private nextId = 0;
  private pending = new Map<number, PendingRun>();

  constructor(worker: Worker) {
    this.worker = worker;
    this.worker.addEventListener('message', this.onMessage);
    this.worker.addEventListener('error', this.onError);
  }

  private onMessage = (event: MessageEvent<RunnerResponse>): void => {
    const msg = event.data;
    if (msg.type === 'ready') return; // startup signal, nothing to do
    if (msg.type === 'result') {
      const pending = this.pending.get(msg.id);
      if (pending) {
        this.pending.delete(msg.id);
        pending.resolve(msg.result);
      }
    }
  };

  private onError = (event: ErrorEvent): void => {
    // Reject all pending runs when the worker crashes.
    const err = new Error(event.message || 'Worker error');
    for (const [id, pending] of this.pending) {
      this.pending.delete(id);
      pending.reject(err);
    }
  };

  run(level: LevelDef, code: string, execLimitMs?: number): Promise<RunResult> {
    return new Promise<RunResult>((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      const req: RunnerRequest = {
        type: 'run',
        id,
        level,
        code,
        execLimitMs,
      };
      this.worker.postMessage(req);
    });
  }

  cancel(): void {
    // Terminate the running worker — all pending promises will never resolve.
    // We drain them with a cancelled error first.
    for (const [id, pending] of this.pending) {
      this.pending.delete(id);
      pending.reject(new Error('Run cancelled'));
    }
    this.worker.terminate();
    // Spawn a fresh worker so the runner remains usable after cancel().
    try {
      this.worker = new Worker(new URL('./worker.ts', import.meta.url));
      this.worker.addEventListener('message', this.onMessage);
      this.worker.addEventListener('error', this.onError);
    } catch {
      // If re-spawning fails, the runner is disposed — caller should create a new one.
    }
  }

  dispose(): void {
    for (const [id, pending] of this.pending) {
      this.pending.delete(id);
      pending.reject(new Error('Runner disposed'));
    }
    this.worker.terminate();
  }
}

// ── Main-thread fallback runner ──────────────────────────────────────────────

class MainThreadRunner implements CodecasterRunner {
  private currentAbort: (() => void) | null = null;

  async run(level: LevelDef, code: string, execLimitMs?: number): Promise<RunResult> {
    // Allow any previous run to be interrupted.
    this.currentAbort?.();

    let aborted = false;
    this.currentAbort = () => {
      aborted = true;
    };

    const Sk = await loadSkulptOnMainThread();

    if (aborted) {
      throw new Error('Run cancelled');
    }

    // runPythonCore is synchronous for Skulpt (Skulpt v1 runs synchronously
    // in the same call stack; Sk.execLimit fires as a thrown exception).
    const result = runPythonCore({
      level,
      code,
      execLimitMs: execLimitMs ?? 1500,
      Sk,
    });

    this.currentAbort = null;
    return result;
  }

  cancel(): void {
    this.currentAbort?.();
    this.currentAbort = null;
  }

  dispose(): void {
    this.cancel();
  }
}

// ── Factory — picks the best available runner ────────────────────────────────

/**
 * Create a `CodecasterRunner`.
 *
 * Returns a `WorkerRunner` backed by a Web Worker when running in a browser
 * that supports classic Worker construction. Falls back to `MainThreadRunner`
 * (Skulpt via <script> injection) when:
 *   - We are in an SSR context (no `window`).
 *   - Worker construction throws (some bundler dev-server configs don't serve
 *     classic workers correctly).
 *
 * The caller never needs to know which implementation is in use — the interface
 * is identical.
 */
export function createRunner(): CodecasterRunner {
  if (typeof window === 'undefined') {
    // SSR / Node context — return a no-op runner that is safe to instantiate
    // but will throw if actually called (which won't happen during SSR because
    // play screens are always client-side).
    return {
      run: () => Promise.reject(new Error('PyRunner is not available in SSR context')),
      cancel: () => undefined,
      dispose: () => undefined,
    };
  }

  try {
    // Classic worker (no `{ type: 'module' }`) — importScripts works inside.
    const worker = new Worker(new URL('./worker.ts', import.meta.url));
    return new WorkerRunner(worker);
  } catch {
    // Worker construction failed — fall back to main-thread Skulpt.
    console.warn(
      '[CodecasterRunner] Web Worker unavailable — falling back to main-thread Skulpt. ' +
        'Python execution may briefly block the UI.',
    );
    return new MainThreadRunner();
  }
}

/**
 * Codecaster PyRunner — public API.
 *
 * Usage:
 *   import { createRunner } from '@/lib/codecaster/pyrunner';
 *   const runner = createRunner();
 *   const result = await runner.run(level, code);
 *   runner.dispose();
 *
 * Import type-only protocol types as needed:
 *   import type { RunResult, RunFrame, PyError, CodecasterRunner } from '@/lib/codecaster/pyrunner';
 */

export { createRunner } from './client';

// Re-export all protocol types for consumers.
export type {
  CodecasterRunner,
  RunResult,
  RunFrame,
  PyError,
  RunnerRequest,
  RunnerResponse,
} from './protocol';

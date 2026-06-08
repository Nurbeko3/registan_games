/**
 * Codecaster cloud sync — progress persistence via Supabase SECURITY DEFINER RPCs.
 *
 * OFFLINE-FIRST CONTRACT (do not violate):
 *   Every exported function returns a safe default when cloud is unavailable.
 *   supabase may be null (no env vars, SSR, init error). This module never throws.
 *   The game works fully from localStorage / Zustand when these return defaults.
 *
 * RPC surface (see supabase/migrations/0010_codecaster.sql):
 *   kcq_cc_progress(p_token)   → read all progress rows for the authenticated user
 *   kcq_cc_submit(p_token, …)  → upsert best result + append audit row (validated=false)
 *   kcq_cc_leaderboard()       → public ranking view (no auth required)
 *
 * MVP trust note:
 *   kcq_cc_submit trusts the client's reported stars/concept_ok.  The code_hash and
 *   command_count stored by the RPC are the hook for a future Edge Function that will
 *   re-run engine.ts server-side and flip validated=true.  Until that ships, the
 *   competitive leaderboard should remain private (teacher-view only).
 *   See docs/codecaster-design.md §7 for the full anti-cheat model.
 *
 * Session token:
 *   Read from localStorage via readSession() (same key as account.ts: 'kcq.session').
 *   The function is intentionally re-imported from account.ts so there is a single
 *   source of truth for the session format — this module does NOT own the session.
 */

import { supabase, isCloudEnabled } from '@/lib/supabase/client';
import { readSession } from '@/lib/supabase/account';

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * The shape stored in the Zustand store's `codecaster` map.
 * The UX/store agent adds: codecaster: Record<string, { stars: number }>
 * We deliberately keep this minimal so the store stays lean.
 */
export interface CodecasterStoreEntry {
  stars: number;
}

/** Arguments for a single level submission. */
export interface SubmitArgs {
  /** Stars earned this run (0–3). */
  stars: 0 | 1 | 2 | 3;
  /** Hero action count (for par/efficiency leaderboard). */
  steps: number;
  /** Did the static checker confirm the target concept was used? */
  conceptOk: boolean;
  /** Number of Byte hints consumed this run. */
  hintsUsed: number;
  /**
   * Deterministic hash of the submitted Python source.
   * Used by the future edge-function validator to look up the code.
   * NOT cryptographic — see hashCode() below.
   */
  codeHash: string;
  /** Length of the compiled command queue (replay budget for edge fn). */
  commandCount: number;
}

/** A single row in the leaderboard. */
export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  threeStars: number;
  bosses: number;
}

// Internal shape returned by kcq_cc_progress rows array.
interface RawProgressRow {
  level_id: string;
  best_stars: number;
  best_steps: number | null;
  concept_ok: boolean;
  hints_used: number;
  completed_at: string | null;
}

// Internal shape returned by kcq_cc_leaderboard rows array.
interface RawLeaderboardRow {
  user_id: string;
  display_name: string;
  three_stars: number;
  bosses: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Simple deterministic hash of a string — suitable for change-detection and
 * audit correlation, NOT for cryptographic purposes.
 *
 * This is intentionally browser-safe (no Node 'crypto') and tiny.  The Edge
 * Function that validates solves server-side will compute a proper sha256 from
 * the same source text and store it on the audit row; this client hash is just
 * a cheap content fingerprint for the MVP.
 *
 * Algorithm: DJB2-style XOR-shift (unsigned 32-bit, base-16 output).
 */
export function hashCode(code: string): string {
  let h = 5381;
  for (let i = 0; i < code.length; i++) {
    // Bitwise ops in JS work on signed 32-bit; >>> 0 converts to unsigned.
    h = (((h << 5) >>> 0) + h + code.charCodeAt(i)) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Persist a level result to Supabase.
 *
 * The RPC is monotonic: it only upgrades stars (never downgrades), keeps the
 * best step count at max stars, and appends an audit row (validated=false).
 *
 * Offline / no session → returns false (caller continues with local state).
 *
 * @param levelId  - e.g. 'L01' .. 'L30'
 * @param args     - result data for this run
 * @returns true on successful cloud write, false otherwise (no-op offline)
 */
export async function saveCodecasterProgress(
  levelId: string,
  args: SubmitArgs,
): Promise<boolean> {
  if (!isCloudEnabled()) return false;

  const session = readSession();
  if (!session) return false;

  try {
    const { data, error } = await supabase!.rpc('kcq_cc_submit', {
      p_token:         session.token,
      p_level:         levelId,
      p_stars:         args.stars,
      p_steps:         args.steps,
      p_concept_ok:    args.conceptOk,
      p_hints:         args.hintsUsed,
      p_code_hash:     args.codeHash,
      p_command_count: args.commandCount,
    });

    if (error || !data?.ok) return false;
    return true;
  } catch {
    // Network error, RPC not found, etc. — fail silently.
    return false;
  }
}

/**
 * Load all Codecaster progress rows for the current session from Supabase.
 *
 * Returns a map compatible with the store's `codecaster` field:
 *   Record<levelId, { stars: number }>
 *
 * Offline / no session → returns {} (store keeps its existing localStorage state).
 *
 * The caller (store integration) is responsible for merging cloud data with any
 * local progress — typically by taking the max stars so offline progress is not lost.
 */
export async function loadCodecasterProgress(): Promise<Record<string, CodecasterStoreEntry>> {
  if (!isCloudEnabled()) return {};

  const session = readSession();
  if (!session) return {};

  try {
    const { data, error } = await supabase!.rpc('kcq_cc_progress', {
      p_token: session.token,
    });

    if (error || !data?.ok) return {};

    const rows: RawProgressRow[] = data.rows ?? [];
    const result: Record<string, CodecasterStoreEntry> = {};

    for (const row of rows) {
      if (typeof row.level_id === 'string' && row.level_id) {
        result[row.level_id] = { stars: row.best_stars ?? 0 };
      }
    }

    return result;
  } catch {
    return {};
  }
}

/**
 * Fetch the public Codecaster leaderboard (top 100, ranked by 3-star count
 * then boss clears).
 *
 * No auth required — the RPC is public (classroom motivator).
 * Offline / cloud disabled → returns [] (UI hides the leaderboard section).
 *
 * MVP note: until the edge-function validator ships, these ranks reflect
 * client-reported scores (validated=false rows).  Keep the leaderboard
 * private (teacher-only) until validated=true is gated on the view.
 */
export async function fetchCodecasterLeaderboard(): Promise<LeaderboardEntry[]> {
  if (!isCloudEnabled()) return [];

  try {
    const { data, error } = await supabase!.rpc('kcq_cc_leaderboard');

    if (error || !data?.ok) return [];

    const rows: RawLeaderboardRow[] = data.rows ?? [];

    return rows.map((r) => ({
      userId:      r.user_id      ?? '',
      displayName: r.display_name ?? '',
      threeStars:  r.three_stars  ?? 0,
      bosses:      r.bosses       ?? 0,
    }));
  } catch {
    return [];
  }
}

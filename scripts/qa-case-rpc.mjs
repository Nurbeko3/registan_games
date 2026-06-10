// Live integration probe for the Case Files Postgres RPCs (migration 0011).
// Mirrors scripts/qa-party-rpc.mjs. Needs Supabase env in .env.local + 0011 applied.
//   node scripts/qa-case-rpc.mjs
//
// Drives a full match end-to-end and asserts the anti-cheat guarantees:
// server-scored answers, token auth, idempotency, phase guards, server-recomputed
// stars, and the case_id existence + answer-key-secrecy checks.

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function readEnv(path) {
  const env = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const i = trimmed.indexOf('=');
    if (i === -1) continue;
    env[trimmed.slice(0, i)] = trimmed.slice(i + 1);
  }
  return env;
}

function assertOk(label, value, details) {
  if (!value) throw new Error(`${label}${details ? `: ${JSON.stringify(details)}` : ''}`);
  console.log(`PASS ${label}`);
}

async function rpc(supabase, name, args) {
  const { data, error } = await supabase.rpc(name, args);
  if (error) throw new Error(`${name}: ${error.message}`);
  return data;
}

const env = readEnv('.env.local');
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
assertOk('Supabase env present', Boolean(url && key));

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

const code = `QC${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
const host = `host_${Math.random().toString(36).slice(2, 8)}`;
const p1 = `p1_${Math.random().toString(36).slice(2, 8)}`;
const p2 = `p2_${Math.random().toString(36).slice(2, 8)}`;
const CASE = 'case01'; // 4 questions; seeded in 0011

// ── create / unknown-case guard ─────────────────────────────────────
const badCode = `QB${Math.random().toString(36).slice(2, 6)}`.toUpperCase(); // 6 chars, valid format
const badCase = await rpc(supabase, 'kcq_case_create', {
  p_code: badCode, p_host_id: host, p_case_id: 'does-not-exist',
});
assertOk('create rejects an unknown case_id', badCase?.ok === false && badCase?.reason === 'unknown_case');

const created = await rpc(supabase, 'kcq_case_create', {
  p_code: code, p_host_id: host, p_case_id: CASE, p_is_classroom: false,
});
assertOk('host can create a room', created?.ok && created?.token);

// ── join + capacity/token ───────────────────────────────────────────
const j1 = await rpc(supabase, 'kcq_case_join', { p_code: code, p_player_id: p1, p_display_name: 'Ali' });
const j2 = await rpc(supabase, 'kcq_case_join', { p_code: code, p_player_id: p2, p_display_name: 'Ali' });
assertOk('two players can join', j1?.ok && j1?.token && j2?.ok && j2?.token);
assertOk('duplicate display names are de-duped', j2?.state?.players?.some((p) => p.display_name === 'Ali (2)'));

const reJoin = await rpc(supabase, 'kcq_case_join', { p_code: code, p_player_id: p1, p_display_name: 'Ali' });
assertOk('join is idempotent (same token on reconnect)', reJoin?.token === j1.token);

// ── state never leaks answer keys or q_opened_at ────────────────────
const state = await rpc(supabase, 'kcq_case_state', { p_code: code });
const stateStr = JSON.stringify(state);
assertOk('public state excludes answer keys / timer',
  !stateStr.includes('answer_index') && !stateStr.includes('q_opened_at'));

// ── host drives the phase machine ───────────────────────────────────
assertOk('host starts investigation',
  (await rpc(supabase, 'kcq_case_start_investigation', { p_code: code, p_token: created.token }))?.ok);

// non-host cannot advance
const forged = await rpc(supabase, 'kcq_case_advance_question', { p_code: code, p_token: j1.token });
assertOk('non-host cannot advance the question', forged?.ok === false);

const adv = await rpc(supabase, 'kcq_case_advance_question', { p_code: code, p_token: created.token });
assertOk('host advances to question 0', adv?.ok && adv?.q_index === 0);

// ── answering: token auth, server scoring, idempotency ──────────────
const wrongTok = await rpc(supabase, 'kcq_case_answer', {
  p_code: code, p_player_id: p1, p_player_token: j2.token, p_q_index: 0, p_option: 0,
});
assertOk('cannot answer as another player (wrong token)', wrongTok?.ok === false && wrongTok?.reason === 'auth');

const ans = await rpc(supabase, 'kcq_case_answer', {
  p_code: code, p_player_id: p1, p_player_token: j1.token, p_q_index: 0, p_option: 1, // case01 q0 key = 1
});
assertOk('correct answer is scored server-side', ans?.ok && ans?.correct === true && ans?.score > 0);
assertOk('answer response never reveals the key', !Object.keys(ans).includes('answer_index'));

const dup = await rpc(supabase, 'kcq_case_answer', {
  p_code: code, p_player_id: p1, p_player_token: j1.token, p_q_index: 0, p_option: 2,
});
assertOk('double-answer is idempotent', dup?.ok && dup?.duplicate === true);

// ── finish the case for p1 (answer all 4 correctly) ─────────────────
const KEYS = [1, 1, 2, 1]; // case01 answer indices
await rpc(supabase, 'kcq_case_advance_reveal', { p_code: code, p_token: created.token });
for (let qi = 1; qi < 4; qi++) {
  await rpc(supabase, 'kcq_case_advance_question', { p_code: code, p_token: created.token });
  await rpc(supabase, 'kcq_case_answer', {
    p_code: code, p_player_id: p1, p_player_token: j1.token, p_q_index: qi, p_option: KEYS[qi],
  });
  await rpc(supabase, 'kcq_case_advance_reveal', { p_code: code, p_token: created.token });
}

const ended = await rpc(supabase, 'kcq_case_end_match', { p_code: code, p_token: created.token });
assertOk('match ends and stars are recomputed server-side', ended?.ok && ended?.results?.[p1]);
assertOk('all-correct, no-hint run earns 3 stars', ended.results[p1].stars === 3);

console.log('\nAll Case Files RPC probes passed ✔');

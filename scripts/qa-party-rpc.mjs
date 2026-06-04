import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function readEnv(path) {
  const env = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    env[trimmed.slice(0, index)] = trimmed.slice(index + 1);
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

const code = `QA${Math.random().toString(36).slice(2, 6)}`.toUpperCase();
const hostId = `host_${Math.random().toString(36).slice(2, 8)}`;
const p1 = `p1_${Math.random().toString(36).slice(2, 8)}`;
const p2 = `p2_${Math.random().toString(36).slice(2, 8)}`;

const created = await rpc(supabase, 'kcq_party_create', { p_code: code, p_host_id: hostId });
assertOk('host can create room', created?.ok && created?.token);

const hostJoin = await rpc(supabase, 'kcq_party_join', { p_code: code, p_player_id: hostId });
assertOk('host also receives player token', hostJoin?.ok && hostJoin?.token);

const join1 = await rpc(supabase, 'kcq_party_join', { p_code: code, p_player_id: p1 });
const join2 = await rpc(supabase, 'kcq_party_join', { p_code: code, p_player_id: p2 });
assertOk('two non-host players can join', join1?.ok && join1?.token && join2?.ok && join2?.token);

const resumed = await rpc(supabase, 'kcq_party_host_resume', {
  p_code: code,
  p_host_id: hostId,
  p_token: created.token,
});
assertOk('host refresh/resume works', resumed?.ok && resumed?.token === created.token);

const started = await rpc(supabase, 'kcq_party_host_state', {
  p_code: code,
  p_token: created.token,
  p_phase: 'question',
  p_q_index: 0,
  p_order: [0, 1, 2, 3, 4],
});
assertOk('host can start question state', started?.ok);

const firstAnswer = await rpc(supabase, 'kcq_party_answer', {
  p_code: code,
  p_player_id: p1,
  p_player_token: join1.token,
  p_q_index: 0,
  p_option: 0,
});
assertOk('player answer accepted through RPC', firstAnswer?.ok && firstAnswer?.scores, firstAnswer);

const firstScore = Number(firstAnswer.scores?.[p1] ?? 0);
const duplicateAnswer = await rpc(supabase, 'kcq_party_answer', {
  p_code: code,
  p_player_id: p1,
  p_player_token: join1.token,
  p_q_index: 0,
  p_option: 0,
});
assertOk('duplicate answer does not change score', Number(duplicateAnswer.scores?.[p1] ?? 0) === firstScore);

const spoofAnswer = await rpc(supabase, 'kcq_party_answer', {
  p_code: code,
  p_player_id: p2,
  p_player_token: join1.token,
  p_q_index: 0,
  p_option: 0,
});
assertOk('spoofed player answer is rejected', spoofAnswer?.ok === false);

const state = await rpc(supabase, 'kcq_party_state', { p_code: code });
assertOk('score is visible in authoritative room state', state?.ok && Number(state.state?.scores?.[p1] ?? 0) === firstScore);

const reset = await rpc(supabase, 'kcq_party_host_state', {
  p_code: code,
  p_token: created.token,
  p_phase: 'lobby',
  p_q_index: -1,
  p_order: [0, 1, 2, 3, 4],
});
assertOk('host lobby reset clears score state', reset?.ok && Object.keys(reset.state?.scores ?? {}).length === 0);

console.log(`PASS party RPC QA complete (${code})`);

// Live probe of Supabase Realtime broadcast behaviour for the Arena netcode.
// Needs Supabase env in .env.local. Run: node scripts/qa-realtime-probe.mjs
//
// Measures, from THIS machine to the project's Realtime cluster:
//   1. channel subscribe time
//   2. broadcast echo RTT (self:true round trip), median of 10
//   3. delivery at the arena's real cadence (~12 Hz) with the supabase-js
//      DEFAULT client rate limit (10 eps)  → demonstrates silent drops
//   4. the same burst with eventsPerSecond: 30 (the shipped fix) → no drops

import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function readEnv(path) {
  const env = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i !== -1) env[t.slice(0, i)] = t.slice(i + 1);
  }
  return env;
}

const env = readEnv('.env.local');
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!URL || !KEY) { console.error('Missing Supabase env'); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeClient(eventsPerSecond) {
  return createClient(URL, KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    realtime: { params: { eventsPerSecond } },
  });
}

async function subscribe(client, name) {
  const ch = client.channel(name, { config: { broadcast: { self: true } } });
  const t0 = Date.now();
  await new Promise((resolve, reject) => {
    const to = setTimeout(() => reject(new Error('subscribe timeout')), 15000);
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') { clearTimeout(to); resolve(); }
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') { clearTimeout(to); reject(new Error(status)); }
    });
  });
  return { ch, subscribeMs: Date.now() - t0 };
}

// ── 1+2: subscribe time + echo RTT ───────────────────────────────────────────
const cli = makeClient(30);
const { ch, subscribeMs } = await subscribe(cli, `kcq-probe-${Math.random().toString(36).slice(2, 8)}`);
console.log(`subscribe: ${subscribeMs} ms`);

const rtts = [];
let pingResolve = null;
ch.on('broadcast', { event: 'ping' }, ({ payload }) => pingResolve?.(payload.t0));
for (let i = 0; i < 10; i++) {
  const t0 = Date.now();
  const got = new Promise((r) => { pingResolve = r; });
  await ch.send({ type: 'broadcast', event: 'ping', payload: { t0 } });
  await Promise.race([got, sleep(5000)]);
  rtts.push(Date.now() - t0);
  await sleep(120);
}
rtts.sort((a, b) => a - b);
console.log(`echo RTT: median ${rtts[5]} ms  (min ${rtts[0]}, max ${rtts[9]})`);

// ── 3+4: arena-cadence burst under each client rate limit ────────────────────
async function burstTest(eventsPerSecond, label) {
  const sender = makeClient(eventsPerSecond);
  const receiver = makeClient(100);
  const room = `kcq-probe-burst-${Math.random().toString(36).slice(2, 8)}`;
  const { ch: rx } = await subscribe(receiver, room);
  let received = 0;
  rx.on('broadcast', { event: 'net' }, () => { received += 1; });
  const { ch: tx } = await subscribe(sender, room);

  // 3 seconds of "firefight": 12 Hz move flush + 4 extra events/sec (shots/hits)
  // sent as SEPARATE messages — exactly what the arena did before the envelope fix.
  const sendResults = { ok: 0, rateLimited: 0, other: 0 };
  const t0 = Date.now();
  let i = 0;
  while (Date.now() - t0 < 3000) {
    const burst = (i % 3 === 0) ? 2 : 1; // ~16 msg/s like a real firefight
    for (let b = 0; b < burst; b++) {
      const res = await tx.send({ type: 'broadcast', event: 'net', payload: { seq: i, b } });
      if (res === 'ok') sendResults.ok += 1;
      else if (res === 'rate limited') sendResults.rateLimited += 1;
      else sendResults.other += 1;
    }
    i += 1;
    await sleep(83); // 12 Hz flush cadence
  }
  await sleep(2000); // let stragglers arrive
  const attempted = sendResults.ok + sendResults.rateLimited + sendResults.other;
  console.log(
    `${label}: attempted ${attempted}, accepted ${sendResults.ok}, ` +
    `RATE-LIMITED ${sendResults.rateLimited}, delivered ${received} ` +
    `(loss ${(100 * (1 - received / attempted)).toFixed(0)}%)`,
  );
  await sender.removeAllChannels();
  await receiver.removeAllChannels();
}

await burstTest(10, 'default limit (10 eps) — OLD behaviour');
await burstTest(30, 'raised limit (30 eps) — SHIPPED fix ');

await cli.removeAllChannels();
console.log('\nRealtime probe complete ✔');
process.exit(0);

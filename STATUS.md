# 📋 KidsCode Quest — Status Report (v2: Game Platform)

> Generated for external AI review. Describes the **actual, verified** state of the
> codebase after the pivot from full-stack SaaS → **frontend-only kids' game platform**,
> plus a complete, copy-pasteable **Supabase integration guide**.
> Date: 2026-06-01 · Version: 2.0.0

---

## 1. ✅ What this project IS now

A **fun, offline-first educational game** for kids aged **7–14**. No backend, no login,
no database. A child opens the app → explores a world map → plays coding mini-games →
earns XP, stars, coins, achievements. All progress saves to **localStorage**.

| | |
| --- | --- |
| Framework | Next.js 15 (App Router) + TypeScript |
| Styling | TailwindCSS + Framer Motion |
| State | Zustand + `persist` middleware (localStorage) |
| Backend | **none** (fully static / client-side) |
| Auth | **none** |
| AI | offline "Byte" mentor (`getHint()` seam, ready for real AI) |

## 2. ✅ Verification results (run in this environment)

| Check | Command | Result |
| --- | --- | --- |
| Production build | `npm run build` | ✅ **PASS** — 5 routes, 0 errors |
| First-load JS | — | ~146 kB (light, static) |
| Orphaned imports | `grep` for old api/auth/hooks | ✅ none |
| Type safety | `next build` typecheck | ✅ PASS |

> Routes: `/` (Home), `/map` (World Map), `/play/[game]` (game runner), `/rewards`
> (profile/shop/achievements), `/_not-found`.

## 3. 🗂️ Architecture (current)

```
src/
├── app/
│   ├── page.tsx              # Home — animated landing
│   ├── map/page.tsx          # World map — 5 zones, star-gated
│   ├── play/[game]/page.tsx  # Game runner (GameShell)
│   └── rewards/page.tsx      # Profile · achievements · shop · settings
├── components/
│   ├── games/                # 8 games + GameShell + registry + GameProps
│   ├── layout/TopBar.tsx     # HUD (avatar, level, XP, coins, streak)
│   ├── AIMentor.tsx          # offline "Byte"
│   ├── Celebrations.tsx      # achievement popups
│   ├── Confetti.tsx (ui/)    # dependency-free confetti
│   ├── AppChrome.tsx         # theme + reduced-motion
│   └── ui/Bits.tsx           # Stat, ProgressBar, Stars, Chip
├── data/                     # games · worlds · achievements · cosmetics · hints
├── lib/leveling.ts           # XP curve + streak math (pure)
└── store/useGame.ts          # ⭐ single source of truth (persisted)
```

**Data flow:** UI → `useGame` actions → recompute (xp/coins/stars/streak/achievements)
→ Zustand persists to `localStorage["kcq.v2"]`. Pure helpers in `lib/` and `data/`.

## 4. 🎮 Game systems (all offline)

- **8 games:** Robot Maze, Memory Match, Binary Challenge, Algorithm Race, Fix the Bug,
  Code Adventure, Logic Puzzle, Treasure Hunt
- **XP/levels** (quadratic curve) · **coins** · **stars (1–3)** · **streaks** (UTC day)
- **9 data-driven achievements** (pure predicates) · **daily reward**
- **Unlockables:** 8 characters + 4 themes (coins / level-gated)
- **Settings:** sound, reduce-motion, reset progress

## 5. 🚧 Known limitations (honest)

| Item | Note |
| --- | --- |
| No cloud save | Progress is per-device (localStorage only). Clearing browser data = reset. |
| No accounts | Can't continue on another device. |
| No real leaderboard | No server to compare players. |
| AI mentor is canned | Predefined hints, not a real model. |
| No tests | No unit/e2e tests yet. |
| Sound toggle | State exists; actual sound effects not wired. |
| Lighthouse | Not measured here; app is static/light so 95+ is expected. |

---

# 6. 🟢 SUPABASE INTEGRATION GUIDE (future-ready, currently disabled)

Supabase can add **cloud save, accounts, real leaderboards, and a real AI mentor**
*without* abandoning the offline-first design. The app stays usable with zero config;
Supabase activates only when env vars are present.

## 6.1 What Supabase can power here

| Feature | Supabase service | Priority |
| --- | --- | --- |
| ☁️ Cloud save / cross-device sync | Postgres + Auth | ⭐⭐⭐ highest value |
| 🔐 Accounts (kid-safe) | Auth (anonymous → email link) | ⭐⭐ |
| 🏆 Global / friends leaderboard | Postgres + RLS + (optional) RPC | ⭐⭐ |
| 🤖 Real AI mentor | Edge Function → LLM | ⭐ |
| 📦 Remote content (games/worlds) | Postgres tables | optional |
| 🖼️ Avatars / assets | Storage | optional |

## 6.2 Design principle — OFFLINE-FIRST, CLOUD-OPTIONAL

```
localStorage (instant, always works)  ←→  Supabase (sync when online + logged in)
```

- Keep `useGame` + `persist` as the source of truth on-device.
- On login: **pull** cloud row → merge (take the higher xp/stars) → **push** back.
- Debounced **push** on every meaningful change.
- If env vars missing → everything no-ops; the game works exactly as today.

## 6.3 Step-by-step setup

**1) Create project & install SDK**
```bash
npm install @supabase/supabase-js
```

**2) Env vars** (`.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```

**3) Guarded client** — `src/lib/supabase/client.ts`
```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Disabled by default: returns null until env vars are set.
export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { persistSession: true } }) : null;

export const isCloudEnabled = () => supabase !== null;
```

## 6.4 Database schema (SQL — run in Supabase SQL editor)

```sql
-- One progress row per player (mirrors the Zustand persisted state as JSONB).
create table public.progress (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  xp          int  not null default 0,
  coins       int  not null default 0,
  total_stars int  not null default 0,
  state       jsonb not null default '{}',   -- full useGame snapshot
  updated_at  timestamptz not null default now()
);

alter table public.progress enable row level security;

-- A player may only read/write their OWN row.
create policy "own row read"  on public.progress for select using (auth.uid() = user_id);
create policy "own row write" on public.progress for insert with check (auth.uid() = user_id);
create policy "own row update" on public.progress for update using (auth.uid() = user_id);

-- Public leaderboard view (read-only, no PII beyond chosen display name).
create view public.leaderboard as
  select display_name, xp, total_stars
  from public.progress
  order by xp desc
  limit 100;
```
> RLS = Row Level Security. It guarantees a child can never read another child's data.
> The `leaderboard` view only exposes `display_name + xp + stars`.

## 6.5 Kid-safe authentication

For 7–14 year-olds, avoid passwords. Two good options:

- **Anonymous sign-in** (recommended start): one tap, instant cloud save, no email.
  ```ts
  await supabase!.auth.signInAnonymously();
  ```
  Later, link a **parent email** (magic link) to recover the account across devices.
- **Magic link to a parent's email** (COPPA-friendly): no password, parent in the loop.
  ```ts
  await supabase!.auth.signInWithOtp({ email: parentEmail });
  ```

## 6.6 Sync layer — `src/lib/supabase/sync.ts`

```ts
import { supabase, isCloudEnabled } from './client';
import { useGame } from '@/store/useGame';

// PULL on login: merge cloud → local, keeping the best progress.
export async function pullProgress() {
  if (!isCloudEnabled()) return;
  const { data: { user } } = await supabase!.auth.getUser();
  if (!user) return;
  const { data } = await supabase!.from('progress').select('state, xp').eq('user_id', user.id).single();
  if (data?.state && data.xp >= useGame.getState().xp) {
    useGame.setState(data.state);           // cloud is ahead → adopt it
  } else {
    await pushProgress();                    // local is ahead → upload
  }
}

// PUSH (debounced) whenever progress changes.
let timer: ReturnType<typeof setTimeout> | null = null;
export function schedulePush() {
  if (!isCloudEnabled()) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(pushProgress, 1500);
}

export async function pushProgress() {
  if (!isCloudEnabled()) return;
  const { data: { user } } = await supabase!.auth.getUser();
  if (!user) return;
  const s = useGame.getState();
  const totalStars = Object.values(s.completed).reduce((n, r) => n + r.stars, 0);
  await supabase!.from('progress').upsert({
    user_id: user.id,
    xp: s.xp, coins: s.coins, total_stars: totalStars,
    state: { xp: s.xp, coins: s.coins, gems: s.gems, streak: s.streak,
             completed: s.completed, unlockedAchievements: s.unlockedAchievements,
             avatarId: s.avatarId, unlockedAvatars: s.unlockedAvatars,
             themeId: s.themeId, unlockedThemes: s.unlockedThemes },
    updated_at: new Date().toISOString(),
  });
}
```

**Wire-up (1 line in the store):** at the end of each mutating action call
`schedulePush()`, or subscribe once:
```ts
// in a top-level client component:
useEffect(() => useGame.subscribe(() => schedulePush()), []);
```

## 6.7 Real leaderboard hook

```ts
export async function fetchLeaderboard() {
  if (!isCloudEnabled()) return [];
  const { data } = await supabase!.from('leaderboard').select('*');
  return data ?? [];
}
```
Render it on a new `/leaderboard` page (or inside `/rewards`). Falls back to an empty
list when cloud is disabled.

## 6.8 Real AI mentor via Edge Function (replaces the `getHint()` seam)

The whole AI hook lives in **one function** — `src/data/hints.ts → getHint()`.
Swap its body to call a Supabase Edge Function (which holds the LLM key server-side):

```ts
// supabase/functions/hint/index.ts  (Deno Edge Function)
Deno.serve(async (req) => {
  const { game, attempt } = await req.json();
  // call your LLM here with a strict kid-safe system prompt; return { hint }
  return new Response(JSON.stringify({ hint: '...' }), { headers: { 'Content-Type': 'application/json' } });
});
```
```ts
// src/data/hints.ts  — only the body changes; signature stays the same
export async function getHint({ game, attempt }: HintRequest): Promise<string> {
  if (!isCloudEnabled()) return CANNED[game]?.[attempt % 3] ?? 'Try one small step!';
  const { data } = await supabase!.functions.invoke('hint', { body: { game, attempt } });
  return data?.hint ?? 'Try breaking it into tiny steps!';
}
```
> Keep the canned hints as the offline fallback so the app never breaks without internet.

## 6.9 Migration checklist (when you're ready)

- [ ] `npm i @supabase/supabase-js` + add 2 env vars
- [ ] Create `lib/supabase/client.ts` (guarded)
- [ ] Run the SQL (table + RLS + leaderboard view)
- [ ] Add anonymous sign-in button in `/rewards`
- [ ] Add `lib/supabase/sync.ts` + subscribe `schedulePush` once
- [ ] Call `pullProgress()` on app load after auth
- [ ] (optional) `/leaderboard` page + `fetchLeaderboard()`
- [ ] (optional) Edge Function for real AI mentor
- [ ] Verify: works **with** AND **without** env vars (offline-first intact)

## 6.10 Why this design is safe & clean

- **Zero risk to current app:** with no env vars, Supabase code no-ops; offline game unchanged.
- **One seam per concern:** sync (`sync.ts`), AI (`getHint`), auth (`/rewards`) — small, isolated.
- **Kid-safe by default:** RLS isolates each child; anonymous auth needs no personal data;
  leaderboard exposes only a chosen display name.
- **Reversible:** delete `lib/supabase/*` and the env vars to fully revert.

---

## 7. 🎯 Suggested next steps (pick one)

1. **Implement Supabase cloud save** (sections 6.3–6.6) — biggest user value.
2. Add **real leaderboard** page (6.7).
3. Wire **sound effects** (toggle already exists).
4. Add **PWA** (manifest + service worker) for installable offline play.
5. Add **more levels** per game + difficulty scaling.

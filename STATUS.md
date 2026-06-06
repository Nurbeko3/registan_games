# KidsCode Quest — Status Report

> Current repository state. The core product is still offline-first, but Supabase
> integrations now exist for student accounts, cloud save, leaderboard, admin tools,
> Party, and Battle Learn Arena rooms.
> Date: 2026-06-07 · Version: 2.0.0

---

## 1. ✅ What this project IS now

A **fun, offline-first educational game** for kids aged **7–14**. A child opens the
app, explores a world map, plays coding mini-games, earns XP/stars/coins, and unlocks
achievements. Core progress saves to `localStorage`; cloud sync is optional.

| | |
| --- | --- |
| Framework | Next.js 15 (App Router) + TypeScript |
| Styling | TailwindCSS + Framer Motion |
| State | Zustand + `persist` middleware (localStorage) |
| Backend | Optional Supabase RPC/Realtime for cloud features |
| Auth | Optional custom student/admin sessions |
| AI | offline "Byte" mentor (`getHint()` seam, ready for real AI) |

## 2. Verification

| Check | Command | Result |
| --- | --- | --- |
| Type safety | `npm run lint` / `npm run typecheck` | Project gate: `tsc --noEmit` |
| Production build | `npm run build` | Manual only; do not run automatically during dev cache issues |
| Tests | `npm test` | Added minimal Vitest suite when configured |

Primary routes: `/`, `/map`, `/play/[game]`, `/rewards`, `/arena`, `/leaderboard`,
`/party`, `/party/[code]`, `/admin`, plus `/api/admin/*` and `/api/arena/authority`.

## 3. 🗂️ Architecture (current)

```
src/
├── app/
│   ├── page.tsx              # Home — animated landing
│   ├── map/page.tsx          # World map — 5 zones, star-gated
│   ├── play/[game]/page.tsx  # Game runner (GameShell)
│   ├── rewards/page.tsx      # Profile · achievements · shop · settings · account
│   ├── arena/page.tsx        # Battle Learn Arena
│   ├── party/                # Cloud party mode
│   ├── leaderboard/page.tsx  # Cloud leaderboard
│   └── admin/page.tsx        # Admin UI
├── components/
│   ├── games/                # 16 games + GameShell + registry + GameProps
│   ├── arena/                # Arena menu/lobby/game UI
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

- **16 games:** Robot Maze, Memory Match, Binary Challenge, Algorithm Race, Fix the Bug,
  Code Adventure, Logic Puzzle, Treasure Hunt, Pattern Pop, Loop Output, Quick Math,
  Forest Trail, Train Robot, Build Page, Output Oracle, Summit Sort
- **XP/levels** (quadratic curve) · **coins** · **stars (1–3)** · **streaks** (UTC day)
- **Data-driven achievements** (pure predicates) · **daily reward**
- **Unlockables:** 8 characters + 4 themes (coins / level-gated)
- **Settings:** sound, reduce-motion, locale, reset progress

## 5. Cloud systems

- **Student accounts:** `src/lib/supabase/account.ts`, backed by `kcq_*` RPCs.
- **Cloud save:** debounced account sync via `AccountSync`.
- **Admin:** `/admin` + `/api/admin/*`, DB-issued token in `kcq_admin` HTTP-only cookie.
- **Leaderboard:** public ranking data from Supabase.
- **Party:** cloud-authoritative quiz party.
- **Arena:** Realtime presence/broadcast rooms with local practice always available.

## 6. Known limitations

- Supabase is optional; cloud-only features need env vars and migrations.
- Party currently has no local fallback.
- Arena multiplayer is friendly client-event netcode; not a competitive anti-cheat design.
- A real AI mentor is not connected yet; Byte uses offline hints.
- Production build should be run deliberately because `.next` cache issues have appeared in local dev.

## 7. Supabase setup

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`, then apply
`supabase/migrations/0001_*` through the latest migration. The project must keep
working when these variables are absent.
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

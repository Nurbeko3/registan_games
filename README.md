# 🎮 KidsCode Quest

> A **fun, offline-first adventure game** where kids aged **7–14** learn programming by
> playing — exploring worlds, beating coding mini-games, earning stars and leveling up.
> The core game works without a backend. Supabase adds student accounts, cloud save,
> leaderboard, admin tools, party mode, and realtime arena rooms when configured.

[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org)
[![Offline](https://img.shields.io/badge/storage-localStorage-green)](#)

## ✨ Highlights

- 🌍 **World map** with 5 zones that unlock as you earn stars
- 🎲 **16 playable mini-games**, each teaching a real coding skill
- ⭐ **Offline gamification** — XP, levels, coins, streaks, achievements, daily rewards
- 🧑‍🚀 **Unlockable characters & themes** bought with coins
- 🤖 **Byte**, an offline AI mentor that gives kid-friendly hints
- 💾 Everything saved to **localStorage** via Zustand Persist — works offline
- 🏆 Optional Supabase cloud: student accounts, leaderboard, admin panel, Party, Arena rooms
- ⚡ Core game needs no backend, auth, or database — cloud features no-op when disabled

## 🧱 Tech Stack

Next.js 15 (App Router) · TypeScript · TailwindCSS · Zustand (+ persist) · Framer Motion · optional Supabase.

> Supabase is additive: account sync, leaderboard, admin tools, and multiplayer rooms.
> Without Supabase env vars, the core game continues to work from localStorage.

## 🚀 Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run lint     # TypeScript correctness gate
npm run typecheck
```

## 🗂️ Structure

```
src/
├── app/
│   ├── page.tsx              # Home (animated landing)
│   ├── map/                  # World map
│   ├── play/[game]/          # Game runner
│   ├── rewards/              # Profile · achievements · shop · settings · account
│   ├── arena/                # Battle Learn Arena
│   ├── party/                # Shared quiz party
│   ├── leaderboard/          # Cloud leaderboard
│   └── admin/                # Student/admin management
├── components/
│   ├── games/                # 16 games + GameShell + registry
│   ├── arena/                # Arena lobby, practice setup, HUD, debug panel
│   ├── layout/TopBar.tsx     # player HUD
│   ├── AIMentor.tsx          # offline "Byte"
│   ├── Celebrations.tsx      # achievement popups + confetti
│   ├── AppChrome.tsx         # theme + motion config
│   └── ui/                   # reusable bits
├── data/                     # games, worlds, achievements, cosmetics, hints
├── lib/leveling.ts           # XP curve + streak math
└── store/useGame.ts          # the single source of truth (persisted)
```

## 🎲 The games

| Game | Skill |
| --- | --- |
| 🤖 Robot Maze | Sequencing |
| 🧠 Memory Match | Memory |
| 🔢 Binary Challenge | Binary numbers |
| ⚡ Algorithm Race | Sorting |
| 🐛 Fix the Bug | Debugging |
| 🗺️ Code Adventure | Loops & conditions |
| 🧩 Logic Puzzle | Algorithms |
| 💎 Treasure Hunt | Deduction |
| 🟣 Pattern Pop | Memory |
| 🔮 Loop Output | Loops |
| 🧮 Quick Math | Numbers |
| 🌲 Forest Trail | Conditionals |
| 🚂 Train Robot | Sequencing |
| 🏗️ Build Page | HTML/CSS |
| 🔮 Output Oracle | Code tracing |
| ⛰️ Summit Sort | Sorting |

## Cloud features

Supabase is optional and additive:

- Student accounts use custom Postgres RPCs in `src/lib/supabase/account.ts`.
- Admin auth uses DB-issued session tokens in an HTTP-only `kcq_admin` cookie.
- Leaderboard reads public ranking data only.
- Arena rooms use Realtime presence/broadcast; persistence tables are optional analytics/reconnect support.
- Party mode requires cloud because answers and scoring are RPC-authoritative.

When `NEXT_PUBLIC_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` is absent, cloud-only
features show disabled states while the core game keeps running from localStorage.

Made with 💜 for young coders. **Code. Play. Grow.**

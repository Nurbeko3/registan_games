# 🎮 KidsCode Quest

> A **fun, frontend-only adventure game** where kids aged **7–14** learn programming by
> playing — exploring worlds, beating coding mini-games, earning stars and leveling up.
> No backend, no sign-up, no studying. Just play.

[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org)
[![Offline](https://img.shields.io/badge/storage-localStorage-green)](#)

## ✨ Highlights

- 🌍 **World map** with 5 zones that unlock as you earn stars
- 🎲 **11 playable mini-games**, each teaching a real coding skill
- ⭐ **Offline gamification** — XP, levels, coins, streaks, achievements, daily rewards
- 🧑‍🚀 **Unlockable characters & themes** bought with coins
- 🤖 **Byte**, an offline AI mentor that gives kid-friendly hints
- 💾 Everything saved to **localStorage** via Zustand Persist — works offline
- ⚡ Core game needs no backend, auth, or database — Supabase features are optional

## 🧱 Tech Stack

Next.js 15 (App Router) · TypeScript · TailwindCSS · Zustand (+ persist) · Framer Motion · optional Supabase.

> Supabase is additive: account sync, leaderboard, admin tools, and multiplayer rooms.
> Without Supabase env vars, the core game continues to work from localStorage.

## 🚀 Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run lint     # non-interactive CI gate (TypeScript)
```

## 🗂️ Structure

```
src/
├── app/
│   ├── page.tsx              # Home (animated landing)
│   ├── map/                  # World map
│   ├── play/[game]/          # Game runner
│   └── rewards/              # Profile · achievements · shop · settings
├── components/
│   ├── games/                # 11 games + GameShell + registry
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

Made with 💜 for young coders. **Code. Play. Grow.**

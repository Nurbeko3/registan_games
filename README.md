# 🎮 KidsCode Quest

> A **fun, frontend-only adventure game** where kids aged **7–14** learn programming by
> playing — exploring worlds, beating coding mini-games, earning stars and leveling up.
> No backend, no sign-up, no studying. Just play.

[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org)
[![Offline](https://img.shields.io/badge/storage-localStorage-green)](#)

## ✨ Highlights

- 🌍 **World map** with 5 zones that unlock as you earn stars
- 🎲 **8 playable mini-games**, each teaching a real coding skill
- ⭐ **Offline gamification** — XP, levels, coins, streaks, achievements, daily rewards
- 🧑‍🚀 **Unlockable characters & themes** bought with coins
- 🤖 **Byte**, an offline AI mentor that gives kid-friendly hints
- 💾 Everything saved to **localStorage** via Zustand Persist — works offline
- ⚡ No backend, no auth, no database — static & fast (Lighthouse-friendly)

## 🧱 Tech Stack

Next.js 15 (App Router) · TypeScript · TailwindCSS · Zustand (+ persist) · Framer Motion.

> Supabase is intentionally **not wired up** — the `getHint()` seam in `src/data/hints.ts`
> is the single place to add a real AI/cloud later.

## 🚀 Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
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
│   ├── games/                # 8 games + GameShell + registry
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

Made with 💜 for young coders. **Code. Play. Grow.**

# Case Files — Frontend UX Specification

> Author: frontend-master agent. Status: BUILD-READY DESIGN SPEC.
> Produced: 2026-06-09. Sources: `00-BRIEF.md` (SCOPE-LOCKED) · `01-PRODUCT-AND-GDD.md` ·
> `03-BACKEND-ARCHITECTURE.md` · existing `/party`, `/quest`, `Icon.tsx`, `useParty.ts` patterns.
>
> This document is a design-pass spec (wireframes + architecture + component contracts).
> It does NOT contain production TypeScript — that is the implementation pass.

---

## 0. Design Principles (locked before any wireframe)

1. **Sources stay reachable during questions.** This is the core pedagogy. Never hide the Sources
   pane during a question round — the segmented toggle must always be visible.
2. **Speed bonus is invisible to the player during the round.** It is a tiebreaker computed
   server-side. Show it only on the results screen as "+N speed XP" in small text. Never show
   a countdown timer styled as "answer faster to win."
3. **The investigation phase has no countdown anxiety.** Show a soft progress indicator
   ("Most players ready") but never a large ticking clock. The reading time is intentionally
   un-penalized (brief §1.3).
4. **Offline-first Bot Practice; explicit error for multiplayer offline** (brief §9.4 LOCKED):
   - Bot Practice: works 100% offline, localStorage only.
   - Private Room + Classroom Tournament: require Supabase. Show a clear, non-scary message:
     "Multiplayer requires a connection" with a "Try Bot Practice" CTA. Mirror `/party` pattern.
5. **Teacher UX is a hard-constraint critical path** (brief §8.5 LOCKED): admin case-picker →
   room code → student join → launch must be achievable in under 3 minutes. Every extra tap is
   a failure.
6. **COPPA-safe join**: students enter display name only (max 30 chars), no account, no email.
   The join screen must never ask for age, email, or any personal data.
7. **Rank badge is a social moment**: when a student's Detective Rank advances during a classroom
   session, the result screen highlights it. Teachers can call it out.

---

## 1. Route Map

All new routes live under `/case` (mirrors `/party` at `/party/[code]`).

```
/case                    → Mode-select + entry hub (CaseHomePage)
/case/create             → Create room wizard (host only) (CaseCreatePage)
/case/[code]             → Join + waiting room + in-game for all players (CaseRoomPage)
/case/[code]/play        → NOT a separate route — the play screen renders
                           inside /case/[code] based on phase state.
                           (same pattern as /party/[code] which handles all phases)
/case/result             → Result card standalone view + PNG share
                           (navigated to after match end; also embeddable)
```

### Admin-only route extension (teacher classroom flow)

```
/admin                   → Existing admin panel (unchanged)
/admin/cases             → NEW: Case picker + classroom tournament launcher
                           (renders inside the existing /admin layout, gated by requireAdmin)
```

### React 19 param unwrapping

`/case/[code]` receives `params: Promise<{ code: string }>` — unwrap with `use(params)`:

```typescript
// src/app/case/[code]/page.tsx
import { use } from 'react';
export default function CaseRoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  // pass `code` to CaseRoomScreen client component
}
```

The page shell is a server component. The interactive `CaseRoomScreen` is `'use client'`.

---

## 2. Screen-by-Screen Flow

### Phase Machine (maps to DB `kcq_case_rooms.phase`)

```
connecting → lobby → investigation → question → reveal → ended
```

Each screen below maps to one phase. The `useCaseRoom` hook (§4) drives transitions;
components never call RPCs directly.

---

### 2.1 Mode Select — `/case`

**Purpose:** Entry point. Explains the three modes; routes to create/join/bot-practice.

**Mobile wireframe (375 px):**

```
┌──────────────────────────────┐
│  TopBar (showBack=false)      │
├──────────────────────────────┤
│  [🔍] Case Files             │
│  Hujjatlarni o'qi, sir       │
│  yechimini top               │
├──────────────────────────────┤
│ ┌────────────────────────┐   │
│ │  🤖  Bot Practice      │   │
│ │  Solo · Offline · Free │   │
│ │  [ Play alone → ]      │   │
│ └────────────────────────┘   │
│                              │
│ ┌────────────────────────┐   │
│ │  👥  Private Room      │   │
│ │  Up to 8 friends       │   │
│ │  [ Create room → ]     │   │
│ │  [ Join with code ]    │   │
│ └────────────────────────┘   │
│                              │
│ ┌────────────────────────┐   │
│ │  🏫  Classroom         │   │
│ │  Teacher-led session   │   │
│ │  [ Admin panel → ]     │   │
│ └────────────────────────┘   │
│                              │
│  [offline banner if !cloud]  │
└──────────────────────────────┘
```

**Desktop (≥1024 px):** Three cards in a horizontal row, max-w-4xl, centered.

**Offline state**: If `!isCloudEnabled()`, Private Room and Classroom cards show a
`<Icon name="signal" />` overlay badge + "Requires internet" caption. Bot Practice card
is always full-opacity. This mirrors the `/party` offline card pattern exactly.

**Key component:** `CaseHomePage` (server component shell + `CaseModeCards` client component
gated on `useHydrated()`).

**Name input**: Reuse the player name from `useGame((s) => s.playerName)`. Show the same
avatar + name input card as `/party`. For Bot Practice, the name is local-only. For
Private Room, it becomes the `display_name` passed to `kcq_case_join`.

---

### 2.2 Create Room — `/case/create`

**Purpose:** Host picks a case, sets gradeBand filter, receives a room code to share.

**Mobile wireframe:**

```
┌──────────────────────────────┐
│  ← Back    Create a Room     │
├──────────────────────────────┤
│  Step 1 of 2                 │
│  ─────●─────○────            │
│                              │
│  Pick a Case                 │
│  Filter: [ All ▼ ] [ Ages ▼ ]│
│                              │
│  ┌────────────────────────┐  │
│  │ [🔍] Museum Heist      │  │
│  │ Ages 10-12 · History   │  │
│  │ 6 questions · 3 sources│  │
│  │ ★★★ (your best)        │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │ [🔍] Space Station X   │  │
│  │ Ages 12-14 · Science   │  │
│  │ 5 questions · 4 sources│  │
│  └────────────────────────┘  │
│  [more cases...]             │
│                              │
│  [ Next → ]  (disabled until │
│               case selected) │
└──────────────────────────────┘
```

**Step 2 (room options):**

```
┌──────────────────────────────┐
│  Step 2 of 2                 │
│  ─────●─────●────            │
│                              │
│  Museum Heist  ✓             │
│                              │
│  Room Mode                   │
│  ○ Private (friends join)    │
│  ○ Bot Practice (solo)       │
│                              │
│  [ Create Room ]             │
└──────────────────────────────┘
```

After "Create Room":
- Calls `kcq_case_create(code, hostId, caseId, is_classroom=false)`.
- Stores `host_token` in `sessionStorage` under key `kcq.case.session.${code}`.
- Navigates to `/case/[code]` with the host flag.

**Key component:** `CaseCreatePage` (`'use client'`). Uses `CASES` data from
`src/data/cases/index.ts`. The case list is client-side data (like `GAMES` / `CODECASTER_LEVELS`).
`gradeBand` and `subject` filters are local state — no network needed until "Create Room."

---

### 2.3 Join Room — `/case/[code]` (phase: `connecting` → `lobby`)

**Purpose:** Student (or friend) enters display name and joins. No account required.

**Mobile wireframe (join entry — before joining):**

```
┌──────────────────────────────┐
│  TopBar (showBack=true)       │
├──────────────────────────────┤
│                              │
│     🔍 Join Case Files       │
│                              │
│  Room: [ X K Q B ]           │
│                              │
│  Your name                   │
│  ┌──────────────────────┐    │
│  │ Aziz                 │    │
│  └──────────────────────┘    │
│  max 30 characters           │
│                              │
│  [ Join Room ]               │
│                              │
│  ─ or ─                      │
│  Already joined?             │
│  [ Reconnect ]               │
└──────────────────────────────┘
```

"Join Room" calls `kcq_case_join(code, playerId, displayName)`. On success → waiting lobby.
"Reconnect" checks `sessionStorage` for an existing `kcq.case.session.${code}` entry and
skips the name input if found (idempotent `kcq_case_join` pattern from `useParty.ts`).

**Error states:**
- `reason: 'notfound'` → "Room not found. Check the code." + Back button.
- `reason: 'full'` → "Room is full (8 players max). Ask the host to increase capacity."
- `!isCloudEnabled()` → "Multiplayer requires a connection. Try Bot Practice instead."
  (shown immediately on mount, no network call needed)

---

### 2.4 Waiting Room (Lobby) — `/case/[code]` (phase: `lobby`)

**Mobile wireframe:**

```
┌──────────────────────────────┐
│  TopBar (showBack=true)       │
├──────────────────────────────┤
│  ┌──────────────────────┐    │
│  │  Museum Heist        │    │
│  │  Ages 10-12 · History│    │
│  │  6 questions         │    │
│  └──────────────────────┘    │
│                              │
│  Room Code                   │
│  ┌──────────────────────┐    │
│  │   X  K  Q  B  7      │    │ ← large, tappable copy-to-clipboard
│  └──────────────────────┘    │
│  Share this code to invite!  │
│                              │
│  Players (3/8)               │
│  ● Aziz           (host 👑)  │
│  ● Nilufar                   │
│  ● Jasur                     │
│  · · ·  (waiting)           │
│                              │
│  [HOST ONLY]                 │
│  [ Start Investigation → ]   │
│                              │
│  [PLAYER]                    │
│  Waiting for host to start…  │
└──────────────────────────────┘
```

**Desktop (≥768 px):** Two-column: case info card left, player list right. Max-w-2xl.

**Player list design:**
- Each player: avatar emoji (from presence meta) + display name + "(you)" badge for self.
- Host: crown icon `<Icon name="crown" />` + "(host)" suffix.
- Presence-driven: real-time via Supabase Presence (same as `useParty.ts`).
- Max 8 entries; list is scrollable if needed (though 8 entries fit on mobile).

**Case preview card:**
- `case.briefing` text (1-2 sentences setup).
- Source count, question count, gradeBand badge.
- Subject tag (Reading / History / Science / Logic) with distinct colour per subject:
  `reading` = grape, `history` = mango, `science` = mint, `logic` = sky.

**Host-only controls:** "Start Investigation" button, disabled if only 1 player (Bot Practice
creates 3 bots automatically — show them as "🤖 Bot 1", "🤖 Bot 2", "🤖 Bot 3" in the player
list immediately on Bot Practice mode start).

---

### 2.5 Investigation Phase — phase: `investigation`

**This is the most important screen.** Kids read the sources before answering. No timer
pressure. A soft "players ready" social indicator shows progress without penalising slow readers.

**Mobile wireframe:**

```
┌──────────────────────────────┐
│  ← Case Files    [Sources|Q] │ ← segmented toggle (Sources active)
├──────────────────────────────┤
│  [🔍] Museum Heist           │
│  Read all sources before     │
│  the first question opens.   │
│                              │
│  Sources (4)                 │
│  ┌──────────────────────┐    │
│  │ 📋 Security Report   │ ← │ ← tap to expand/open
│  │    [READ ✓]          │   │
│  └──────────────────────┘    │
│  ┌──────────────────────┐    │
│  │ 💬 Chat Log          │   │
│  └──────────────────────┘    │
│  ┌──────────────────────┐    │
│  │ 📧 Email: Dr. Morgan │   │
│  └──────────────────────┘    │
│  ┌──────────────────────┐    │
│  │ 📝 Curator's Note    │   │
│  └──────────────────────┘    │
│                              │
│  Players ready: 2/3          │ ← soft progress, no countdown
│                              │
│  [HOST] [ Start Questions → ]│
│  [STUDENT] Waiting…          │
└──────────────────────────────┘
```

**Source document view (expanded, full-pane on mobile):**

```
┌──────────────────────────────┐
│  ← Back to Sources           │
│  📋 Security Report          │
│  ─────────────────────────── │
│  STAFF: Alex Kim             │
│  ROLE:  Night Security Guard │
│  DATE:  March 3, 20XX        │
│  ─────────────────────────── │
│  "I left my post at 11:47 PM │
│   to check the east wing     │
│   alarm. When I returned     │
│   at 12:02 AM, the artifact  │
│   was gone..."               │
│                              │
│  [✓ Read — back to sources] │
└──────────────────────────────┘
```

**Source card styles by `kind`:**
- `profileCard` → person icon + name + role fields; clean card layout.
- `chatLog` → bubble-style messages, alternating left/right, timestamps.
- `email` → "From / To / Subject / Date" header block, then body.
- `note` → lined paper aesthetic (subtle bg, slightly irregular font style via `italic`).
- `ticket` → receipt/ticket look with dashed border and monospace details.

**Desktop layout (≥1024 px):**

```
┌────────────────────┬─────────────────────┐
│  SOURCES PANEL     │  INVESTIGATION INFO  │
│  ─────────────     │  ─────────────────── │
│  📋 Security Rpt ✓ │  [🔍] Museum Heist  │
│  💬 Chat Log       │                     │
│  📧 Email (exp.)   │  Read all 4 sources │
│     [full text     │  before questions   │
│      here in       │  start.             │
│      expanded      │                     │
│      card]         │  Players ready: 2/3 │
│  📝 Curator's Note │                     │
│                    │  [Host: Start →]    │
└────────────────────┴─────────────────────┘
```

Desktop: sources panel is left column (fixed, scrollable), info panel is right.
No segmented toggle on desktop — both visible simultaneously.
Expanded source replaces the info panel content on the right (no modal — avoids focus trap issues
during reading).

**"Read" tracking (local state only):**
- A `Set<string>` of `source.id` values the player has opened.
- When all sources are opened: show a "You've read all sources — ready!" badge.
- This is cosmetic/social only; the host decides when to start questions.
- Reading is tracked locally in the component state; it is NOT sent to the server
  (no need, not scored).

---

### 2.6 Question Round — phase: `question`

**THE most critical screen.** Sources must remain accessible during answering.

**Mobile wireframe (question active):**

```
┌──────────────────────────────┐
│  Q 2 / 6   [Sources | Q ✓]  │ ← toggle; "Q" pane is active
│  ████████░░░░  Score: 145    │ ← streak indicator + score
├──────────────────────────────┤
│                              │
│  Based on the sources,       │
│  what time did Alex Kim      │
│  leave his post?             │
│                              │
│  ○  11:30 PM                 │
│  ○  11:47 PM  ← answer       │
│  ○  12:00 AM                 │
│  ○  12:15 AM                 │
│                              │
│  [ 💡 Open a hint ]          │
│                              │
│  Answered: 1 / 3 players    │ ← live feed, no names (privacy)
└──────────────────────────────┘
```

**Mobile wireframe (Sources pane during question):**

```
┌──────────────────────────────┐
│  Q 2 / 6   [Sources ✓ | Q]  │ ← Sources pane active
├──────────────────────────────┤
│  Sources (4)                 │
│  ┌──────────────────────┐    │
│  │ 📋 Security Report ✓ │    │ ← was read in investigation
│  └──────────────────────┘    │
│  ┌──────────────────────┐    │
│  │ 💬 Chat Log ✓        │    │
│  └──────────────────────┘    │
│  ─────────────────────────── │
│  Tap a source to re-read it. │
│  Then go back to answer.     │
└──────────────────────────────┘
```

**Desktop (≥1024 px):**

```
┌────────────────────┬─────────────────────┐
│  SOURCES PANEL     │  QUESTION PANEL      │
│  (always visible)  │  ─────────────────── │
│                    │  Q 2 / 6            │
│  📋 Security Rpt ✓ │  ─────────────────── │
│  💬 Chat Log ✓     │                     │
│  📧 Email (exp.)   │  What time did...   │
│     [full text]    │                     │
│  📝 Note           │  ○ 11:30 PM         │
│                    │  ○ 11:47 PM         │
│                    │  ○ 12:00 AM         │
│                    │  ○ 12:15 AM         │
│                    │                     │
│                    │  [💡 Hint]          │
│                    │  Answered: 1/3      │
└────────────────────┴─────────────────────┘
```

**Design details:**
- Answer options: large tap targets (min 48px height on mobile, `py-3 px-4 rounded-2xl`).
  Full-width buttons. Border: `border-2 border-grape-100` idle; `border-grape bg-grape-50`
  on selection. No green/red until reveal phase.
- Once answered (selected !== null): option buttons become visually locked
  (`pointer-events-none`). The "Answered: N/M players" counter increments live via Realtime.
- Hint: calls `kcq_case_open_hint` RPC then shows hint text inline below the question.
  After opening, hint button label changes to "Hint opened (no 3★)". Max 1 hint per question
  in MVP (the 3-star gate: any hint = cannot get 3★ for this run).
- Speed: no speed-countdown displayed. The 45-second window exists server-side; the player
  simply answers when ready.
- "Host advance": Host sees an extra button "[Next question →]" only after all players have
  answered OR after a reasonable wait. This button triggers `kcq_case_advance_reveal`.

---

### 2.7 Reveal — phase: `reveal`

**Purpose:** Show who got it right, reveal the evidence source, teach the moment.

**Mobile wireframe:**

```
┌──────────────────────────────┐
│  Q 2 / 6  — Reveal           │
├──────────────────────────────┤
│  Based on the sources,       │
│  what time did Alex Kim      │
│  leave his post?             │
│                              │
│  ✓  11:47 PM  ← CORRECT      │ ← green highlight
│  ✗  12:00 AM                 │ ← red if player chose wrong
│  (other options greyed)      │
│                              │
│  ┌──────────────────────┐    │
│  │ 🔍 Found in:         │    │
│  │ "Security Report"    │    │
│  │ "I left my post at   │    │
│  │  11:47 PM to check…" │    │ ← highlighted excerpt
│  └──────────────────────┘    │
│                              │
│  You got it right! +15 XP   │
│  🔥 Streak x1.2 (+18 XP)    │ ← if streak active
│  ⚡ Speed bonus: +3 XP       │ ← small, secondary
│                              │
│  Leaderboard snapshot        │
│  1. Aziz     158 pts  (you)  │
│  2. Nilufar  142 pts         │
│  3. Jasur    98 pts          │
│                              │
│  [HOST] [ Next question → ]  │
│  [STUDENT] Waiting for host… │
└──────────────────────────────┘
```

**Evidence highlight box:** When `question.evidenceSourceId` is set, show a quoted excerpt
from that source with the source title and a "Found in:" label. In MVP, the excerpt is the
full source body with the relevant passage pre-highlighted via `<mark>`. The highlighted
passage is authored in the case data as `question.evidencePassage` (a substring of the
source body — rendered with surrounding context, highlighted in amber/sun background).

**Leaderboard snapshot (max 8 rows):** Already fits on screen. No virtualisation needed at
8-player cap. Show rank delta ("↑ 1") with subtle colour: green = gained positions,
red = lost, grey = same.

**Bot Practice — solo mode:** The evidence highlight and teaching moment are ALWAYS shown
in Bot Practice, even for correct answers. In multiplayer, the evidence is shown but the
teaching-moment text is minimal (teacher drives the discussion in classroom mode).

---

### 2.8 Live Scoreboard (Between Questions)

This is embedded within the `reveal` phase UI (see §2.7 bottom section). It is NOT a separate
screen/phase. The `reveal` phase already shows the mini-leaderboard inline. The host taps
"Next question" to advance, giving the teacher a natural pause window for discussion.

**Classroom-specific addition in reveal phase (teacher-only view):**

```
  Per-question accuracy heatmap (v1.1 fast-follow, collect data now):
  Q2: ✓ 2/3 players correct  [78%]
  "11:47 PM" was correct — 2 chose it, 1 chose 12:00 AM.
```

In v1 MVP this is hidden. The data is in `answered` jsonb but not surfaced in the UI.

---

### 2.9 Results Screen — phase: `ended`

**Purpose:** Final score, stars, rank badge, XP/coin reward animation, shareable card.

**Mobile wireframe:**

```
┌──────────────────────────────┐
│  Case Solved!  (or: Case     │
│  Closed — try again!)        │
├──────────────────────────────┤
│  Museum Heist                │
│                              │
│  ★ ★ ★  (3 stars / 2 / 1 / │
│           0 animated)        │
│                              │
│  Your score: 158 pts         │
│  Rank: #1 of 3               │
│                              │
│  ┌──────────────────────┐    │
│  │  Detective Badge     │    │
│  │  🔍 Junior Detective │    │ ← rank badge
│  │  1,350 case XP       │    │
│  └──────────────────────┘    │
│                              │
│  XP earned: +120             │ ← case-solve XP (anti-farm delta applied)
│  Coins:     +24              │
│  Per-answer XP: +90          │
│                              │
│  Best Evidence Find          │
│  ┌──────────────────────┐    │
│  │ Q3: "Where was the   │    │
│  │ key hidden?"         │    │
│  │ Answered in 8s, no   │    │
│  │ hint — fastest find! │    │
│  └──────────────────────┘    │
│                              │
│  Final Leaderboard           │
│  1. Aziz     158 pts ← (you) │
│  2. Nilufar  142 pts         │
│  3. Jasur     98 pts         │
│                              │
│  [ 📤 Share Result Card ]    │
│  [ Play Again ]              │
│  [ Choose Another Case ]     │
│  [ ← Back to Cases ]         │
└──────────────────────────────┘
```

**Star animation:** 3 stars animate in one-by-one (0 → 1 → 2 → 3) with a subtle scale
bounce. Respects `prefers-reduced-motion` — if reduced, all stars appear instantly.

**Rank advancement moment:** If `caseXp` crosses a rank threshold during this session, show
an additional banner above the stars:
```
  ┌──────────────────────────────┐
  │  🎉 RANK UP!                 │
  │  You are now a              │
  │  Detective Sergeant!        │
  └──────────────────────────────┘
```
This is detected by comparing the rank before and after `caseMatchEnd()` store action.

**"Best Evidence Find":** The question where the player answered correctly in the shortest
time without opening a hint. Derived client-side from the `answered` jsonb returned in
`kcq_case_end_match` response. If no such question exists (all wrong, or all with hints),
this section is hidden.

**Desktop:** Two-column: left = stars + badge + XP summary; right = final leaderboard + share.

---

### 2.10 Shareable Result Card — `/case/result`

A fixed-size (600×400 px) card component rendered client-side and exported as PNG via
`html2canvas` (or equivalent). The card is also navigable directly at `/case/result?code=XKQB7`
for share links (reads result from `sessionStorage`, never from the DB directly — the data
is passed via `sessionStorage` key `kcq.case.result.${code}` after match end).

**Result card layout (600×400 px):**

```
┌──────────────────────────────────────────────┐
│  KidsCode Quest · Case Files                 │
│  ────────────────────────────────────────    │
│  🔍  Museum Heist                            │
│                                              │
│  ★ ★ ★        Score: 158         #1 of 3    │
│                                              │
│  ┌────────────────┐  Best Evidence Find:     │
│  │  🔍            │  "I left my post at       │
│  │  Junior        │   11:47 PM…"              │
│  │  Detective     │  — Security Report, Q3   │
│  └────────────────┘                          │
│                                              │
│  kids-code-quest.vercel.app                  │
└──────────────────────────────────────────────┘
```

**Colours:** Use the `grape` / `sun` gradient from the project palette. Dark background
(dark mode result card looks better in screenshots). Fixed font sizes (not responsive — this
is a fixed-pixel export target). The card is rendered off-screen in a `hidden` div and
captured by `html2canvas`. The PNG download uses a `<a download>` link.

**No server needed.** This is pure client-side canvas. Works offline (even for multiplayer
results that were cached in `sessionStorage` before going offline).

---

## 3. Two-Pane Sources | Question Layout (Detailed)

This section specifies the core UI pattern in full detail, since it drives every question-phase
interaction.

### 3.1 Mobile (< 1024 px): Segmented Toggle

Exactly mirrors `PlayScreen.tsx` in Codecaster. Same `PaneTab` component reused (or a
shared `SegmentedTabs` component extracted to `src/components/ui/SegmentedTabs.tsx`).

```
type CasePane = 'sources' | 'question';
const [pane, setPane] = useState<CasePane>('question');
```

The toggle sits immediately below the TopBar, above the content area.

```
┌─────────────────────────┐
│  [  Sources  | Question ✓ ]   ← ARIA role="tablist"
└─────────────────────────┘
```

- "Sources" tab: shows `<Icon name="file-text" />` (new icon — see §8).
- "Question" tab: shows `<Icon name="help-circle" />` (new icon — see §8).

Tab labels include a read-count badge: "Sources (3/4 read)" during investigation.
During question phase: "Sources" tab gets a subtle amber dot if the current question's
`evidenceSourceId` points to an unread source (nudge to go read it, but never mandatory).

**Critical behaviour:** The toggle is ALWAYS visible during question and reveal phases.
It must never disappear or be hidden (this would break the core pedagogy). The only phases
where the toggle is absent: `lobby` and `ended` (those screens don't need it).

### 3.2 Desktop (≥ 1024 px): Side-by-Side

```typescript
// Always side-by-side on desktop; no toggle needed.
<div className="grid items-start gap-5 lg:grid-cols-[1.1fr_1fr]">
  <SourcesPanel sources={case.sources} readSet={readSet} />
  <QuestionPanel question={currentQ} onAnswer={handleAnswer} ... />
</div>
```

Sources panel: fixed-height with internal scroll (`max-h-[calc(100vh-8rem)] overflow-y-auto`).
Question panel: no overflow needed for 4-option MCQ.

### 3.3 Source Panel Architecture

```
SourcesPanel
 ├─ SourceCard (collapsed — shows icon + title + read badge)
 │   └─ [click to expand]
 └─ ExpandedSource (replaces panel content, has ← back)
     ├─ ProfileCardView   (kind='profileCard')
     ├─ ChatLogView       (kind='chatLog')
     ├─ EmailView         (kind='email')
     ├─ NoteView          (kind='note')
     └─ TicketView        (kind='ticket')
```

On mobile, expanding a source replaces the entire Sources pane content (not a modal).
On desktop, expanding a source replaces the right portion of the sources panel with the
full text. No modal, no scroll-lock — fully accessible navigation within the panel.

**Source type visual vocabulary:**

| kind          | icon          | bg style                        | font style       |
|---------------|---------------|---------------------------------|------------------|
| `profileCard` | `user`        | Clean white card, field rows    | Regular          |
| `chatLog`     | `message`     | Bubble groups, timestamps       | Regular          |
| `email`       | `mail`        | Header block + body divider     | Regular          |
| `note`        | `notebook`    | Off-white, subtle line rule     | Italic body      |
| `ticket`      | `ticket`      | Dashed border, monospace fields | Monospace fields |

Note: `message`, `mail`, `notebook`, `ticket` are new `IconName` entries (see §8).

---

## 4. Component Architecture

### 4.1 File Structure

```
src/
 app/
   case/
     page.tsx                  ← server component (CaseHomePage shell)
     create/
       page.tsx                ← server component (CaseCreatePage shell)
     [code]/
       page.tsx                ← server component; use(params) unwrap; passes code to client
     result/
       page.tsx                ← server component; passes query params to client component
   admin/
     cases/
       page.tsx                ← server component (admin panel extension, gated by requireAdmin)

 components/
   caseFiles/
     CaseHomePage.tsx          ← 'use client' — mode cards + offline gate + name input
     CaseCreatePage.tsx        ← 'use client' — case picker wizard
     CaseRoomScreen.tsx        ← 'use client' — orchestrator; renders phase-based screens
     lobby/
       LobbyScreen.tsx         ← 'use client'
       PlayerList.tsx          ← 'use client'
       CasePreviewCard.tsx     ← presentational (no 'use client' needed)
     investigation/
       InvestigationScreen.tsx ← 'use client'
       SourcesPanel.tsx        ← 'use client' (manages expand/collapse state)
       SourceCard.tsx          ← presentational
       SourceViews/
         ProfileCardView.tsx   ← presentational
         ChatLogView.tsx       ← presentational
         EmailView.tsx         ← presentational
         NoteView.tsx          ← presentational
         TicketView.tsx        ← presentational
     question/
       QuestionScreen.tsx      ← 'use client'
       AnswerOptions.tsx       ← 'use client' (handles selection + locking)
       HintBox.tsx             ← 'use client'
       AnswerProgress.tsx      ← presentational (live "N/M answered" count)
     reveal/
       RevealScreen.tsx        ← 'use client'
       EvidenceHighlight.tsx   ← presentational
       InlineLeaderboard.tsx   ← presentational
     results/
       ResultsScreen.tsx       ← 'use client'
       StarDisplay.tsx         ← presentational (animated stars)
       RankBadge.tsx           ← presentational
       ResultCard.tsx          ← 'use client' (html2canvas PNG export)
     shared/
       SegmentedTabs.tsx       ← pure presentational; extracted from Codecaster PaneTab

 lib/
   caseFiles/
     useCaseRoom.ts            ← 'use client' hook; mirrors useParty.ts
     botEngine.ts              ← Bot Practice simulation (client-side, no Supabase)
     resultCard.ts             ← PNG export helper (html2canvas wrapper)
     cloud.ts                  ← save/load/leaderboard (no-ops offline; mirrors codecaster/cloud.ts)

 data/
   cases/
     index.ts                  ← CASES array + getCase(id) + CASES_BY_GRADE + CASES_BY_SUBJECT
     types.ts                  ← Case, SourceDoc, Question types (answerIndex SERVER-ONLY marker)
     ranks.ts                  ← DETECTIVE_RANKS array + rankForCaseXp(xp) pure fn
     C01_museum_heist.ts       ← seed case 1
     C02_space_station.ts      ← seed case 2
     C03_forest_mystery.ts     ← seed case 3
     C04_city_cipher.ts        ← seed case 4
     C05_time_capsule.ts       ← seed case 5
```

### 4.2 `CaseRoomScreen` — the Orchestrator

This is the single client component that `app/case/[code]/page.tsx` renders. It:
1. Calls `useCaseRoom(code, { name, avatar, isHost })`.
2. Switches on `phase` to render the appropriate sub-screen.
3. Passes the `useCaseRoom` return value props down (no prop drilling beyond one level —
   each sub-screen receives what it needs).

```typescript
// Pseudocode — not production TypeScript
function CaseRoomScreen({ code }: { code: string }) {
  const room = useCaseRoom(code, { name, avatar, isHost });
  const { phase } = room;

  if (phase === 'connecting') return <ConnectingSpinner />;
  if (phase === 'error')      return <CaseErrorScreen reason={room.errorReason} />;
  if (phase === 'lobby')      return <LobbyScreen room={room} />;
  if (phase === 'investigation') return <InvestigationScreen room={room} caseData={caseData} />;
  if (phase === 'question')   return <QuestionScreen room={room} caseData={caseData} />;
  if (phase === 'reveal')     return <RevealScreen room={room} caseData={caseData} />;
  if (phase === 'ended')      return <ResultsScreen room={room} caseData={caseData} />;
}
```

`caseData` is fetched client-side from `getCase(room.caseId)` — the case content is in
`src/data/cases/` (a client-side JS import, like `CODECASTER_LEVELS`). The `answerIndex`
field is NOT present in the client-side `Question` type — it is server-only.

### 4.3 `useCaseRoom` Hook Contract

Mirrors `useParty.ts` closely. Key differences:
- Phase machine has `investigation` and `reveal` states absent from Party.
- `answer()` calls `kcq_case_answer` RPC (vs Party's `kcq_party_answer`).
- `openHint()` calls `kcq_case_open_hint` RPC.
- Host actions: `startInvestigation()`, `advanceQuestion()`, `advanceReveal()`, `endMatch()`.
- `playerToken` and `hostToken` stored in `sessionStorage['kcq.case.session.${code}']`.

```typescript
interface CaseRoomReturn {
  // State
  phase: CasePhase;            // 'connecting'|'lobby'|'investigation'|'question'|'reveal'|'ended'|'error'
  players: CasePlayer[];       // presence-driven list, sorted by score
  caseId: string;
  qIndex: number;              // -1 = pre-questions
  totalQuestions: number;
  scores: Record<string, number>;
  answeredCount: number;       // how many players have answered current Q (no names)
  myAnswer: number | null;     // which option this player selected (null = not yet)
  myScore: number;
  isHost: boolean;
  myId: string;
  errorReason?: string;
  // Actions
  startInvestigation: () => void;
  advanceQuestion: () => void;
  advanceReveal: () => void;
  endMatch: () => void;
  answer: (optionIndex: number) => void;
  openHint: (qIndex: number) => void;
}
```

### 4.4 Bot Practice — `botEngine.ts`

Bot Practice runs entirely offline. No Supabase. No `useCaseRoom`.

```typescript
// src/lib/caseFiles/botEngine.ts
// Returns a BotSession with a tick() method that advances bot "answers"
// with random delays (8–30s) calibrated to gradeBand accuracy.
// The UI calls tick() on a timer and receives bot answer events.
// Phase machine is entirely local state (no Realtime, no RPCs).
```

Bot Practice uses a separate component tree: `BotPracticeScreen` (inside `caseFiles/`).
It does NOT use `useCaseRoom`. It uses `useGame((s) => s.caseMatchEnd)` directly for
progress saving. The results screen is the same `ResultsScreen` component (reused).

### 4.5 `SegmentedTabs` — Extracted Shared Component

Extract the `PaneTab` function from `PlayScreen.tsx` into
`src/components/ui/SegmentedTabs.tsx` for reuse:

```typescript
// src/components/ui/SegmentedTabs.tsx
interface Tab<T extends string> {
  id: T;
  label: string;
  icon: IconName;
  badge?: string; // e.g. "3/4 read"
}
interface SegmentedTabsProps<T extends string> {
  tabs: Tab<T>[];
  active: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  className?: string;
}
```

Both Codecaster and Case Files use this. Update `PlayScreen.tsx` to use the extracted
component — a clean refactor that unifies the pattern.

---

## 5. Classroom Teacher UX

### 5.1 Setup Flow — Under 3 Minutes Target

```
Teacher timeline:
0:00  Opens /admin/cases (new admin route, gated by requireAdmin cookie)
0:30  Clicks "New Tournament" → case picker modal opens
1:00  Selects case (e.g. "Museum Heist") + grade band filter
1:15  Clicks "Create Room" → room code generated (e.g. "XK7B2")
1:20  Copies/displays room code (large on screen — one tap to copy)
1:30  Students open /case/XK7B2 on their devices + enter names
2:30  All students joined (teacher sees player list update live)
2:45  Teacher clicks "Start Investigation" → investigation phase begins
```

**Critical UX constraints for the 3-min target:**
1. Case picker must have instant filtering (client-side, no network).
2. Room code generation (calling `kcq_case_create`) must respond in <1 second.
3. The room code display must be large enough to read from a projector (min 64px font).
4. "Copy Code" and "Display on Projector" (opens `/case/XK7B2/display` — a fullscreen code
   page suitable for a TV/projector) are two separate buttons.
5. The teacher's control panel must fit on a 13-inch laptop screen without scrolling.

### 5.2 `/admin/cases` — Teacher Control Panel

```
┌──────────────────────────────────────────────────────────────┐
│  Admin Panel                    [← Back to Admin]            │
├──────────────────────────────────────────────────────────────┤
│  Case Files Tournaments                                      │
│                                                              │
│  [ + New Tournament ]                                        │
│                                                              │
│  Active rooms:                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Museum Heist · XK7B2 · 3/8 players · investigation │    │
│  │  [ Resume Control ] [ End Session ]                 │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  Past sessions (last 7 days):                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Museum Heist · Jun 8 · 6 students · completed      │    │
│  │  [ Download CSV ]                                   │    │
│  └─────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

### 5.3 Teacher In-Game Control View

When the teacher resumes control of an active room (`/admin/cases/[code]`), they see:

```
┌──────────────────────────────────────────────────────────────┐
│  Museum Heist · Q 2 of 6      Room: XK7B2    [End Session] │
├──────────────────────────────────────────────────────────────┤
│  LIVE LEADERBOARD              CONTROLS                      │
│  ──────────────────            ────────────────────          │
│  1. Aziz      158  ↑1          Phase: question               │
│  2. Nilufar   142              Answered: 4/6                 │
│  3. Jasur      98  ↓1          Wait: 2 more players...       │
│  4. Dilorom    89                                            │
│  5. Kamol      72              [ → Advance to Reveal ]       │
│  6. Barno      61              [ → Next Question ]           │
│                                [ ■ End Match ]               │
│                                                              │
│  (30+ players: virtual-scrolled list — see §5.4)            │
└──────────────────────────────────────────────────────────────┘
```

On mobile, the teacher control panel collapses to a single column with a bottom action bar.

### 5.4 Leaderboard Scalability (30+ Players)

Classroom max size is PENDING (§00-BRIEF.md §9.3). Design for both ~8 and 30+ now:

- **< 8 players:** Simple list, no virtualisation. Current UI handles this.
- **8–30 players:** CSS `max-h + overflow-y-auto` with a visible scrollbar is sufficient.
  No virtualisation needed for 30 rows.
- **30+ players (pending confirmation):** Implement a virtual list using a lightweight
  windowed rendering approach. Recommended: use `@tanstack/react-virtual` (already in the
  React 19 ecosystem). BUT: do not add this dependency until the classroom max is confirmed.
  Design the leaderboard component with a `virtualized?: boolean` prop so it can be switched
  on without a structural refactor.

In MVP, build for ≤8 (Party cap). The component contract accommodates 30+ by using a
scrollable container. Virtualisation is a performance-only addition at the same API surface.

### 5.5 CSV Export

Triggered by "Download CSV" on the past sessions list. Calls `kcq_case_teacher_results(code,
hostToken)`, then transforms the JSON to CSV client-side using the same `xlsx` pattern as
`src/app/api/admin/students/import`. Downloaded as `case-files-[case-title]-[date].csv`.

CSV columns:
```
display_name | total_score | stars | Q1_correct | Q1_hint_used | Q2_correct | Q2_hint_used | ...
```

---

## 6. Result Card — Exact Layout Specification

The `ResultCard` component renders at exactly **600×400 px** (fixed, not responsive) inside a
`hidden` div off-screen. `html2canvas` captures it to a `<canvas>` then `toBlob()` provides the
PNG for download.

```
┌──────────────────────────────────────────────────────────────┐
│  (dark: bg-slate-900)                                        │
│                                                              │
│  KidsCode Quest · Case Files            [top-left logo text] │
│  ────────────────────────────────────────────────────────    │
│                                                              │
│  🔍  MUSEUM HEIST            (font-display, 28px, white)    │
│                                                              │
│  ★ ★ ★          158 pts          #1 of 3 players          │
│  (gold, 36px)   (36px, white)    (16px, slate-400)          │
│                                                              │
│  ┌───────────────────┐   Best Evidence Find:               │
│  │  🔍               │   "I left my post at 11:47 PM…"     │
│  │  Junior           │   — Security Report · Q3            │
│  │  Detective        │   (16px, slate-200)                  │
│  │  (14px, grape)    │                                      │
│  └───────────────────┘                                      │
│                                                              │
│  kids-code-quest.vercel.app          (12px, slate-500)      │
└──────────────────────────────────────────────────────────────┘
```

**Implementation notes:**
- `font-display` (the project's custom display font) must be loaded before capture.
  Use `document.fonts.ready` promise before calling `html2canvas`.
- Emoji rendering is inconsistent across OS in `html2canvas`. Use text-based icons or
  inline SVG for the rank badge icon, not emoji. The detective rank badge uses the `case`
  icon (new `IconName: 'case'` → lucide `Briefcase`).
- Star rendering: use a simple SVG star repeated 3 times (all gold for 3★, hollow for 0).

---

## 7. Responsive, Accessibility, and Motion

### 7.1 Responsive Breakpoints (matches project conventions)

- `< 1024px` (mobile/tablet): Segmented toggle for Sources/Question. Single-column layout.
- `≥ 1024px` (desktop): Side-by-side panels. No toggle.
- `< 640px` (small mobile): Room code display enlarges to `text-4xl`. Answer option text
  wraps at 2 lines max.

### 7.2 Accessibility

- **Segmented toggle:** `role="tablist"` on container, `role="tab"` + `aria-selected` on tabs,
  `role="tabpanel"` + `aria-labelledby` on pane content. Keyboard: Arrow Left/Right navigate tabs.
- **Answer options:** `role="radiogroup"` + `role="radio"` for option buttons. Once answered,
  `aria-disabled="true"` on all options. Correct answer gets `aria-label="Correct answer"`.
- **Live feedback:** "Answered: N/M players" uses `aria-live="polite"` (not assertive — it
  updates frequently and should not interrupt screen reader flow).
- **Room code display:** `aria-label="Room code: X K Q B 7"` (spaces help screen readers
  spell out letters individually).
- **Source documents:** Each `<article>` with `aria-label="Source: Security Report"`.
  `role="article"` on each source document view.
- **Focus management:** When advancing from investigation to question, focus moves to the
  question heading. When a reveal happens, focus moves to the feedback text.
- **Colour only:** Never use colour alone to indicate correct/wrong. Always pair with an icon
  (`check` for correct, `x` for wrong) and text ("Correct!" / "Not quite").

### 7.3 Reduced Motion

Every animation in Case Files must respect the `prefers-reduced-motion` media query AND the
store's `settings.reducedMotion` flag (same dual-check as `PlayScreen.tsx`):

```typescript
const shouldReduceMotion = useReducedMotion();   // framer-motion hook
const storeReduced = useGame((s) => s.settings.reducedMotion);
const reduced = shouldReduceMotion || storeReduced;
```

**When `reduced = true`:**
- Star animation: all 3 stars appear instantly (no staggered bounce).
- Rank-up banner: appears instantly (no slide-in).
- Score increment: shows final value immediately (no count-up animation).
- Source card expand: instant show/hide (`transition: none`).

**When `reduced = false`:** Use `framer-motion` `AnimatePresence` + `motion.div` for:
- Star stagger (each star delays by 0.15s).
- Rank badge entrance (scale from 0.8 + fade).
- Score counter (count-up via `useMotionValue` + `useTransform`).
- Source expand (height animate from 0 to auto).

### 7.4 Offline Messaging

"Multiplayer requires a connection" must be shown:
1. On `/case` mode-select page: Private Room and Classroom cards show the message inline
   (no navigation needed — user never leaves the page to discover the error).
2. On `/case/[code]` join screen: if `!isCloudEnabled()`, show the message immediately
   on mount, before any RPC is attempted.
3. NEVER as a toast or dismissible overlay — it must be persistent until the user leaves.

Bot Practice always works. Its mode card is always fully-enabled regardless of cloud state.

---

## 8. New `IconName` Entries Required

Add these to `src/components/ui/Icon.tsx` `IconName` union and `ICON_REGISTRY`:

| IconName     | Lucide Component  | Usage                                     |
|--------------|-------------------|-------------------------------------------|
| `case`       | `Briefcase`       | Case Files mode icon, rank badge, nav     |
| `file-text`  | `FileText`        | Sources panel tab icon                    |
| `help-circle`| `HelpCircle`      | Question panel tab icon                   |
| `mail`       | `Mail`            | Email source type icon                    |
| `message`    | `MessageSquare`   | Chat log source type icon                 |
| `notebook`   | `NotebookPen`     | Note source type icon                     |
| `ticket`     | `Ticket`          | Ticket source type icon                   |
| `search`     | `Search`          | Case Files header icon (detective theme)  |
| `award`      | `Award`           | Detective rank badge display              |
| `users`      | `Users`           | Player count / classroom icon             |
| `download`   | `Download`        | CSV export button                         |
| `share`      | `Share2`          | Result card share button                  |
| `eye`        | `Eye`             | "View source" / "Read" indicator          |

**Note on naming:** Keep names semantic (`file-text`, not `filetext`). The `IconName` type
uses kebab-case strings (already established by `help-circle`, etc. being valid TS string
literals in the union).

**Caveat:** `Ticket` is available in lucide-react ≥ 0.300. Verify the installed version:

```bash
grep lucide-react package.json
```

If `Ticket` is unavailable, substitute `Tag` (always available). The `ICON_REGISTRY` type
error will surface at typecheck time if the component doesn't exist.

---

## 9. New i18n Keys to Add

Add to `src/lib/i18n/translations.ts` (all three locales: en + uz + ru):

```
// Case Files — navigation / mode select
'case.title'              Case Files
'case.sub'                Read the documents, solve the mystery
'case.modeBot'            Bot Practice
'case.modeBotSub'         Solo · Works offline
'case.modeFriendly'       Private Room
'case.modeFriendlySub'    Up to 8 players · Invite with a code
'case.modeClassroom'      Classroom Tournament
'case.modeClassroomSub'   Teacher-led · Export results
'case.needNet'            Multiplayer requires a connection
'case.needNetSub'         Private Room and Classroom need Supabase. Try Bot Practice offline!
'case.tryBot'             Try Bot Practice

// Create room
'case.create'             Create a Room
'case.pickCase'           Pick a Case
'case.filter.all'         All subjects
'case.filter.reading'     Reading
'case.filter.history'     History
'case.filter.science'     Science
'case.filter.logic'       Logic
'case.filter.grade.all'   All ages
'case.filter.grade.7-9'   Ages 7–9
'case.filter.grade.10-12' Ages 10–12
'case.filter.grade.13-14' Ages 13–14
'case.questions'          {n} questions
'case.sources'            {n} sources
'case.yourBest'           Your best: {n}★
'case.creating'           Creating room…

// Join / lobby
'case.join.title'         Join Case Files
'case.join.roomCode'      Room code
'case.join.yourName'      Your name
'case.join.namePlaceholder' e.g. Aziz, Luna…
'case.join.joinBtn'       Join Room
'case.join.reconnect'     Reconnect
'case.join.notFound'      Room not found. Check the code.
'case.join.full'          Room is full (8 players max).
'case.lobby.title'        Waiting for players…
'case.lobby.roomCode'     Room code
'case.lobby.shareCode'    Share this code to invite!
'case.lobby.players'      Players ({n}/{max})
'case.lobby.host'         (host)
'case.lobby.you'          (you)
'case.lobby.startBtn'     Start Investigation →
'case.lobby.waiting'      Waiting for host to start…

// Investigation
'case.invest.title'       Read the Sources
'case.invest.sub'         Read all sources before the first question opens.
'case.invest.sources'     Sources ({n})
'case.invest.readAll'     You've read all sources — ready!
'case.invest.readyCount'  Players ready: {n}/{total}
'case.invest.startBtn'    Start Questions →
'case.invest.waiting'     Waiting for host…
'case.invest.readMark'    Read ✓

// Source types
'case.source.profileCard' Profile
'case.source.chatLog'     Chat Log
'case.source.email'       Email
'case.source.note'        Note
'case.source.ticket'      Ticket
'case.source.backBtn'     ← Back to sources

// Question
'case.q.title'            Question {n} of {total}
'case.q.sourceTab'        Sources ({read}/{total} read)
'case.q.questionTab'      Question
'case.q.answered'         Answered: {n} of {total} players
'case.q.hint'             💡 Open a hint
'case.q.hintOpened'       Hint opened (no 3★)
'case.q.hostAdvance'      → Advance to reveal

// Reveal
'case.reveal.correct'     Correct!
'case.reveal.wrong'       Not quite
'case.reveal.foundIn'     Found in: "{source}"
'case.reveal.xpEarned'    +{xp} XP
'case.reveal.streak'      🔥 Streak ×{mult} (+{bonus} XP)
'case.reveal.speed'       ⚡ Speed bonus: +{n} XP
'case.reveal.leaderboard' Leaderboard
'case.reveal.nextBtn'     Next question →
'case.reveal.waitHost'    Waiting for host…
'case.reveal.rankDelta.up'   ↑ {n} place
'case.reveal.rankDelta.down' ↓ {n} place

// Results
'case.result.solved'      Case Solved!
'case.result.unsolved'    Case Closed — try again!
'case.result.score'       Your score: {n} pts
'case.result.rank'        Rank: #{pos} of {total}
'case.result.xp'          XP earned: +{n}
'case.result.answerXp'    Per-answer XP: +{n}
'case.result.coins'       Coins: +{n}
'case.result.bestEvidence' Best Evidence Find
'case.result.bestEvidenceSub' Answered in {time}s, no hint — fastest find!
'case.result.finalBoard'   Final Leaderboard
'case.result.share'        📤 Share Result Card
'case.result.playAgain'    Play Again
'case.result.chooseCase'   Choose Another Case
'case.result.back'         ← Back to Cases
'case.result.rankUp'       RANK UP!
'case.result.rankUpSub'    You are now a {rank}!

// Detective ranks (displayed as rank name strings, not keyed by ID)
'rank.case.0'   Cadet
'rank.case.1'   Rookie Detective
'rank.case.2'   Junior Detective
'rank.case.3'   Detective Sergeant
'rank.case.4'   Senior Detective
'rank.case.5'   Lead Investigator
'rank.case.6'   Chief Inspector
'rank.case.7'   Master Sleuth

// Admin / teacher
'admin.cases.title'         Case Files Tournaments
'admin.cases.newTournament' + New Tournament
'admin.cases.active'        Active rooms
'admin.cases.past'          Past sessions
'admin.cases.resume'        Resume Control
'admin.cases.endSession'    End Session
'admin.cases.downloadCsv'   Download CSV
'admin.cases.players'       {n} players
'admin.cases.advanceReveal' → Advance to Reveal
'admin.cases.nextQuestion'  → Next Question
'admin.cases.endMatch'      ■ End Match
'admin.cases.copyCode'      Copy Code
'admin.cases.projector'     Display on Projector
```

**i18n key naming convention** (matches existing `party.*`, `arena.*`, `cc.*`): prefix all
Case Files keys with `case.` for screens, `rank.case.` for rank names,
`admin.cases.` for teacher panel. Uzbek (`uz`) is default; all three locales must be populated.

---

## 10. Open Questions for Lead to Resolve

These items are explicitly flagged as requiring a product decision before the corresponding
UI can be finalised. All other screens above are implementation-ready.

1. **Classroom max size (PENDING from §00-BRIEF.md §9.3).**
   If > 8 players, the `kcq_case_join` RPC cap must be raised and the leaderboard needs
   virtualisation. The UI is designed to accommodate this (see §5.4) but the dependency
   (`@tanstack/react-virtual`) should not be added until the number is confirmed. Recommend:
   confirm before implementation sprint begins, as it affects both the schema and the UI.

2. **`/case/[code]/display` — projector display route.**
   This is a fullscreen room-code + case-title page for teachers to show on a projector
   while students join. Is this in MVP scope? It requires one additional route but no new
   RPCs. Effort: ~2 hours. Recommend: include in MVP as it directly serves the <3-min setup
   constraint.

3. **Investigation phase read-tracking server-side (future).**
   Currently "source read" is local state only (never sent to server). The teacher cannot
   see which students have read which sources. This is a v1.1 feature ("per-question accuracy
   heatmap" is fast-follow). Confirm this is acceptable for MVP. No impact on current design.

4. **Source excerpt / `evidencePassage` field.**
   The reveal screen's "Found in" box shows a quoted passage. The case data type needs a
   `Question.evidencePassage: string` field (substring of the source body). This must be
   authored into every question in `src/data/cases/C01_*.ts` etc. Who owns case content
   authoring? (Escalated in `00-BRIEF.md §8.6` as a non-engineering dependency.)

5. **Bot Practice answer window.**
   The 45-second `ANSWER_WINDOW_MS` is defined for server-scored multiplayer. In Bot Practice
   (offline, no server scoring), should the player see a visible timer at all? Recommendation:
   no timer in Bot Practice (the brief explicitly says "reading time is never penalized") —
   show the question indefinitely until the player taps an answer. Speed bonus in Bot Practice
   is computed client-side as a best-effort approximation (not authoritative). Confirm.

6. **`html2canvas` vs alternatives for result card PNG.**
   `html2canvas` has known issues with CSS custom properties and web fonts. Alternative:
   `dom-to-image-more` (more actively maintained). Both are ~100KB gzipped. Recommend
   evaluating in a prototype before committing. Either way, keep the `resultCard.ts` helper
   as the single seam — the UI never calls the canvas library directly.

---

## 11. Landing Page Integration

The `/` home page "Game modes" snap carousel currently shows Arena / Party / Codecaster cards.
Case Files should be added as a fourth card with the same visual treatment:

```typescript
// Add to src/app/page.tsx mode cards section:
// Icon: 'case' (new IconName → Briefcase)
// Gradient: from-sky to-grape (distinct from Arena's red, Party's orange, Quest's indigo)
// Title: t('case.title')
// Sub: t('case.sub')
// href: '/case'
```

The "Extra mode" badge and "Open →" CTA match the existing card pattern exactly.

---

## Summary

**New routes:** `/case`, `/case/create`, `/case/[code]` (all phases in one), `/case/result`,
`/admin/cases`, `/admin/cases/[code]` (teacher control).

**Reused patterns (verbatim):**
- `useParty.ts` → `useCaseRoom.ts` (presence, broadcast, sessionStorage token, host resume).
- `PlayScreen.tsx` two-pane segmented toggle → extracted to `SegmentedTabs` + reused.
- `/party` offline gate (cloud check on mount, non-scary message) → replicated at `/case`.
- `codecaster/cloud.ts` no-op offline pattern → `caseFiles/cloud.ts`.
- `grading.ts` replay-authority → server-side in `kcq_case_end_match` SQL.
- `GAMES` / `CODECASTER_LEVELS` data-driven content → `CASES` in `src/data/cases/`.

**Key UX decisions made in this spec:**
- Sources tab is always visible during question/reveal on both mobile and desktop (pedagogy).
- No speed countdown shown to players (tiebreaker only; anxiety-free reading).
- Investigation phase: no countdown timer; soft "players ready" social indicator instead.
- Bot Practice is fully offline with a local `botEngine.ts`; never touches Supabase.
- Result card is client-side PNG only (html2canvas); no server render.
- Teacher token = `host_token` from `kcq_case_create`; stored in `sessionStorage` (not in
  `requireAdmin` session — those are for the admin panel routes only, not game RPCs).

**Unresolved (Lead decision required):**
- Classroom max size (affects schema cap + virtualisation).
- `/case/[code]/display` projector route (recommend include in MVP).
- `evidencePassage` field authoring ownership.
- Bot Practice speed bonus visibility.

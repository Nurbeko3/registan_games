# STATUS.md — KidsCode Quest loyiha holati

> **Sana:** 2026-06-21
> **Branch:** `main` (origin bilan to'liq sinxron — push qilinmagan commit yo'q)
> **Holat:** ✅ Typecheck toza (0 xato) · ✅ 558 test / 24 fayl o'tdi · 🟡 ishlab chiqilmoqda (MVP+)

Bu hujjat — loyihaning hozirgi to'liq surati: nima qilingan, nima yaxshi, nima kamchilik, va keyin nima qilish kerak. Snapshot, vaqt o'tishi bilan eskiradi.

---

## 1. Umumiy ko'rinish

**KidsCode Quest** (`kidscode-quest`) — 7–14 yoshli bolalarga o'yin orqali dasturlashni o'rgatuvchi **offline-first** ta'limiy platforma.

| Ko'rsatkich | Qiymat |
|---|---|
| Kod hajmi (`src/`) | ~30,300 satr TS/TSX |
| Komponentlar | 66 ta `.tsx` |
| Lib modullari | 59 ta `.ts` |
| Data fayllar | 43 ta `.ts` |
| Sahifa route'lar | 20 ta `page.tsx` |
| API route'lar | 10 ta `route.ts` (faqat admin + arena health) |
| Testlar | **558 test / 24 fayl** (hammasi o'tadi, ~1.1s) |
| Tarjima kalitlari | 1140 ta (uz/ru/en) |
| Migration'lar | 12 ta (`0001`–`0012`) |
| Mini-o'yinlar | 16 ta (hammasi registry'da ulangan) |
| TODO/FIXME/ts-ignore | 11 ta (10 tasi — Codecaster i18n) |

### Texnologiyalar
Next.js 15 (App Router) · React 19 · TypeScript · TailwindCSS · Zustand 5 · Framer Motion 11 · Node 24. Cloud uchun Supabase (ixtiyoriy). Python o'yin dvigateli — Skulpt (Web Worker). Excel import — `xlsx`. Ikonlar — `lucide-react`.

---

## 2. O'yin rejimlari (mazmun holati)

| Rejim | Holat | Izoh |
|---|---|---|
| **16 mini-o'yin** | ✅ Tayyor | Hammasi `GAME_REGISTRY`'da ulangan, metadata bilan mos. Data-driven. |
| **Battle Learn Arena** | ✅ Ishlaydi (🟡 netcode nozik) | Realtime top-down shooter + "Learning Pod" savollari. Trilingual + grade-tagged savol banki. |
| **Party** (umumiy viktorina) | ✅ Server-authoritative | Postgres RPC orqali ball hisoblash, host-refresh resume. |
| **Codecaster — Code Dungeon** | ✅ Ishlaydi (🟡 i18n yo'q) | Skulpt orqali real Python, 10 ta level (L10 — boss). Replay orqali anti-cheat. |
| **Case Files** (detektiv o'qish) | ✅ MVP tayyor | 5 ta case, server-authoritative ko'p o'yinchili rejim + offline Bot Practice. |
| **Classroom / Admin** | ✅ Ishlaydi | O'qituvchi paneli, o'quvchi akkauntlari, Excel import/export. Faqat server-side. |

---

## 3. Ustunliklar (kuchli tomonlar) 💪

### 3.1 Arxitektura toza va izchil
- **Yagona haqiqat manbai:** butun progress (XP, tanga, streak, achievement, locale) bitta Zustand store'da (`useGame.ts`, `kcq.v2` kaliti). Mutatsiyalar markazlashgan action'lar — komponentlarda tarqab ketmagan.
- **Data-driven kontent:** o'yinlar, dunyolar, kosmetika, savollar, case'lar — hammasi deklarativ data fayllarda, rendering'dan ajratilgan. Yangi o'yin/level/case qo'shish = data qo'shish.
- **Achievement'lar hisoblanadi, qo'lda berilmaydi:** har biri sof `check(snapshot)` predikati. Yangi achievement = bitta data yozuvi.
- **Layered netcode:** engine (sof, framework-siz, test qilsa bo'ladigan) → transport → service → React binding. Arena, Party va Case Files bir xil pattern'ni baham ko'radi.

### 3.2 Offline-first va Supabase qat'iy additiv
- Supabase env yo'q bo'lsa, `client.ts` `null` qaytaradi va **hech qachon throw qilmaydi**. Barcha cloud yo'llari jimgina offline rejimga tushadi. Asosiy o'yin internet-siz to'liq ishlaydi.

### 3.3 Anti-cheat / xavfsizlik dizayni kuchli
- **Codecaster:** mijoz "g'alaba" deb yolg'on aytsa ham, `grading.ts` action-trace'ni `DungeonEngine`'da qayta o'ynaydi → 0 yulduz. Server-replay falsafasi.
- **Party / Case Files / Arena:** javoblar server tomonda (Postgres RPC) hisoblanadi; mijoz boshqa o'yinchi nomidan ball yoza olmaydi. Case Files'da javob kaliti mijozga umuman yuborilmaydi (answer-less `publicCase()` proyeksiyasi).
- **Admin:** sirlar faqat `server.ts`/route handler'larda; sessiya tokeni har so'rovda RPC orqali tekshiriladi; anon-key bilan, hech qanday sir client bundle'ga tushmaydi.
- **Shop login-gated:** cloud yoqilganda tanga sarflash uchun o'quvchi akkaunti talab qilinadi (anti-farm).

### 3.4 Test qoplami sof mantiqda zo'r
- 558 test pure mantiqni qoplaydi: leveling, store action'lari, arena engine/netcode, butun Codecaster qatlam (har level yechilishi isbotlangan), Case Files (har case javob beriladigan + i18n to'liq isbotlangan).
- Anti-farm, level-up delta, yulduz mantiqi — hammasi test bilan qulflangan.

### 3.5 Kod sifati ko'rsatkichlari toza
- Typecheck **0 xato**. Non-test kodda atigi **2 ta console** va **1 ta `any`**. Bu hajmdagi loyiha uchun juda toza.
- Trilingual i18n (uz/ru/en), 1140 kalit. SSR-safe hydration pattern (`useHydrated()`).

---

## 4. Kamchiliklar va xavf-xatarlar ⚠️

### 4.1 🔴 Codecaster levellari faqat ingliz tilida (eng katta i18n bo'shliq)
- L01–L10'ning barchasida `TODO i18n` — mission matnlari, hint'lar plain English. Standart locale **uz** bo'lgani holda, bola Code Dungeon'da inglizcha matn ko'radi. 11 ta TODO'ning 10 tasi shu.
- **Ta'sir:** maqsadli auditoriya (uzbek 7–14 yosh) uchun Codecaster amalda tushunarsiz.

### 4.2 🟡 React/UI qatlami umuman test qilinmagan
- Faqat pure modullar test qilingan (bu ataylab). Lekin 66 ta komponent, ko'p o'yinchili lobby oqimlari, celebration UI — hech biri avtomatik test bilan qoplanmagan. E2E/integration test yo'q.
- **Ta'sir:** UI regressiyalari faqat qo'lda aniqlanadi.

### 4.3 🟡 Codecaster cloud mijozga ishonadi (`validated=false`)
- Migration `0010` MVP'da server-replay edge function yo'q — cloud progress/leaderboard hozircha mijoz ma'lumotiga ishonadi. Offline grading replay-based, lekin **cloud leaderboard'ni** soxtalashtirsa bo'ladi.
- **Ta'sir:** leaderboard ishonchliligi to'liq emas (CLAUDE.md'da ham qayd etilgan, kelajakdagi ish).

### 4.4 🟡 Arena/Party live gameplay hali Realtime ustida (server-authoritative emas)
- Jadvallar faqat tiklash (recovery) uchun, tezkor yo'l emas. Gameplay peer/host-authoritative. `api/arena/authority` faqat tashqi server uchun health probe (default o'chiq).
- **Ta'sir:** desync va host-migration nozik joylar (netcode `441b3bf`'da yaxshilangan, lekin tabiatan xavfli). Memory'dagi `supabase-realtime-ops` eslatmasiga qarang.

### 4.5 🟢 Mayda / texnik qarz
- **ESLint yo'q** — `npm run lint` aslida `tsc --noEmit`. Stilistik/lint qoidalari (unused vars, hooks deps) tekshirilmaydi.
- 16 ta game metadata `slug:` grep'da 18 chiqqan edi (izoh/yordamchi funksiyalar) — ammo amalda 16 slug = 16 registry, **to'liq mos** (bo'shliq yo'q).
- Memory'dagi "441b3bf push qilinmagan" eslatmasi **eskirgan** — hozir hammasi push qilingan (0 unpushed). Eslatmani yangilash kerak.

---

## 5. Xavfsizlik holati 🔒

| Soha | Holat |
|---|---|
| Sirlar client bundle'da | ✅ Yo'q — faqat `server.ts`/route handler |
| Admin sessiya | ✅ DB-issued token, har so'rovda RPC tekshiruvi, bcrypt parollar |
| Javob kalitlari (Case/Party) | ✅ Server tomonda, mijozga yuborilmaydi |
| Codecaster g'alaba | ✅ Server-replay (offline), 🟡 cloud leaderboard validated=false |
| RLS | ✅ `0010`+ revoke-all + SECURITY DEFINER RPC |
| Bolalar ma'lumoti | ✅ Case Files butunlay **fiktiv** hujjatlar, real shaxsiy ma'lumot yo'q |
| `.env` | ✅ Bitta gitignore qilingan `.env` (foydalanuvchi tanlovi) |

---

## 6. Deploy / infratuzilma

- Vercel'ga deploy qilinadi (Next.js App Router). Node 24, Next 15.5.
- Supabase Singapore region (~149ms RTT, kvotalar yetarli — memory'ga qarang).
- 12 migration tartibida qo'llaniladi (`supabase db push`).
- **⚠️ Vercel CLI eskirgan** (54.6.1 → 54.14.5) — yangilash tavsiya etiladi.
- ⛔ **HARD RULE:** git commit/push va build faqat foydalanuvchi buyrug'i bilan.

---

## 7. Hujjatlar holati

- ✅ `CLAUDE.md` — to'liq va yangilangan (Case Files, trilingual arena, 0011/0012 qo'shildi).
- ✅ `README.md` mavjud.
- ✅ `docs/`: `ADMIN_BOOTSTRAP.md`, `BATTLE_LEARN_ARENA.md`, `codecaster-design.md`, `find-info-about-me/` (Case Files dizayni).

---

## 8. Tavsiyalar — keyingi qadamlar (prioritet bo'yicha)

1. **🔴 Codecaster levellarini i18n qilish** (L01–L10 mission/hint → uz/ru/en kalitlar). Maqsadli auditoriya uchun bloker.
2. **🟡 Codecaster cloud server-replay edge function** — leaderboard'ni `validated=true` qilish (0010'dagi rejalashtirilgan ish).
3. **🟡 Kritik UI oqimlariga smoke/E2E test** — kamida arena/case lobby, join, host-migration va shop xaridi.
4. **🟢 ESLint qo'shish** (next lint yoki flat config) — hooks-deps va unused tekshiruvi uchun.
5. **🟢 Memory yangilash** — `supabase-realtime-ops` dagi "441b3bf unpushed" endi noto'g'ri.
6. **🟢 Arena netcode'ni monitoring** — desync hodisalarini real qurilmalarda kuzatish; kerak bo'lsa tashqi authoritative server (`api/arena/authority`) ni yoqish.

---

## 9. Xulosa

Loyiha **mustahkam, toza arxitekturali va ishlaydigan MVP+** holatida: 5 ta o'yin rejimi + 16 mini-o'yin, offline-first, qat'iy additiv cloud, kuchli anti-cheat dizayni va 558 ta o'tadigan test. Asosiy ochiq ish — **Codecaster i18n** (maqsadli til uchun bloker) va cloud leaderboard'ni server-replay bilan to'liq ishonchli qilish. UI test qoplami va ESLint — sifat bo'yicha keyingi yaxshilanishlar. Real-time gameplay netcode'i ishlaydi, lekin tabiatan eng nozik qism va kuzatuvni talab qiladi.

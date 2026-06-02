# ⚔️ Battle Learn Arena — To'liq Hujjat (Report)

> KidsCode Quest ichidagi **"o'ynab o'rgan"** (learn-while-you-play) raqobat rejimi.
> Real-vaqtli top-down jangchi (shooter) o'yini + ta'limiy savol-javob tizimi birlashtirilgan.

**Manzil:** `/arena`
**Sana:** 2026-06-02
**Holat:** ✅ To'liq ishlaydi, offline (internet va serversiz)

---

## 1. Asosiy g'oya (Falsafa)

Arena'ning **№1 dizayn qoidasi**:

> **Bola hech qachon o'yindan chiqarib yuborilganda jazolanganday his qilmasligi kerak.**

Har bir "o'ldirilish" (tag-out) — bu **Learning Mode** (Ta'lim rejimi) chaqiruvini ochadi. Savolga to'g'ri javob berish — bu o'yinga qaytishning yo'li. Ya'ni:

**O'lim = o'rganish imkoniyati**, "power-up" sifatida taqdim etiladi. 🧠⚡

Bu g'oya butun arxitektura bo'ylab izchil saqlangan: yutqazish ekrani yo'q, faqat "o'rganish" bor; noto'g'ri javob ham do'stona maslahat bilan tugaydi, hech qachon koyimaydi.

---

## 2. Qanday o'ynaladi (O'yin oqimi)

```
Lobby (rejim + jamoa tanlash)
   │
   ▼
3-2-1 GO! sanoq
   │
   ▼
┌─────────────────────────────┐
│  PLAYING (jang)             │ ◄──────┐
│  - Harakatlan, nishonga ol, │        │ to'g'ri javob →
│    otib, raqibni "tag" qil  │        │ respawn (qayta tirilish)
└──────────────┬──────────────┘        │
               │ qahramon o'ldirildi   │
               ▼                        │
┌─────────────────────────────┐        │
│  LEARNING POD (ta'lim podi) │────────┘
│  - Savolga javob ber        │
│  - To'g'ri → mukofot + qayta │
│  - Noto'g'ri → maslahat +    │
│    8 sek charj → yangi savol │
└─────────────────────────────┘
               │ jamoa target ballга yetdi
               ▼
        ENDED (natijalar)
```

**Boshqaruv:**
- 📱 **Sensorli:** chap yarmi = harakat (joystick), o'ng yarmi = nishonga olish va otish (joystick)
- ⌨️ **Klaviatura:** `WASD` / strelkalar = harakat, **sichqoncha** = nishon, **bosish/Space** = otish

---

## 3. O'yin rejimlari (4 ta)

Hammasi **bitta** shooter engine'dan foydalanadi — faqat temp, g'olib bo'lish sharti va "ball" qanday atalishi bilan farq qiladi. Matchlar qisqa (2–4 daqiqa), bolalarga moslangan.

| Rejim | Emoji | Target ball | Ball nomi | Tick (ms) | Faqat savol bilan qaytish? |
|-------|-------|-------------|-----------|-----------|----------------------------|
| **Team Tag-Out** (deathmatch) | ⚔️ | 30 | tag-outs | 1300 | ❌ |
| **Capture the Flag** | 🚩 | 5 | captures | 2600 | ❌ |
| **King of the Hill** | 👑 | 20 | hill ticks | 1100 | ❌ |
| **Knowledge War** | 🧠 | 24 | tag-outs | 1500 | ✅ Ha |

> **Knowledge War** — eng ta'limiy rejim: o'yinchi **faqat** savolga javob berib qaytadi (bepul respawn yo'q). "Eng aqlli jamoa yutadi!"

**Jamoa o'lchamlari:** `3v3`, `5v5`, `10v10` (lobbyda tanlanadi).

**Jamoalar:**
- 🦊 **Red Foxes** (qizil) — qahramon doim shu jamoani boshqaradi
- 🐳 **Blue Whales** (ko'k) — raqib botlar

---

## 4. Texnik arxitektura

Kod **toza qatlamlarga** ajratilgan: sof o'yin mantig'i (React'siz) → renderer → React komponentlari. Bu engine'ni unit-test qilish va kelajakda Supabase Realtime bilan haqiqiy multiplayer qilishni osonlashtiradi.

### Fayllar tuzilishi

```
src/
├── app/arena/page.tsx              # Lobby (rejim/jamoa tanlash) → match
│
├── lib/arena/
│   ├── types.ts                    # Barcha sof tip'lar (React'siz)
│   ├── engine.ts                   # Real-vaqtli shooter fizikasi + bot AI
│   ├── render.ts                   # Canvas chizuvchi (sof grafika)
│   └── questionEngine.ts           # Savol tanlash, aralashtirish, baholash
│
├── components/arena/
│   ├── ArenaGame.tsx               # Asosiy orkestrator (game loop, input, holat)
│   ├── ArenaHUD.tsx                # Yuqori scoreboard + poyga chizig'i
│   ├── LearningPanel.tsx           # Ta'lim podi modali
│   ├── QuestionRenderer.tsx        # 6 xil savol turini chizadi
│   └── MatchResults.tsx            # Match yakuni ekrani
│
├── data/
│   ├── arenaModes.ts               # 4 rejim + jamoa o'lchamlari
│   ├── arenaQuestions.ts           # Savollar bazasi (32 ta savol)
│   └── achievements.ts             # Arena yutuqlari (3 ta)
│
└── store/useGame.ts                # arenaAnswerCorrect / arenaMatchEnd (mukofotlar)
```

### Qatlamlar diagrammasi

```
┌──────────────────────────────────────────────┐
│  React UI (components/arena/*)                │
│  ArenaGame · HUD · LearningPanel · Results    │
└───────────────┬──────────────────────────────┘
                │ har frame'da o'qiydi/yozadi
                ▼
┌──────────────────────────────────────────────┐
│  Sof mantiq (lib/arena/*) — React'siz         │
│  engine.ts (step) · questionEngine · render   │
└───────────────┬──────────────────────────────┘
                │
                ▼
┌──────────────────────────────────────────────┐
│  Ma'lumot (data/*) — sof JSON-ga o'xshash      │
│  arenaModes · arenaQuestions                  │
└──────────────────────────────────────────────┘
```

---

## 5. Shooter engine (`engine.ts`)

Counter-Strike / Brawl Stars uslubidagi top-down jangchi. Ranglar yorqin — bu **zo'ravonlik emas, "tag" o'yini** (otishlar rangli "blaster" deb ataladi).

**Dunyo geometriyasi (logik birliklar):**
- Maydon: `720 × 440`
- Jangchi radiusi: `15`, o'q radiusi: `5`
- 7 ta to'siq (cover): markaziy ustun + simmetrik bloklar

**Sozlanmalar (tuning):**

| Parametr | Qiymat | Izoh |
|----------|--------|------|
| Qahramon tezligi | 175 birlik/sek | Botdan tezroq |
| Bot tezligi | 120 birlik/sek | |
| O'q tezligi | 380 birlik/sek | |
| O'q zarari | 25 HP | To'liq HP'ni tushirish uchun 4 ta zarba |
| Maks HP | 100 | |
| Qahramon o'q oralig'i | 260 ms | Botdan ~3.6x tezroq otadi |
| Bot o'q oralig'i | 950 ms | |
| Bot otish masofasi | 300 birlik | |
| Bot respawn vaqti | 2200 ms | |

**Asosiy funksiyalar:**
- `createWorld(perTeam, hero)` — maydon, to'siqlar, jangchilarni yaratadi
- `step(world, dt, now)` — butun dunyoni `dt` soniyaga oldinga suradi; `{ kills, heroDied }` qaytaradi
- `respawn(f, now)` — jangchini bazasida to'liq HP bilan qayta tiriltiradi

**Bot AI mantig'i (`step` ichida):**
- Eng yaqin raqibni topadi → unga qaraydi
- Juda yaqin bo'lsa (`<150`) → **strafe** qiladi (yon tomonga aylanadi)
- Juda uzoq bo'lsa (`>300`) → **yaqinlashadi**
- O'rtada → **jockey** qiladi (tasodifiy burchak bilan manyovr)
- Aniq nishon bo'lsa (line-of-sight) → biroz tarqoqlik bilan otadi

**Fizika:**
- `resolveObstacles` — doirani to'siqdan tashqariga itaradi (min-o'q yechimi)
- `hasLOS` — ko'rish chizig'ini 14 nuqtada tekshiradi (devor orqali otmaslik uchun)

---

## 6. Renderer (`render.ts`)

Sof Canvas chizish — hech qanday o'yin mantig'i yo'q. DUNYO birliklarida chizadi; komponent oldindan miqyoslashni qo'llaydi.

Chizadigan elementlar:
- 🟪 Pol + nozik to'r (grid)
- 🔴🔵 Jamoa bazalari (rangli "end zone"lar)
- ⬛ To'siqlar (yumaloq burchakli)
- ⚡ O'qlar (izli)
- 🦊 Jangchilar: tana, yuz (emoji), **HP bar**, qahramon uchun "YOU" yorlig'i + nishon chizig'i
- ✨ Respawn bo'layotgan jangchilar (pulsatsiyali shaffoflik)

**Jamoa ranglari:** Qizil `#FF7AB6`, Ko'k `#3BA7FF`.

---

## 7. Ta'lim tizimi (Learning Pod)

Bu — Arena'ning yuragi. Qahramon o'ldirilganda blur qilingan jang maydoni ustida modal ochiladi.

### Savol turlari (6 xil)

| Tur | Tavsif |
|-----|--------|
| `mcq` | Ko'p tanlovli — bittasini tanla |
| `truefalse` | To'g'ri / Noto'g'ri |
| `code-fill` | Kod ichidagi `___` bo'sh joyni to'ldir |
| `debug` | Buggy (xato) qatorni bos |
| `order` | Bloklarni to'g'ri ketma-ketlikka joyla |
| `binary` | 5 bitni teskari qilib (0–31) maqsad sonni hosil qil |

### Savol bazasi (`arenaQuestions.ts`)

**Jami 32 ta savol**, 6 kategoriyada, 3 qiyinlik darajasida:

| Kategoriya | Emoji |
|-----------|-------|
| Programming | 💻 |
| Logic | 🧠 |
| Mathematics | 🧮 |
| Algorithms | 🪜 |
| Web Dev | 🌐 |
| AI Basics | 🤖 |

Har savolda **`explain`** maydoni bor — noto'g'ri javobda ko'rsatiladigan **do'stona o'rgatuvchi izoh** (hech qachon koyimaydi).

### Savol engine (`questionEngine.ts`) — "anti-cheat-learning"

1. **Qiyinlikni darajaga moslash:** Lv 1–4 → easy · Lv 5–14 → medium · Lv 15+ → hard
2. **Takrorlanmaslik:** bir match ichida ishlatilgan ID'lar `exclude` qilinadi (24 tadan keyin tozalanadi)
3. **Har safar aralashtirish:** Fisher–Yates shuffle bilan variantlar tartibini o'zgartiradi — **bir savol hech qachon bir xil ko'rinmaydi** (yodlab olishning oldini oladi)
4. **Graceful pool kengaytirish:** aniq qiyinlik tugasa → qo'shni darajalarga → keyin exclude'ni e'tiborsiz qoldiradi

### Javob holatlari (`LearnState`)

- **`answering`** — savol ko'rsatilmoqda
- **`correct`** → 🎉 Confetti + mukofot + 1.3 sek dan keyin respawn
- **`wrong-cooldown`** → 💡 maslahat + 8 sek "charj" progress-bar → yangi savol

---

## 8. Mukofotlar va progress

Mukofotlar markaziy Zustand store'da (`useGame.ts`) hisoblanadi va localStorage'ga (`kcq.v2`) saqlanadi.

**To'g'ri javob mukofoti (`arenaAnswerCorrect`):**

| Qiyinlik | XP | Tangalar |
|----------|-----|---------|
| Easy | 8 | 4 |
| Medium | 14 | 7 |
| Hard | 22 | 11 |

**Match yutuq bonusi (`arenaMatchEnd`):** g'olib bo'lsa **+50 XP**, **+30 tanga**.

**Kuzatiladigan statistika:** `arenaMatches`, `arenaWins`, `arenaCorrect`, `arenaBestElims`.

**Daraja egri chizig'i:** `totalXpForLevel(L) = 50·(L−1)·L` → 0, 100, 300, 600, 1000… (boshlanishda tez, keyin cho'ziladi).

---

## 9. Yutuqlar (Achievements)

Arena 3 ta maxsus yutuqni ochadi (match yakunida tekshiriladi):

| Kod | Nomi | Shart | Noyoblik |
|-----|------|-------|----------|
| `ARENA_ROOKIE` | ⚔️ Arena Rookie | Birinchi match'da yut | rare |
| `ARENA_SCHOLAR` | 📚 Battle Scholar | 25 ta savolga to'g'ri javob ber | epic |
| `ARENA_LEGEND` | 🥇 Arena Legend | 5 ta match yut | legendary |

Har bir ochilgan yutuq qo'shimcha **+25 XP** va **+15 tanga** beradi.

---

## 10. Match yakuni ekrani (`MatchResults.tsx`)

Yutsa ham, yutqazsa ham — **ijobiy** ramka. Jang natijasidan ko'ra **bola nimani o'rgangani** nishonlanadi:

- 🏆 Victory! / 🎓 Great effort! ("Har bir savol seni aqlliroq qildi 🧠")
- Hisob: qizil – ko'k
- Statistikalar: tag-outlar · quiz aniqligi (%) · to'g'ri javoblar · olingan XP · tangalar
- Tugmalar: **New match** (lobbyga) · **Rematch** (qayta o'ynash)

---

## 11. Kelajakdagi imkoniyatlar (Future-ready)

Kod **haqiqiy multiplayer** uchun tayyor qilib yozilgan:

- Tip'lar (`types.ts`) **sof ma'lumot** — engine, mock-multiplayer simulyatsiya va kelajakdagi **Supabase Realtime** backend hammasi bir xil shakldan foydalanishi mumkin
- `ArenaPlayer` shakli botlar va odam o'yinchi uchun bir xil (kelajakdagi netcode uchun)
- Engine deterministik-ish (faqat AI uchun `Math.random`) — serverda **autoritativ** ishlashi mumkin

---

## 12. Xulosa

Battle Learn Arena — KidsCode Quest'ning eng murakkab va eng kuchli moduli:

✅ To'liq real-vaqtli shooter engine (fizika + bot AI)
✅ 4 o'yin rejimi, 3 jamoa o'lchami
✅ 6 turdagi 32 ta ta'limiy savol, 6 kategoriya
✅ "O'lim = o'rganish" falsafasi — bola hech qachon jazolanmaydi
✅ Adaptiv qiyinlik + anti-yodlash aralashtirish
✅ XP/tanga/yutuq tizimiga to'liq integratsiya
✅ Sensorli + klaviatura/sichqoncha boshqaruvi
✅ 100% offline, serversiz — lekin multiplayer uchun tayyor

---

*KidsCode Quest · Battle Learn Arena · Code. Play. Grow. 💜*

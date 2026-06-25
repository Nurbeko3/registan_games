/**
 * Codecaster — trilingual level copy (uz · ru · en).
 *
 * The level data files (L01..L10) hold i18n KEYS for every kid-facing string
 * (title, concept, objective, starter code and the 3-hint ladder); the actual
 * text lives here and is merged into the global `TRANSLATIONS` dictionary in
 * `src/lib/i18n/translations.ts`, so `useT()` / `translate()` resolve them like
 * any other key. Code tokens (`hero.moveRight()`, `#`, quotes, arrows) stay
 * identical across languages — only the prose is translated.
 *
 * Key scheme: `cc.level.<ID>.{title|concept|objective|starter|hint1|hint2|hint3}`.
 */

import type { Locale } from '@/lib/i18n/config';

type Dict = Record<string, string>;

const en: Dict = {
  // L01 — First Step · single function call
  'cc.level.L01.title': 'First Step',
  'cc.level.L01.concept': 'Function call',
  'cc.level.L01.objective': 'Move Pip to the glowing goal tile by calling one move command.',
  'cc.level.L01.starter': '# Move the hero to the right\nhero.moveRight()',
  'cc.level.L01.hint1': 'Type `hero.moveRight()` to move one tile to the right.',
  'cc.level.L01.hint2': 'Functions need parentheses `()` at the end — without them Python just looks at the name but does nothing.',
  'cc.level.L01.hint3': 'The exact solution is:\nhero.moveRight()\nhero.moveRight()\nhero.moveRight()',

  // L02 — Two Steps · sequence
  'cc.level.L02.title': 'Two Steps',
  'cc.level.L02.concept': 'Sequence',
  'cc.level.L02.objective': 'Chain multiple move commands to guide Pip all the way to the goal.',
  'cc.level.L02.starter': '# Each line runs in order, top to bottom\nhero.moveRight()\n# Add more commands below',
  'cc.level.L02.hint1': 'Write one `hero.moveRight()` call per tile you want to move.',
  'cc.level.L02.hint2': 'Each command must be on its own line — Python reads them one by one from top to bottom.',
  'cc.level.L02.hint3': 'You need four `hero.moveRight()` calls in a row to reach the goal.',

  // L03 — Turn the Corner · order matters
  'cc.level.L03.title': 'Turn the Corner',
  'cc.level.L03.concept': 'Order matters',
  'cc.level.L03.objective': 'Guide Pip along the L-shaped path: first go right, then turn down.',
  'cc.level.L03.starter': '# Move right along the top row, then turn down\nhero.moveRight()',
  'cc.level.L03.hint1': 'Follow the path — go right until the corner, then switch to `hero.moveDown()`.',
  'cc.level.L03.hint2': 'If Pip bumps into a wall, check the order: right first, then down.',
  'cc.level.L03.hint3': 'Solution:\nhero.moveRight()\nhero.moveRight()\nhero.moveDown()',

  // L04 — The Long Hall · counting tiles
  'cc.level.L04.title': 'The Long Hall',
  'cc.level.L04.concept': 'Counting tiles',
  'cc.level.L04.objective': 'Pip must reach the end of a long corridor and then drop down to the goal. Count each tile!',
  'cc.level.L04.starter': '# Count the tiles, then write one command per tile\nhero.moveRight()\n# Keep going...',
  'cc.level.L04.hint1': 'Count the floor tiles in the top row — that tells you how many times to call `moveRight()`.',
  'cc.level.L04.hint2': 'After you reach the far-right column, use `hero.moveDown()` to step onto the goal.',
  'cc.level.L04.hint3': 'Four `hero.moveRight()` calls followed by one `hero.moveDown()` will get you there.',

  // L05 — Mind the Comment · comments (#)
  'cc.level.L05.title': 'Mind the Comment',
  'cc.level.L05.concept': 'Comments (#)',
  'cc.level.L05.objective': 'Only real commands move Pip. A commented-out line is a note — it does nothing. Reach the goal!',
  'cc.level.L05.starter': '# This is a comment — Python ignores it completely\n# hero.moveUp()  ← this does NOT run\n\n# Write your real commands below:\nhero.moveRight()',
  'cc.level.L05.hint1': 'Lines that start with `#` are comments — they are notes for humans and Python skips them entirely.',
  'cc.level.L05.hint2': 'The `# hero.moveUp()` line does NOT move Pip — it is just a note. Only un-commented lines run.',
  'cc.level.L05.hint3': 'Keep going right: four `hero.moveRight()` calls will reach the goal.',

  // L06 — Coin Run · hero.collect()
  'cc.level.L06.title': 'Coin Run',
  'cc.level.L06.concept': 'hero.collect()',
  'cc.level.L06.objective': 'Pick up the coin on your way to the goal. You must stand on it and then call collect().',
  'cc.level.L06.starter': '# Move to the coin, collect it, then reach the goal\nhero.moveRight()   # step onto the coin\n# collect it here\n# then keep going',
  'cc.level.L06.hint1': 'Move onto the coin\'s tile first — you can\'t collect from a distance.',
  'cc.level.L06.hint2': 'Once Pip is standing on the coin, call `hero.collect()` to pick it up.',
  'cc.level.L06.hint3': 'Full solution:\nhero.moveRight()\nhero.collect()\nhero.moveRight()\nhero.moveRight()',

  // L07 — Three Coins · collect multiple items
  'cc.level.L07.title': 'Three Coins',
  'cc.level.L07.concept': 'Collect multiple items',
  'cc.level.L07.objective': 'Grab all three coins as you travel down the path, then reach the goal.',
  'cc.level.L07.starter': '# Collect each coin as you pass it\nhero.moveRight()\nhero.collect()  # pick up coin 1\n# keep going down and collecting',
  'cc.level.L07.hint1': 'You must stand on each coin\'s tile and call `hero.collect()` before moving on.',
  'cc.level.L07.hint2': 'The coins are in a column — move right once, then keep moving down and collecting.',
  'cc.level.L07.hint3': 'Pattern:\nmoveRight → collect\nmoveDown → collect\nmoveDown → collect\nmoveRight (goal)',

  // L08 — Locked Door · hero.useKey()
  'cc.level.L08.title': 'Locked Door',
  'cc.level.L08.concept': 'hero.useKey()',
  'cc.level.L08.objective': 'Pick up the key, open the door, and reach the goal on the other side.',
  'cc.level.L08.starter': '# Step 1: move onto the key and collect it\nhero.moveRight()\nhero.collect()   # picks up the key\n# Step 2: face the door and use the key\n# Step 3: walk through to the goal',
  'cc.level.L08.hint1': 'You need a key before you can open a door — move onto the glowing key tile and call `hero.collect()` first.',
  'cc.level.L08.hint2': 'Once you have the key, call `hero.useKey()` while facing the door to unlock it.',
  'cc.level.L08.hint3': 'Full solution:\nhero.moveRight()\nhero.collect()\nhero.useKey()\nhero.moveRight()\nhero.moveRight()\nhero.moveRight()',

  // L09 — Speak, Friend · hero.say() / output
  'cc.level.L09.title': 'Speak, Friend',
  'cc.level.L09.concept': 'hero.say() / output',
  'cc.level.L09.objective': 'Say the magic word "open" to the rune gate, then walk to the goal.',
  'cc.level.L09.starter': '# Speak the magic word (this is like Python\'s print() function)\nhero.say("open")\n# Now walk to the goal',
  'cc.level.L09.hint1': '`hero.say("open")` makes Pip speak — it\'s like Python\'s `print("open")` command.',
  'cc.level.L09.hint2': 'Text must be inside quotes. `hero.say(open)` will fail; `hero.say("open")` works.',
  'cc.level.L09.hint3': 'After saying the word, walk right three times:\nhero.say("open")\nhero.moveRight()\nhero.moveRight()\nhero.moveRight()',

  // L10 — The Sleeping Golem · sequencing synthesis + combat (boss)
  'cc.level.L10.title': 'The Sleeping Golem',
  'cc.level.L10.concept': 'Sequencing synthesis + combat',
  'cc.level.L10.objective': 'The Stone Golem has 3 hit points. Strike it three times in order, then escape to the exit!',
  'cc.level.L10.starter': '# The Golem has 3 HP — hit it once for each HP point\nhero.attack()  # hit 1\n# add two more attacks, then walk to the goal',
  'cc.level.L10.hint1': 'The Golem blocks the path — you cannot walk through it. Call `hero.attack()` to hit it.',
  'cc.level.L10.hint2': 'The Golem has 3 hit points, so you need three `hero.attack()` calls to defeat it.',
  'cc.level.L10.hint3': 'After three attacks the Golem falls. Then walk right four times to reach the goal:\nattack × 3\nmoveRight × 4',
};

const uz: Dict = {
  // L01 — Birinchi qadam · funksiya chaqiruvi
  'cc.level.L01.title': 'Birinchi qadam',
  'cc.level.L01.concept': 'Funksiya chaqiruvi',
  'cc.level.L01.objective': 'Bitta harakat buyrug‘ini chaqirib, Pipni yorqin maqsad katakchasiga olib bor.',
  'cc.level.L01.starter': '# Qahramonni o‘ngga harakatlantir\nhero.moveRight()',
  'cc.level.L01.hint1': '`hero.moveRight()` deb yoz — bu Pipni bitta katak o‘ngga suradi.',
  'cc.level.L01.hint2': 'Funksiyalar oxirida `()` qavslari bo‘lishi shart — ularsiz Python faqat nomga qaraydi, lekin hech narsa qilmaydi.',
  'cc.level.L01.hint3': 'Aniq yechim:\nhero.moveRight()\nhero.moveRight()\nhero.moveRight()',

  // L02 — Ikki qadam · ketma-ketlik
  'cc.level.L02.title': 'Ikki qadam',
  'cc.level.L02.concept': 'Ketma-ketlik',
  'cc.level.L02.objective': 'Bir nechta harakat buyrug‘ini ketma-ket ulab, Pipni maqsadga qadar olib bor.',
  'cc.level.L02.starter': '# Har bir qator yuqoridan pastga tartib bilan bajariladi\nhero.moveRight()\n# Quyiga yana buyruqlar qo‘sh',
  'cc.level.L02.hint1': 'Harakatlanmoqchi bo‘lgan har bir katak uchun bitta `hero.moveRight()` yoz.',
  'cc.level.L02.hint2': 'Har bir buyruq alohida qatorda bo‘lishi kerak — Python ularni yuqoridan pastga bittalab o‘qiydi.',
  'cc.level.L02.hint3': 'Maqsadga yetish uchun ketma-ket to‘rtta `hero.moveRight()` kerak.',

  // L03 — Burchakdan buril · tartib muhim
  'cc.level.L03.title': 'Burchakdan buril',
  'cc.level.L03.concept': 'Tartib muhim',
  'cc.level.L03.objective': 'Pipni L shaklidagi yo‘l bo‘ylab boshqar: avval o‘ngga yur, keyin pastga buril.',
  'cc.level.L03.starter': '# Yuqori qator bo‘ylab o‘ngga yur, keyin pastga buril\nhero.moveRight()',
  'cc.level.L03.hint1': 'Yo‘ldan yur — burchakkacha o‘ngga bor, keyin `hero.moveDown()` ga o‘t.',
  'cc.level.L03.hint2': 'Agar Pip devorga urilsa, tartibni tekshir: avval o‘ngga, keyin pastga.',
  'cc.level.L03.hint3': 'Yechim:\nhero.moveRight()\nhero.moveRight()\nhero.moveDown()',

  // L04 — Uzun yo‘lak · kataklarni sanash
  'cc.level.L04.title': 'Uzun yo‘lak',
  'cc.level.L04.concept': 'Kataklarni sanash',
  'cc.level.L04.objective': 'Pip uzun yo‘lakning oxiriga yetib, keyin pastga tushib maqsadga bormog‘i kerak. Har bir katakni sana!',
  'cc.level.L04.starter': '# Kataklarni sana, keyin har bir katak uchun bitta buyruq yoz\nhero.moveRight()\n# Davom et...',
  'cc.level.L04.hint1': 'Yuqori qatordagi pol kataklarini sana — bu `moveRight()` ni necha marta chaqirishni ko‘rsatadi.',
  'cc.level.L04.hint2': 'Eng o‘ng ustunga yetib olgach, maqsad katakka tushish uchun `hero.moveDown()` dan foydalan.',
  'cc.level.L04.hint3': 'To‘rtta `hero.moveRight()`, keyin bitta `hero.moveDown()` seni maqsadga yetkazadi.',

  // L05 — Izohga e’tibor ber · izohlar (#)
  'cc.level.L05.title': 'Izohga e’tibor ber',
  'cc.level.L05.concept': 'Izohlar (#)',
  'cc.level.L05.objective': 'Faqat haqiqiy buyruqlar Pipni harakatlantiradi. Izohga aylantirilgan qator — bu eslatma, u hech narsa qilmaydi. Maqsadga yet!',
  'cc.level.L05.starter': '# Bu izoh — Python uni butunlay e’tiborsiz qoldiradi\n# hero.moveUp()  ← bu ISHLAMAYDI\n\n# Haqiqiy buyruqlaringni quyiga yoz:\nhero.moveRight()',
  'cc.level.L05.hint1': '`#` bilan boshlanadigan qatorlar — izohlar; ular odamlar uchun eslatma va Python ularni butunlay o‘tkazib yuboradi.',
  'cc.level.L05.hint2': '`# hero.moveUp()` qatori Pipni harakatlantirmaydi — bu shunchaki eslatma. Faqat izohga aylantirilmagan qatorlar ishlaydi.',
  'cc.level.L05.hint3': 'O‘ngga davom et: to‘rtta `hero.moveRight()` maqsadga yetadi.',

  // L06 — Tanga ortidan · hero.collect()
  'cc.level.L06.title': 'Tanga ortidan',
  'cc.level.L06.concept': 'hero.collect()',
  'cc.level.L06.objective': 'Maqsad sari yo‘lda tangani ol. Buning uchun uning ustida turib, keyin collect() ni chaqirishing kerak.',
  'cc.level.L06.starter': '# Tangagacha yur, uni ol, keyin maqsadga yet\nhero.moveRight()   # tanga ustiga qadam qo‘y\n# uni shu yerda ol\n# keyin davom et',
  'cc.level.L06.hint1': 'Avval tanga katagiga yur — uzoqdan turib olib bo‘lmaydi.',
  'cc.level.L06.hint2': 'Pip tanga ustida turganda, uni olish uchun `hero.collect()` ni chaqir.',
  'cc.level.L06.hint3': 'To‘liq yechim:\nhero.moveRight()\nhero.collect()\nhero.moveRight()\nhero.moveRight()',

  // L07 — Uchta tanga · bir nechta narsani yig‘ish
  'cc.level.L07.title': 'Uchta tanga',
  'cc.level.L07.concept': 'Bir nechta narsani yig‘ish',
  'cc.level.L07.objective': 'Yo‘l bo‘ylab pastga tushar ekansan, uchala tangani ham yig‘ib ol, keyin maqsadga yet.',
  'cc.level.L07.starter': '# Yo‘l-yo‘lakay har bir tangani yig‘ib ol\nhero.moveRight()\nhero.collect()  # 1-tangani ol\n# pastga tushib yig‘ishda davom et',
  'cc.level.L07.hint1': 'Davom etishdan oldin har bir tanga katagida turib `hero.collect()` ni chaqirishing kerak.',
  'cc.level.L07.hint2': 'Tangalar bitta ustunda — bir marta o‘ngga yur, keyin pastga tushib yig‘ishda davom et.',
  'cc.level.L07.hint3': 'Andoza:\nmoveRight → collect\nmoveDown → collect\nmoveDown → collect\nmoveRight (maqsad)',

  // L08 — Qulflangan eshik · hero.useKey()
  'cc.level.L08.title': 'Qulflangan eshik',
  'cc.level.L08.concept': 'hero.useKey()',
  'cc.level.L08.objective': 'Kalitni ol, eshikni och va narigi tomondagi maqsadga yet.',
  'cc.level.L08.starter': '# 1-qadam: kalit ustiga yur va uni ol\nhero.moveRight()\nhero.collect()   # kalitni oladi\n# 2-qadam: eshikka qaragan holda kalitni ishlat\n# 3-qadam: maqsad tomon o‘t',
  'cc.level.L08.hint1': 'Eshikni ochishdan oldin kalit kerak — avval yorqin kalit katagiga yurib, `hero.collect()` ni chaqir.',
  'cc.level.L08.hint2': 'Kalit qo‘lingda bo‘lgach, eshikni ochish uchun unga qaragan holda `hero.useKey()` ni chaqir.',
  'cc.level.L08.hint3': 'To‘liq yechim:\nhero.moveRight()\nhero.collect()\nhero.useKey()\nhero.moveRight()\nhero.moveRight()\nhero.moveRight()',

  // L09 — So‘zla, do‘stim · hero.say() / chiqish
  'cc.level.L09.title': 'So‘zla, do‘stim',
  'cc.level.L09.concept': 'hero.say() / chiqish',
  'cc.level.L09.objective': 'Runa darvozasiga sehrli "open" so‘zini ayt, keyin maqsadga qadar yur.',
  'cc.level.L09.starter': '# Sehrli so‘zni ayt (bu Python’ning print() funksiyasiga o‘xshaydi)\nhero.say("open")\n# Endi maqsadga qadar yur',
  'cc.level.L09.hint1': '`hero.say("open")` Pipni gapirtiradi — bu Python’ning `print("open")` buyrug‘iga o‘xshaydi.',
  'cc.level.L09.hint2': 'Matn qo‘shtirnoq ichida bo‘lishi shart. `hero.say(open)` xato beradi; `hero.say("open")` ishlaydi.',
  'cc.level.L09.hint3': 'So‘zni aytganingdan keyin o‘ngga uch marta yur:\nhero.say("open")\nhero.moveRight()\nhero.moveRight()\nhero.moveRight()',

  // L10 — Uxlayotgan Golem · ketma-ketlik sintezi + jang (boss)
  'cc.level.L10.title': 'Uxlayotgan Golem',
  'cc.level.L10.concept': 'Ketma-ketlik sintezi + jang',
  'cc.level.L10.objective': 'Tosh Golemning 3 ta jon nuqtasi (HP) bor. Uni ketma-ket uch marta ur, keyin chiqishga qoch!',
  'cc.level.L10.starter': '# Golemning 3 ta HP si bor — har bir HP uchun bir marta ur\nhero.attack()  # 1-zarba\n# yana ikkita zarba qo‘sh, keyin maqsadga yur',
  'cc.level.L10.hint1': 'Golem yo‘lni to‘sib turibdi — undan o‘tib bo‘lmaydi. Urish uchun `hero.attack()` ni chaqir.',
  'cc.level.L10.hint2': 'Golemning 3 ta jon nuqtasi bor, shuning uchun uni yengish uchun uchta `hero.attack()` kerak.',
  'cc.level.L10.hint3': 'Uch zarbadan keyin Golem qulaydi. Keyin maqsadga yetish uchun o‘ngga to‘rt marta yur:\nattack × 3\nmoveRight × 4',
};

const ru: Dict = {
  // L01 — Первый шаг · вызов функции
  'cc.level.L01.title': 'Первый шаг',
  'cc.level.L01.concept': 'Вызов функции',
  'cc.level.L01.objective': 'Вызови одну команду движения, чтобы привести Пипа на светящуюся клетку-цель.',
  'cc.level.L01.starter': '# Двигай героя вправо\nhero.moveRight()',
  'cc.level.L01.hint1': 'Напиши `hero.moveRight()`, чтобы сдвинуться на одну клетку вправо.',
  'cc.level.L01.hint2': 'Функциям нужны скобки `()` в конце — без них Python просто смотрит на имя, но ничего не делает.',
  'cc.level.L01.hint3': 'Точное решение:\nhero.moveRight()\nhero.moveRight()\nhero.moveRight()',

  // L02 — Два шага · последовательность
  'cc.level.L02.title': 'Два шага',
  'cc.level.L02.concept': 'Последовательность',
  'cc.level.L02.objective': 'Соедини несколько команд движения подряд, чтобы довести Пипа до цели.',
  'cc.level.L02.starter': '# Каждая строка выполняется по порядку, сверху вниз\nhero.moveRight()\n# Добавь команды ниже',
  'cc.level.L02.hint1': 'Пиши по одному `hero.moveRight()` на каждую клетку, на которую хочешь шагнуть.',
  'cc.level.L02.hint2': 'Каждая команда должна быть на своей строке — Python читает их по очереди сверху вниз.',
  'cc.level.L02.hint3': 'Чтобы дойти до цели, нужно четыре `hero.moveRight()` подряд.',

  // L03 — Поворот за угол · порядок важен
  'cc.level.L03.title': 'Поворот за угол',
  'cc.level.L03.concept': 'Порядок важен',
  'cc.level.L03.objective': 'Проведи Пипа по Г-образному пути: сначала вправо, потом поверни вниз.',
  'cc.level.L03.starter': '# Иди вправо по верхнему ряду, затем поверни вниз\nhero.moveRight()',
  'cc.level.L03.hint1': 'Следуй по пути — иди вправо до угла, затем переключись на `hero.moveDown()`.',
  'cc.level.L03.hint2': 'Если Пип врезается в стену, проверь порядок: сначала вправо, потом вниз.',
  'cc.level.L03.hint3': 'Решение:\nhero.moveRight()\nhero.moveRight()\nhero.moveDown()',

  // L04 — Длинный коридор · подсчёт клеток
  'cc.level.L04.title': 'Длинный коридор',
  'cc.level.L04.concept': 'Подсчёт клеток',
  'cc.level.L04.objective': 'Пип должен дойти до конца длинного коридора, а потом спуститься к цели. Считай каждую клетку!',
  'cc.level.L04.starter': '# Посчитай клетки, затем пиши по одной команде на клетку\nhero.moveRight()\n# Продолжай...',
  'cc.level.L04.hint1': 'Посчитай клетки пола в верхнем ряду — это покажет, сколько раз вызвать `moveRight()`.',
  'cc.level.L04.hint2': 'Когда дойдёшь до самого правого столбца, используй `hero.moveDown()`, чтобы шагнуть на цель.',
  'cc.level.L04.hint3': 'Четыре `hero.moveRight()`, а затем один `hero.moveDown()` приведут тебя к цели.',

  // L05 — Осторожно, комментарий · комментарии (#)
  'cc.level.L05.title': 'Осторожно, комментарий',
  'cc.level.L05.concept': 'Комментарии (#)',
  'cc.level.L05.objective': 'Только настоящие команды двигают Пипа. Закомментированная строка — это заметка, она ничего не делает. Доберись до цели!',
  'cc.level.L05.starter': '# Это комментарий — Python полностью его игнорирует\n# hero.moveUp()  ← это НЕ выполняется\n\n# Пиши свои настоящие команды ниже:\nhero.moveRight()',
  'cc.level.L05.hint1': 'Строки, начинающиеся с `#`, — это комментарии; они заметки для людей, и Python их полностью пропускает.',
  'cc.level.L05.hint2': 'Строка `# hero.moveUp()` НЕ двигает Пипа — это просто заметка. Выполняются только незакомментированные строки.',
  'cc.level.L05.hint3': 'Продолжай идти вправо: четыре `hero.moveRight()` доведут до цели.',

  // L06 — За монетой · hero.collect()
  'cc.level.L06.title': 'За монетой',
  'cc.level.L06.concept': 'hero.collect()',
  'cc.level.L06.objective': 'По пути к цели подбери монету. Для этого нужно встать на неё и вызвать collect().',
  'cc.level.L06.starter': '# Дойди до монеты, собери её, затем дойди до цели\nhero.moveRight()   # шаг на монету\n# собери её здесь\n# затем продолжай',
  'cc.level.L06.hint1': 'Сначала встань на клетку с монетой — издалека её не подобрать.',
  'cc.level.L06.hint2': 'Когда Пип стоит на монете, вызови `hero.collect()`, чтобы её подобрать.',
  'cc.level.L06.hint3': 'Полное решение:\nhero.moveRight()\nhero.collect()\nhero.moveRight()\nhero.moveRight()',

  // L07 — Три монеты · сбор нескольких предметов
  'cc.level.L07.title': 'Три монеты',
  'cc.level.L07.concept': 'Сбор нескольких предметов',
  'cc.level.L07.objective': 'Спускаясь по пути, собери все три монеты, затем доберись до цели.',
  'cc.level.L07.starter': '# Собирай каждую монету по пути\nhero.moveRight()\nhero.collect()  # подобрать монету 1\n# продолжай идти вниз и собирать',
  'cc.level.L07.hint1': 'Прежде чем идти дальше, встань на клетку каждой монеты и вызови `hero.collect()`.',
  'cc.level.L07.hint2': 'Монеты стоят в столбце — сделай шаг вправо, затем продолжай идти вниз и собирать.',
  'cc.level.L07.hint3': 'Схема:\nmoveRight → collect\nmoveDown → collect\nmoveDown → collect\nmoveRight (цель)',

  // L08 — Запертая дверь · hero.useKey()
  'cc.level.L08.title': 'Запертая дверь',
  'cc.level.L08.concept': 'hero.useKey()',
  'cc.level.L08.objective': 'Подбери ключ, открой дверь и доберись до цели на другой стороне.',
  'cc.level.L08.starter': '# Шаг 1: дойди до ключа и собери его\nhero.moveRight()\nhero.collect()   # берёт ключ\n# Шаг 2: повернись к двери и используй ключ\n# Шаг 3: пройди к цели',
  'cc.level.L08.hint1': 'Чтобы открыть дверь, сначала нужен ключ — встань на светящуюся клетку с ключом и вызови `hero.collect()`.',
  'cc.level.L08.hint2': 'Когда ключ у тебя, повернись к двери и вызови `hero.useKey()`, чтобы отпереть её.',
  'cc.level.L08.hint3': 'Полное решение:\nhero.moveRight()\nhero.collect()\nhero.useKey()\nhero.moveRight()\nhero.moveRight()\nhero.moveRight()',

  // L09 — Скажи, друг · hero.say() / вывод
  'cc.level.L09.title': 'Скажи, друг',
  'cc.level.L09.concept': 'hero.say() / вывод',
  'cc.level.L09.objective': 'Скажи рунным воротам волшебное слово "open", затем иди к цели.',
  'cc.level.L09.starter': '# Произнеси волшебное слово (это как функция print() в Python)\nhero.say("open")\n# Теперь иди к цели',
  'cc.level.L09.hint1': '`hero.say("open")` заставляет Пипа говорить — это как команда `print("open")` в Python.',
  'cc.level.L09.hint2': 'Текст должен быть в кавычках. `hero.say(open)` выдаст ошибку; `hero.say("open")` работает.',
  'cc.level.L09.hint3': 'После того как скажешь слово, иди вправо три раза:\nhero.say("open")\nhero.moveRight()\nhero.moveRight()\nhero.moveRight()',

  // L10 — Спящий Голем · синтез последовательности + бой (босс)
  'cc.level.L10.title': 'Спящий Голем',
  'cc.level.L10.concept': 'Синтез последовательности + бой',
  'cc.level.L10.objective': 'У Каменного Голема 3 очка здоровья. Ударь его три раза по порядку, затем беги к выходу!',
  'cc.level.L10.starter': '# У Голема 3 HP — бей по разу за каждый HP\nhero.attack()  # удар 1\n# добавь ещё два удара, затем иди к цели',
  'cc.level.L10.hint1': 'Голем перекрывает путь — сквозь него не пройти. Вызови `hero.attack()`, чтобы ударить.',
  'cc.level.L10.hint2': 'У Голема 3 очка здоровья, поэтому чтобы победить его, нужно три вызова `hero.attack()`.',
  'cc.level.L10.hint3': 'После трёх ударов Голем падает. Затем иди вправо четыре раза, чтобы дойти до цели:\nattack × 3\nmoveRight × 4',
};

/** Codecaster level copy keyed by locale, merged into the global dictionary. */
export const CODECASTER_LEVEL_STRINGS: Record<Locale, Dict> = { uz, ru, en };

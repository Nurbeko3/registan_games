/** Educational question engine for BATTLE LEARN ARENA.
 *
 *  Responsibilities:
 *   • scale difficulty to the player's level
 *   • pick a fresh question (avoid repeats within a match)
 *   • randomize answer/option order every time it is shown  ← anti-cheat-learning
 *
 *  Pure & framework-free so it is trivially unit-testable and reusable. */

import { ARENA_QUESTIONS } from '@/data/arenaQuestions';
import type { ArenaQuestion, Category, Difficulty, PreparedQuestion } from './types';
import type { Locale } from '@/lib/i18n/config';

type LocalizedMcq = { prompt: string; options: string[]; explain: string };

const HARDWARE_I18N: Partial<Record<Locale, Record<string, LocalizedMcq>>> = {
  en: {
    'hw-1': { prompt: 'What is the "brain" of the computer called?', options: ['Processor (CPU)', 'Monitor', 'Keyboard', 'Mouse'], explain: 'The processor (CPU) does calculations. It is like the computer brain.' },
    'hw-2': { prompt: 'Which part stores data for a short time?', options: ['Memory (RAM)', 'HDD', 'SSD', 'Graphics card'], explain: 'RAM stores data only while the computer is working.' },
    'hw-3': { prompt: 'Which device shows pictures on the screen?', options: ['Monitor', 'Processor', 'Keyboard', 'Printer'], explain: 'The monitor shows the image made by the computer.' },
    'hw-4': { prompt: 'Which device is used to type text?', options: ['Keyboard', 'Monitor', 'Speakers', 'Microphone'], explain: 'A keyboard lets you type letters, numbers, and commands.' },
    'hw-5': { prompt: 'What controls the cursor?', options: ['Mouse', 'Processor', 'SSD', 'Camera'], explain: 'A mouse moves the cursor around the screen.' },
    'hw-6': { prompt: 'Which main board connects all computer parts?', options: ['Motherboard', 'Monitor', 'CPU', 'Printer'], explain: 'The motherboard connects the parts so they can work together.' },
    'hw-7': { prompt: 'Which part gives power to the computer?', options: ['Power supply (PSU)', 'SSD', 'RAM', 'Keyboard'], explain: 'The power supply sends electricity to the computer parts.' },
    'hw-8': { prompt: 'Which device works with graphics?', options: ['Graphics card (GPU)', 'HDD', 'RAM', 'Microphone'], explain: 'The graphics card helps draw images and games.' },
    'hw-9': { prompt: 'Which device stores data for a long time?', options: ['HDD', 'RAM', 'CPU', 'Monitor'], explain: 'An HDD can keep files even when the computer is off.' },
    'hw-10': { prompt: 'Which storage is faster than an HDD?', options: ['SSD', 'DVD', 'RAM', 'Speakers'], explain: 'An SSD is much faster than a normal hard drive.' },
    'hw-11': { prompt: 'Which device plays sound?', options: ['Speakers', 'Monitor', 'Camera', 'Keyboard'], explain: 'Speakers play sounds from the computer.' },
    'hw-12': { prompt: 'Which device records sound?', options: ['Microphone', 'Mouse', 'Printer', 'Monitor'], explain: 'A microphone records voice and sound.' },
    'hw-13': { prompt: 'Which device prints on paper?', options: ['Printer', 'Scanner', 'CPU', 'Camera'], explain: 'A printer puts computer pictures or text on paper.' },
    'hw-14': { prompt: 'Which device moves paper information into a computer?', options: ['Scanner', 'Printer', 'GPU', 'SSD'], explain: 'A scanner turns a paper document into a digital file.' },
    'hw-15': { prompt: 'Which part helps connect to the internet?', options: ['Network card', 'Processor', 'Speakers', 'Monitor'], explain: 'A network card connects the computer to the internet.' },
    'hw-16': { prompt: 'Where are USB ports connected?', options: ['Motherboard', 'Processor', 'Monitor', 'RAM'], explain: 'USB ports are connected to the motherboard.' },
    'hw-17': { prompt: 'Which part cools the processor?', options: ['Cooler', 'SSD', 'Monitor', 'Keyboard'], explain: 'A cooler removes heat from the processor.' },
    'hw-18': { prompt: 'What helps cool the computer?', options: ['Fan', 'Printer', 'Scanner', 'Speakers'], explain: 'A fan moves air and cools computer parts.' },
    'hw-19': { prompt: 'Where is BIOS stored?', options: ['On the motherboard', 'On the mouse', 'On the monitor', 'In speakers'], explain: 'BIOS is stored in a small chip on the motherboard.' },
    'hw-20': { prompt: 'What helps show high-quality images?', options: ['Graphics card', 'Power supply', 'RAM', 'HDD'], explain: 'The graphics card helps show smooth, clear images.' },
    'hw-21': { prompt: 'Which part helps with many tasks at once?', options: ['RAM', 'Printer', 'Keyboard', 'Speakers'], explain: 'More RAM helps the computer run more tasks at once.' },
    'hw-22': { prompt: 'What device is used for video calls?', options: ['Webcam', 'SSD', 'CPU', 'Scanner'], explain: 'A webcam sends video during calls.' },
    'hw-23': { prompt: 'What keeps a computer on when power goes out?', options: ['UPS', 'GPU', 'HDD', 'RAM'], explain: 'A UPS gives backup power for a short time.' },
    'hw-24': { prompt: 'Where are cloud files stored?', options: ['Server', 'Monitor', 'Keyboard', 'Mouse'], explain: 'Cloud files are stored on remote servers.' },
    'hw-25': { prompt: 'Which device reads discs?', options: ['DVD drive', 'Processor', 'RAM', 'Speakers'], explain: 'A DVD drive reads optical discs.' },
    'hw-26': { prompt: 'Which part does calculations?', options: ['Processor', 'Monitor', 'Microphone', 'SSD'], explain: 'The processor does the computer calculations.' },
    'hw-27': { prompt: 'What helps connect to wireless internet?', options: ['Wi-Fi adapter', 'Printer', 'Scanner', 'HDD'], explain: 'A Wi-Fi adapter receives wireless internet signal.' },
    'hw-28': { prompt: 'What connects to an audio jack?', options: ['Headphones', 'Printer', 'Graphics card', 'Processor'], explain: 'Headphones or speakers connect to an audio jack.' },
    'hw-29': { prompt: 'Which memory is cleared when the computer turns off?', options: ['RAM', 'SSD', 'HDD', 'DVD'], explain: 'RAM is cleared after power turns off.' },
    'hw-30': { prompt: 'What is a small portable storage device called?', options: ['USB flash drive', 'Processor', 'Monitor', 'Speakers'], explain: 'A USB flash drive is a small device for carrying files.' },
  },
  uz: {
    'hw-1': { prompt: 'Kompyuterning "miyasi" nima deyiladi?', options: ['Protsessor (CPU)', 'Monitor', 'Klaviatura', 'Sichqoncha'], explain: 'Protsessor hisob-kitob qiladi. U kompyuterning miyasidek ishlaydi.' },
    'hw-2': { prompt: 'Qaysi qism maʼlumotni vaqtincha saqlaydi?', options: ['Tezkor xotira (RAM)', 'HDD', 'SSD', 'Videokarta'], explain: 'RAM maʼlumotni kompyuter ishlayotgan paytda vaqtincha saqlaydi.' },
    'hw-3': { prompt: 'Qaysi qurilma ekranda rasm ko‘rsatadi?', options: ['Monitor', 'Protsessor', 'Klaviatura', 'Printer'], explain: 'Monitor kompyuter yaratgan tasvirni ko‘rsatadi.' },
    'hw-4': { prompt: 'Matn yozish uchun qaysi qurilma ishlatiladi?', options: ['Klaviatura', 'Monitor', 'Karnay', 'Mikrofon'], explain: 'Klaviatura harf, raqam va buyruqlarni yozishga yordam beradi.' },
    'hw-5': { prompt: 'Kursorni nima boshqaradi?', options: ['Sichqoncha', 'Protsessor', 'SSD', 'Kamera'], explain: 'Sichqoncha kursorni ekran bo‘ylab harakatlantiradi.' },
    'hw-6': { prompt: 'Kompyuter qismlarini qaysi asosiy plata bog‘laydi?', options: ['Ona plata', 'Monitor', 'CPU', 'Printer'], explain: 'Ona plata barcha qismlarni bir-biriga ulaydi.' },
    'hw-7': { prompt: 'Kompyuterga elektr quvvatini qaysi qism beradi?', options: ['Quvvat bloki (PSU)', 'SSD', 'RAM', 'Klaviatura'], explain: 'Quvvat bloki kompyuter qismlariga elektr beradi.' },
    'hw-8': { prompt: 'Grafika bilan qaysi qurilma ishlaydi?', options: ['Videokarta (GPU)', 'HDD', 'RAM', 'Mikrofon'], explain: 'Videokarta rasm va o‘yin grafikalarini chizishga yordam beradi.' },
    'hw-9': { prompt: 'Maʼlumotni uzoq vaqt qaysi qurilma saqlaydi?', options: ['HDD', 'RAM', 'CPU', 'Monitor'], explain: 'HDD fayllarni kompyuter o‘chsa ham saqlab turadi.' },
    'hw-10': { prompt: 'Qaysi xotira HDDdan tezroq?', options: ['SSD', 'DVD', 'RAM', 'Karnay'], explain: 'SSD oddiy qattiq diskdan ancha tez ishlaydi.' },
    'hw-11': { prompt: 'Ovozni qaysi qurilma chiqaradi?', options: ['Karnay', 'Monitor', 'Kamera', 'Klaviatura'], explain: 'Karnay kompyuterdagi ovozni eshittiradi.' },
    'hw-12': { prompt: 'Ovozni yozib olish uchun qaysi qurilma kerak?', options: ['Mikrofon', 'Sichqoncha', 'Printer', 'Monitor'], explain: 'Mikrofon ovoz va nutqni yozib oladi.' },
    'hw-13': { prompt: 'Qaysi qurilma qog‘ozga chiqaradi?', options: ['Printer', 'Skaner', 'CPU', 'Kamera'], explain: 'Printer matn yoki rasmni qog‘ozga chiqaradi.' },
    'hw-14': { prompt: 'Qog‘ozdagi maʼlumotni kompyuterga qaysi qurilma o‘tkazadi?', options: ['Skaner', 'Printer', 'GPU', 'SSD'], explain: 'Skaner qog‘oz hujjatni raqamli faylga aylantiradi.' },
    'hw-15': { prompt: 'Internetga ulanishga qaysi qism yordam beradi?', options: ['Tarmoq kartasi', 'Protsessor', 'Karnay', 'Monitor'], explain: 'Tarmoq kartasi kompyuterni internetga ulaydi.' },
    'hw-16': { prompt: 'USB portlar qayerga ulangan bo‘ladi?', options: ['Ona plataga', 'Protsessorga', 'Monitorga', 'RAMga'], explain: 'USB portlar ona plataga ulanadi.' },
    'hw-17': { prompt: 'Protsessorni qaysi qism sovutadi?', options: ['Kuler', 'SSD', 'Monitor', 'Klaviatura'], explain: 'Kuler protsessordan issiqlikni olib ketadi.' },
    'hw-18': { prompt: 'Kompyuterni sovutishga nima yordam beradi?', options: ['Ventilyator', 'Printer', 'Skaner', 'Karnay'], explain: 'Ventilyator havo aylantirib qismlarni sovutadi.' },
    'hw-19': { prompt: 'BIOS qayerda saqlanadi?', options: ['Ona platada', 'Sichqonchada', 'Monitorda', 'Karnay ichida'], explain: 'BIOS ona platadagi kichik chipda saqlanadi.' },
    'hw-20': { prompt: 'Yuqori sifatli tasvirga nima yordam beradi?', options: ['Videokarta', 'Quvvat bloki', 'RAM', 'HDD'], explain: 'Videokarta tasvirni ravon va tiniq ko‘rsatishga yordam beradi.' },
    'hw-21': { prompt: 'Bir nechta ishni baravar bajarishga qaysi qism yordam beradi?', options: ['RAM', 'Printer', 'Klaviatura', 'Karnay'], explain: 'RAM ko‘p bo‘lsa, kompyuter ko‘proq vazifani bir vaqtda bajaradi.' },
    'hw-22': { prompt: 'Videoqo‘ng‘iroq uchun qaysi qurilma kerak?', options: ['Veb-kamera', 'SSD', 'CPU', 'Skaner'], explain: 'Veb-kamera qo‘ng‘iroqda video yuboradi.' },
    'hw-23': { prompt: 'Chiroq o‘chsa kompyuterni qisqa vaqt ushlab turadigan qurilma nima?', options: ['UPS', 'GPU', 'HDD', 'RAM'], explain: 'UPS elektr o‘chsa ham qisqa vaqt zaxira quvvat beradi.' },
    'hw-24': { prompt: 'Bulutdagi fayllar qayerda saqlanadi?', options: ['Serverda', 'Monitorda', 'Klaviaturada', 'Sichqonchada'], explain: 'Bulut fayllari uzoqdagi serverlarda saqlanadi.' },
    'hw-25': { prompt: 'Disklarni qaysi qurilma o‘qiydi?', options: ['DVD privod', 'Protsessor', 'RAM', 'Karnay'], explain: 'DVD privod optik disklarni o‘qiydi.' },
    'hw-26': { prompt: 'Hisob-kitobni qaysi qism bajaradi?', options: ['Protsessor', 'Monitor', 'Mikrofon', 'SSD'], explain: 'Protsessor kompyuter hisob-kitoblarini bajaradi.' },
    'hw-27': { prompt: 'Simsiz internetga ulanishga nima yordam beradi?', options: ['Wi-Fi adapter', 'Printer', 'Skaner', 'HDD'], explain: 'Wi-Fi adapter simsiz internet signalini qabul qiladi.' },
    'hw-28': { prompt: 'Audio razʼyomga nima ulanadi?', options: ['Quloqchin', 'Printer', 'Videokarta', 'Protsessor'], explain: 'Audio razʼyomga quloqchin yoki karnay ulanadi.' },
    'hw-29': { prompt: 'Kompyuter o‘chsa qaysi xotira tozalanadi?', options: ['RAM', 'SSD', 'HDD', 'DVD'], explain: 'RAM elektr o‘chgandan keyin tozalanadi.' },
    'hw-30': { prompt: 'Kichik ko‘chma xotira qurilmasi nima deyiladi?', options: ['USB fleshka', 'Protsessor', 'Monitor', 'Karnay'], explain: 'USB fleshka fayllarni olib yurish uchun kichik qurilma.' },
  },
};

/** Fisher–Yates shuffle returning a new array (never mutates the input). */
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Difficulty ramp from the spec: Lv 1–4 easy · 5–14 medium · 15+ hard. */
export function difficultyForLevel(level: number): Difficulty {
  if (level >= 15) return 'hard';
  if (level >= 5) return 'medium';
  return 'easy';
}

interface PickOptions {
  level: number;
  /** ids already used this match — skipped so questions feel fresh */
  exclude?: ReadonlySet<string>;
  /** optional category filter (defaults to all six) */
  categories?: Category[];
  locale?: Locale;
}

function localizeQuestion(q: ArenaQuestion, locale: Locale = 'ru'): ArenaQuestion {
  const localized = HARDWARE_I18N[locale]?.[q.id];
  if (!localized || (q.type !== 'mcq' && q.type !== 'code-fill')) return q;
  return { ...q, prompt: localized.prompt, options: localized.options, explain: localized.explain };
}

/** Choose a question for the given level, preferring the target difficulty but
 *  gracefully widening if the pool is exhausted, then prepare it for display. */
export function pickQuestion({ level, exclude, categories, locale }: PickOptions): PreparedQuestion {
  const wanted = difficultyForLevel(level);

  const matches = (q: ArenaQuestion, diffs: Difficulty[]) =>
    diffs.includes(q.difficulty) &&
    (!categories || categories.length === 0 || categories.includes(q.category)) &&
    !(exclude?.has(q.id));

  // try exact difficulty → adjacent difficulties → ignore the exclude set
  const ladder: Difficulty[][] = [[wanted], ['easy', 'medium', 'hard']];
  let pool: ArenaQuestion[] = [];
  for (const diffs of ladder) {
    pool = ARENA_QUESTIONS.filter((q) => matches(q, diffs));
    if (pool.length) break;
  }
  if (!pool.length) pool = ARENA_QUESTIONS.filter((q) => !categories || categories.includes(q.category));
  if (!pool.length) pool = [...ARENA_QUESTIONS];

  const q = localizeQuestion(pool[Math.floor(Math.random() * pool.length)], locale);
  return prepare(q);
}

/** Randomize the presentation of a question so it never looks identical twice. */
export function prepare(q: ArenaQuestion): PreparedQuestion {
  switch (q.type) {
    case 'mcq':
    case 'code-fill': {
      const correctText = q.options[q.answer];
      const options = shuffle(q.options);
      return { q, options, correctIndex: options.indexOf(correctText) };
    }
    case 'truefalse': {
      // present in a random order; correctIndex points at the right one
      const trueFirst = Math.random() < 0.5;
      const labels = q.answer ? ['True', 'False'] : ['True', 'False'];
      const options = trueFirst ? labels : [...labels].reverse();
      const correctIndex = options.indexOf(q.answer ? labels[0] : labels[1]);
      return { q, options, correctIndex };
    }
    case 'order':
      return { q, shuffledBlocks: shuffle(q.blocks) };
    case 'debug':
    case 'binary':
      return { q }; // already varied (random target / line layout)
  }
}

/** Grade a prepared question against the player's response.
 *  `response` shape depends on the type:
 *    mcq/code-fill/truefalse → number (chosen option index)
 *    order                   → string[] (chosen block order)
 *    debug                   → number (chosen line index)
 *    binary                  → number (assembled value)            */
export function isCorrect(p: PreparedQuestion, response: number | string[]): boolean {
  const { q } = p;
  switch (q.type) {
    case 'mcq':
    case 'code-fill':
    case 'truefalse':
      return response === p.correctIndex;
    case 'debug':
      return response === q.buggyLine;
    case 'binary':
      return response === q.target;
    case 'order':
      return Array.isArray(response) && response.join('|') === q.blocks.join('|');
  }
}

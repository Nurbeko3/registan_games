/** Excel → arena question import: template shape, row parsing, and the
 *  trilingual normalize/"translate" function.
 *
 *  No external translation API: the Excel template carries uz/ru/en columns and
 *  the admin fills them. `normalizeImported()` then guarantees every question
 *  ends up with all three locales filled — any blank locale cell is back-filled
 *  from the best available one (en → ru → uz), so a partially-filled sheet still
 *  produces a fully-trilingual question (untranslated locales just mirror a
 *  filled one rather than showing blank). Pure & framework-free → usable in the
 *  admin UI, the API route, and unit tests alike. */

/** DB-row shape the import RPC (`kcq_admin_arena_q_import`) expects. */
export interface ImportedQuestion {
  id: string;
  type: string;
  category: string;
  difficulty: string;
  grade: number;
  emoji: string;
  prompt_uz: string;
  prompt_ru: string;
  prompt_en: string;
  options_uz: string[] | null;
  options_ru: string[] | null;
  options_en: string[] | null;
  explain_uz: string;
  explain_ru: string;
  explain_en: string;
  answer: number | null;
  bool_answer: boolean | null;
}

export interface ParseError {
  row: number; // 1-based sheet row (excluding header)
  message: string;
}
export interface ParseResult {
  questions: ImportedQuestion[];
  errors: ParseError[];
}

/** Exact header order of the downloadable template (one question per row). */
export const TEMPLATE_HEADERS = [
  'id',
  'grade',
  'difficulty',
  'category',
  'type',
  'emoji',
  'prompt_uz', 'prompt_ru', 'prompt_en',
  'opt1_uz', 'opt2_uz', 'opt3_uz', 'opt4_uz',
  'opt1_ru', 'opt2_ru', 'opt3_ru', 'opt4_ru',
  'opt1_en', 'opt2_en', 'opt3_en', 'opt4_en',
  'answer',
  'explain_uz', 'explain_ru', 'explain_en',
] as const;

/** A couple of worked examples shipped in the template so teachers see the shape.
 *  `answer` is the 1-based correct option number (or TRUE/FALSE for truefalse). */
export const TEMPLATE_EXAMPLES: Record<string, string | number>[] = [
  {
    id: '', grade: 3, difficulty: 'easy', category: 'hardware', type: 'mcq', emoji: '🖥️',
    prompt_uz: 'Qaysi qurilma ekranda rasm ko‘rsatadi?',
    prompt_ru: 'Какое устройство выводит изображение на экран?',
    prompt_en: 'Which device shows pictures on the screen?',
    opt1_uz: 'Monitor', opt2_uz: 'Protsessor', opt3_uz: 'Klaviatura', opt4_uz: 'Printer',
    opt1_ru: 'Монитор', opt2_ru: 'Процессор', opt3_ru: 'Клавиатура', opt4_ru: 'Принтер',
    opt1_en: 'Monitor', opt2_en: 'Processor', opt3_en: 'Keyboard', opt4_en: 'Printer',
    answer: 1,
    explain_uz: 'Monitor kompyuter yaratgan tasvirni ko‘rsatadi.',
    explain_ru: 'Монитор показывает изображение, которое создаёт компьютер.',
    explain_en: 'The monitor shows the image made by the computer.',
  },
  {
    id: '', grade: 5, difficulty: 'medium', category: 'programming', type: 'truefalse', emoji: '🔁',
    prompt_uz: '«Loop» (sikl) bir amalni qayta-qayta bajaradi.',
    prompt_ru: 'Цикл (loop) повторяет действие много раз.',
    prompt_en: 'A loop repeats an action many times.',
    opt1_uz: '', opt2_uz: '', opt3_uz: '', opt4_uz: '',
    opt1_ru: '', opt2_ru: '', opt3_ru: '', opt4_ru: '',
    opt1_en: '', opt2_en: '', opt3_en: '', opt4_en: '',
    answer: 'TRUE',
    explain_uz: 'Ha — sikl kodni takrorlash uchun ishlatiladi.',
    explain_ru: 'Да — цикл нужен, чтобы повторять код.',
    explain_en: 'Yes — a loop is used to repeat code.',
  },
];

const VALID_TYPES = new Set(['mcq', 'truefalse', 'code-fill', 'debug', 'order', 'binary']);
const VALID_DIFF = new Set(['easy', 'medium', 'hard']);

const str = (v: unknown): string => (v == null ? '' : String(v).trim());

/** Back-fill blank locales from the best available one (en → ru → uz). */
function fill3(uz: string, ru: string, en: string): [string, string, string] {
  const src = en.trim() || ru.trim() || uz.trim();
  return [uz.trim() || src, ru.trim() || src, en.trim() || src];
}

let autoSeq = 0;
function genId(grade: number): string {
  autoSeq = (autoSeq + 1) % 100000;
  return `imp-g${grade}-${Date.now().toString(36)}${autoSeq.toString(36)}`;
}

/** Parse a single raw sheet row (keys = TEMPLATE_HEADERS) into an
 *  ImportedQuestion, or throw a human-readable error string. */
function rowToImported(raw: Record<string, unknown>): ImportedQuestion {
  const grade = Number(str(raw.grade));
  if (!Number.isInteger(grade) || grade < 1 || grade > 11) {
    throw new Error(`grade must be 1–11 (got "${str(raw.grade) || 'empty'}")`);
  }

  const type = (str(raw.type) || 'mcq').toLowerCase();
  if (!VALID_TYPES.has(type)) throw new Error(`type "${type}" is not supported`);

  const difficulty = (str(raw.difficulty) || 'easy').toLowerCase();
  if (!VALID_DIFF.has(difficulty)) throw new Error(`difficulty "${difficulty}" must be easy/medium/hard`);

  const category = str(raw.category) || 'hardware';
  const emoji = str(raw.emoji) || '❓';

  const [prompt_uz, prompt_ru, prompt_en] = fill3(str(raw.prompt_uz), str(raw.prompt_ru), str(raw.prompt_en));
  if (!prompt_uz) throw new Error('a prompt is required in at least one language');

  const [explain_uz, explain_ru, explain_en] = fill3(str(raw.explain_uz), str(raw.explain_ru), str(raw.explain_en));

  let options_uz: string[] | null = null;
  let options_ru: string[] | null = null;
  let options_en: string[] | null = null;
  let answer: number | null = null;
  let bool_answer: boolean | null = null;

  if (type === 'truefalse') {
    const a = str(raw.answer).toLowerCase();
    if (!['true', 'false', '1', '0', 'ha', 'yes', 'да', 'yo‘q', 'no', 'нет'].includes(a)) {
      throw new Error('truefalse answer must be TRUE or FALSE');
    }
    bool_answer = ['true', '1', 'ha', 'yes', 'да'].includes(a);
  } else {
    // gather options per index, back-filling each locale per option
    const uz: string[] = [];
    const ru: string[] = [];
    const en: string[] = [];
    for (let i = 1; i <= 4; i++) {
      const u = str(raw[`opt${i}_uz`]);
      const r = str(raw[`opt${i}_ru`]);
      const e = str(raw[`opt${i}_en`]);
      if (!u && !r && !e) continue; // option not provided
      const [fu, fr, fe] = fill3(u, r, e);
      uz.push(fu); ru.push(fr); en.push(fe);
    }
    if (uz.length < 2) throw new Error('an mcq needs at least 2 options');
    options_uz = uz; options_ru = ru; options_en = en;

    const n = Number(str(raw.answer));
    if (!Number.isInteger(n) || n < 1 || n > uz.length) {
      throw new Error(`answer must be the correct option number 1–${uz.length}`);
    }
    answer = n - 1; // store 0-based
  }

  return {
    id: str(raw.id) || genId(grade),
    type, category, difficulty, grade, emoji,
    prompt_uz, prompt_ru, prompt_en,
    options_uz, options_ru, options_en,
    explain_uz, explain_ru, explain_en,
    answer, bool_answer,
  };
}

/** Parse all sheet rows; collects per-row errors instead of failing the batch. */
export function parseSheetRows(rows: Record<string, unknown>[]): ParseResult {
  const questions: ImportedQuestion[] = [];
  const errors: ParseError[] = [];
  rows.forEach((raw, idx) => {
    // skip fully-blank lines
    const hasAny = TEMPLATE_HEADERS.some((h) => h !== 'id' && str(raw[h]));
    if (!hasAny) return;
    try {
      questions.push(rowToImported(raw));
    } catch (e) {
      errors.push({ row: idx + 1, message: e instanceof Error ? e.message : 'invalid row' });
    }
  });
  return { questions, errors };
}

/** Re-export the normalize step on a single already-shaped row (used by tests
 *  and the API route to defensively re-fill before persisting). */
export function normalizeImported(q: ImportedQuestion): ImportedQuestion {
  const [prompt_uz, prompt_ru, prompt_en] = fill3(q.prompt_uz, q.prompt_ru, q.prompt_en);
  const [explain_uz, explain_ru, explain_en] = fill3(q.explain_uz, q.explain_ru, q.explain_en);
  return { ...q, prompt_uz, prompt_ru, prompt_en, explain_uz, explain_ru, explain_en };
}

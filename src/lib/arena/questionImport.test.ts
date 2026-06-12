import { describe, it, expect } from 'vitest';
import { parseSheetRows, normalizeImported, TEMPLATE_HEADERS } from './questionImport';

const mcqRow = (over: Record<string, unknown> = {}) => ({
  grade: 3, difficulty: 'easy', category: 'hardware', type: 'mcq', emoji: '🖥️',
  prompt_uz: 'Savol UZ', prompt_ru: 'Вопрос RU', prompt_en: 'Question EN',
  opt1_uz: 'A', opt2_uz: 'B', opt3_uz: 'C', opt4_uz: 'D',
  opt1_ru: 'А', opt2_ru: 'Б', opt3_ru: 'В', opt4_ru: 'Г',
  opt1_en: 'A', opt2_en: 'B', opt3_en: 'C', opt4_en: 'D',
  answer: 1, explain_uz: 'Izoh', explain_ru: 'Поясн', explain_en: 'Explain',
  ...over,
});

describe('parseSheetRows', () => {
  it('parses a full trilingual mcq and converts answer to 0-based', () => {
    const { questions, errors } = parseSheetRows([mcqRow({ id: 'q1', answer: 2 })]);
    expect(errors).toHaveLength(0);
    expect(questions).toHaveLength(1);
    const q = questions[0];
    expect(q.id).toBe('q1');
    expect(q.grade).toBe(3);
    expect(q.answer).toBe(1); // 2 → 0-based 1
    expect(q.options_en).toEqual(['A', 'B', 'C', 'D']);
    expect(q.bool_answer).toBeNull();
  });

  it('back-fills a blank locale from the best available (en→ru→uz)', () => {
    const { questions } = parseSheetRows([mcqRow({ prompt_uz: '', prompt_ru: '', prompt_en: 'Only EN' })]);
    const q = questions[0];
    expect(q.prompt_uz).toBe('Only EN');
    expect(q.prompt_ru).toBe('Only EN');
    expect(q.prompt_en).toBe('Only EN');
    // options also back-fill per index
    const { questions: q2 } = parseSheetRows([
      mcqRow({ opt1_uz: '', opt2_uz: '', opt3_uz: '', opt4_uz: '' }),
    ]);
    expect(q2[0].options_uz).toEqual(['A', 'B', 'C', 'D']); // mirrored from en (en→ru→uz fallback)
  });

  it('parses truefalse and ignores options', () => {
    const { questions, errors } = parseSheetRows([
      mcqRow({ type: 'truefalse', answer: 'TRUE', opt1_uz: '', opt2_uz: '', opt1_ru: '', opt2_ru: '', opt1_en: '', opt2_en: '', opt3_uz: '', opt4_uz: '', opt3_ru: '', opt4_ru: '', opt3_en: '', opt4_en: '' }),
    ]);
    expect(errors).toHaveLength(0);
    expect(questions[0].bool_answer).toBe(true);
    expect(questions[0].options_uz).toBeNull();
    expect(questions[0].answer).toBeNull();
  });

  it('auto-generates an id when blank', () => {
    const { questions } = parseSheetRows([mcqRow()]);
    expect(questions[0].id).toMatch(/^imp-g3-/);
  });

  it('flags an invalid grade', () => {
    const { questions, errors } = parseSheetRows([mcqRow({ grade: 13 })]);
    expect(questions).toHaveLength(0);
    expect(errors[0].message).toMatch(/grade/);
  });

  it('flags an out-of-range answer', () => {
    const { errors } = parseSheetRows([mcqRow({ answer: 9 })]);
    expect(errors[0].message).toMatch(/answer/);
  });

  it('flags fewer than 2 options', () => {
    const { errors } = parseSheetRows([
      mcqRow({ opt2_uz: '', opt3_uz: '', opt4_uz: '', opt2_ru: '', opt3_ru: '', opt4_ru: '', opt2_en: '', opt3_en: '', opt4_en: '' }),
    ]);
    expect(errors[0].message).toMatch(/2 options/);
  });

  it('skips fully-blank rows', () => {
    const blank = Object.fromEntries(TEMPLATE_HEADERS.map((h) => [h, '']));
    const { questions, errors } = parseSheetRows([blank, mcqRow()]);
    expect(errors).toHaveLength(0);
    expect(questions).toHaveLength(1);
  });
});

describe('normalizeImported', () => {
  it('re-fills blank locales defensively', () => {
    const base = parseSheetRows([mcqRow()]).questions[0];
    const broken = { ...base, prompt_ru: '', explain_en: '' };
    const fixed = normalizeImported(broken);
    expect(fixed.prompt_ru).not.toBe('');
    expect(fixed.explain_en).not.toBe('');
  });
});

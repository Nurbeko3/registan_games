/** Admin-imported arena questions (Excel → Supabase) merged into the live pool.
 *
 *  Strictly additive: offline / no-Supabase → this is an empty array and the
 *  arena runs entirely on the static bank. When cloud is on, `loadCloudQuestions()`
 *  fetches the active rows once (cached) so `getCloudQuestions()` stays synchronous
 *  for the pure question engine. A failed fetch silently yields the static pool. */

import { supabase } from '@/lib/supabase/client';
import type { LocalizedQuestion } from './localize';
import type { Category, Difficulty, Grade } from './types';

/** Row shape returned by the public `kcq_arena_questions_list` RPC. */
interface QuestionRow {
  id: string;
  type: string;
  category: string;
  difficulty: string;
  grade: number;
  emoji: string;
  prompt_uz: string; prompt_ru: string; prompt_en: string;
  options_uz: string[] | null; options_ru: string[] | null; options_en: string[] | null;
  explain_uz: string; explain_ru: string; explain_en: string;
  answer: number | null;
  bool_answer: boolean | null;
}

let cache: LocalizedQuestion[] = [];
let loaded = false;
let inflight: Promise<LocalizedQuestion[]> | null = null;

function rowToQuestion(r: QuestionRow): LocalizedQuestion {
  return {
    id: r.id,
    type: (r.type as LocalizedQuestion['type']) ?? 'mcq',
    category: r.category as Category,
    difficulty: r.difficulty as Difficulty,
    grade: r.grade as Grade,
    emoji: r.emoji || '❓',
    prompt: { uz: r.prompt_uz, ru: r.prompt_ru, en: r.prompt_en },
    explain: { uz: r.explain_uz, ru: r.explain_ru, en: r.explain_en },
    options: r.options_uz || r.options_ru || r.options_en
      ? { uz: r.options_uz ?? [], ru: r.options_ru ?? [], en: r.options_en ?? [] }
      : undefined,
    answer: r.answer ?? undefined,
    boolAnswer: r.bool_answer ?? undefined,
  };
}

/** Fetch active cloud questions once; safe to call repeatedly. No-op offline. */
export async function loadCloudQuestions(): Promise<LocalizedQuestion[]> {
  if (loaded) return cache;
  if (inflight) return inflight;
  const sb = supabase;
  if (!sb) {
    loaded = true;
    return cache;
  }
  inflight = (async () => {
    try {
      const { data, error } = await sb.rpc('kcq_arena_questions_list');
      if (!error && Array.isArray(data)) cache = (data as QuestionRow[]).map(rowToQuestion);
    } catch {
      // network/RLS hiccup — fall back to the static bank, never throw
    }
    loaded = true;
    inflight = null;
    return cache;
  })();
  return inflight;
}

/** Synchronous accessor for the question engine; empty until loaded. */
export function getCloudQuestions(): LocalizedQuestion[] {
  return cache;
}

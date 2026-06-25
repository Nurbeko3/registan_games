/**
 * Frontend client for the Claude-powered "Byte" mentor (backend POST /mentor).
 *
 * OFFLINE-FIRST CONTRACT: every export degrades to null when the backend URL is
 * absent, the mentor is disabled (no ANTHROPIC_API_KEY), or the request fails —
 * the caller (AIMentor) then uses the built-in offline hints (src/data/hints.ts).
 * Never throws.
 */

const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '');

export interface MentorContext {
  /** Game/mode slug (e.g. 'codecaster', 'robot-maze'). */
  game: string;
  /** Reply language. */
  locale?: 'uz' | 'ru' | 'en';
  /** How many hints already asked (escalates specificity). */
  attempt?: number;
  /** Codecaster: level id + localized objective. */
  level?: string;
  objective?: string;
  /** Codecaster: the student's current Python source. */
  code?: string;
  /** Codecaster: the kid-friendly error they're seeing. */
  error?: string;
}

/**
 * Ask Byte (the AI) for a contextual hint. Returns the hint string, or null
 * when unavailable — the caller falls back to a static hint.
 */
export async function askByteAI(ctx: MentorContext): Promise<string | null> {
  if (!API_URL) return null;
  try {
    const res = await fetch(`${API_URL}/mentor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ctx),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { ok?: boolean; hint?: string };
    return data?.ok && typeof data.hint === 'string' ? data.hint : null;
  } catch {
    return null;
  }
}

export interface ChatTurn { role: 'user' | 'byte'; text: string }

export interface ChatRequest {
  message: string;
  page?: string;
  locale?: 'uz' | 'ru' | 'en';
  history?: ChatTurn[];
}

/**
 * Free-form "Ask Byte" chat for the site-wide assistant. Returns Byte's reply,
 * or null when the backend is absent/disabled/failed (caller shows a friendly
 * offline message). Never throws.
 */
export async function askByteChat(req: ChatRequest): Promise<string | null> {
  if (!API_URL) return null;
  try {
    const res = await fetch(`${API_URL}/assistant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { ok?: boolean; reply?: string };
    return data?.ok && typeof data.reply === 'string' ? data.reply : null;
  } catch {
    return null;
  }
}

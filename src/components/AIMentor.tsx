'use client';

import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { getHint, MENTOR_GREETINGS, ENCOURAGEMENTS } from '@/data/hints';
import { useT, useLocale } from '@/lib/i18n';
import { askByteAI, type MentorContext } from '@/lib/mentor/ai';

interface Msg { from: 'byte' | 'me'; text: string; ai?: boolean }

/**
 * "Byte" — the AI mentor. When the backend is configured (NEXT_PUBLIC_API_URL +
 * ANTHROPIC_API_KEY), `askHint` asks Claude for a contextual nudge based on the
 * student's live code/error (via `getContext`); otherwise — and on any failure —
 * it falls back to the offline static hints (getHint), so it always works.
 *
 * `getContext` is optional: Codecaster passes the current code/objective/error;
 * other games pass nothing and get generic per-game hints.
 */
export function AIMentor({ game, getContext }: { game: string; getContext?: () => Partial<MentorContext> }) {
  const t = useT();
  const locale = useLocale();
  const shouldReduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    { from: 'byte', text: MENTOR_GREETINGS[Math.floor(Math.random() * MENTOR_GREETINGS.length)] },
  ]);

  const askHint = async () => {
    if (loading) return;
    setMessages((m) => [...m, { from: 'me', text: t('mentor.askHint') }]);
    setLoading(true);
    const ctx = getContext?.() ?? {};
    // Try the AI mentor first; fall back to the offline hint on null.
    const aiHint = await askByteAI({ game, locale, attempt, ...ctx });
    const hint = aiHint ?? (await getHint({ game, attempt }));
    setAttempt((a) => a + 1);
    setLoading(false);
    setMessages((m) => [...m, { from: 'byte', text: hint, ai: aiHint !== null }]);
  };

  const cheer = () => {
    const text = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
    setMessages((m) => [...m, { from: 'byte', text }]);
  };

  return (
    <>
      <motion.button
        onClick={() => setOpen((o) => !o)}
        aria-label={t('mentor.open')}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="fixed bottom-28 right-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-grape text-2xl text-white shadow-toy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grape focus-visible:ring-offset-2"
        animate={shouldReduceMotion ? {} : { y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: shouldReduceMotion ? 0 : Infinity, ease: 'easeInOut' }}
        whileTap={{ scale: 0.9 }}
      >
        🤖
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={shouldReduceMotion ? {} : { opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? {} : { opacity: 0, y: 30, scale: 0.95 }}
            role="dialog"
            aria-modal="true"
            aria-label="Byte — AI Mentor"
            className="fixed bottom-44 right-4 z-40 flex h-[400px] w-[320px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl2 bg-white shadow-toy"
          >
            <div className="flex items-center gap-2 bg-grape px-4 py-3 text-white">
              <span className="text-2xl">🤖</span>
              <div>
                <p className="font-display font-extrabold leading-tight">Byte</p>
                <p className="text-xs text-white/80">{t('mentor.sub')}</p>
              </div>
            </div>

            <div className="flex-1 space-y-2 overflow-auto p-4">
              {messages.map((m, i) => (
                <div key={i} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.from === 'me' ? 'ml-auto bg-grape text-white' : 'bg-cloud text-ink'}`}>
                  {m.from === 'byte' && m.ai && (
                    <span className="mb-1 flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-grape">
                      ✨ {t('mentor.aiBadge')}
                    </span>
                  )}
                  {m.text}
                </div>
              ))}
              {loading && (
                <div className="flex max-w-[85%] items-center gap-1 rounded-2xl bg-cloud px-3 py-2.5 text-ink">
                  {[0, 1, 2].map((d) => (
                    <motion.span
                      key={d}
                      className="h-2 w-2 rounded-full bg-grape/60"
                      animate={shouldReduceMotion ? {} : { y: [0, -4, 0] }}
                      transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 border-t border-cloud p-3">
              <button onClick={askHint} disabled={loading} className="btn-primary flex-1 py-2 text-sm disabled:opacity-60">
                {loading ? t('mentor.thinking') : t('mentor.hint')}
              </button>
              <button onClick={cheer} disabled={loading} className="btn-ghost py-2 text-sm disabled:opacity-60">{t('mentor.cheer')}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

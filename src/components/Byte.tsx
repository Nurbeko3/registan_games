'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { getHint, MENTOR_GREETINGS } from '@/data/hints';
import { useT, useLocale } from '@/lib/i18n';
import { askByteAI, askByteChat, type ChatTurn } from '@/lib/mentor/ai';
import { useByteContext } from '@/lib/mentor/context';

interface Msg { from: 'byte' | 'me'; text: string; ai?: boolean }

/**
 * Byte — the SITE-WIDE AI buddy. Mounted once in AppChrome, so it floats on
 * every page. It's a free-form chat (kid asks anything → Groq answer); on game
 * screens that registered context (via useRegisterByte) it ALSO offers a "Hint"
 * quick-action about the student's live code. Everything degrades gracefully:
 * no backend → a friendly offline message, and hints fall back to static ones.
 */
export function Byte() {
  const t = useT();
  const locale = useLocale();
  const pathname = usePathname() ?? '/';
  const reduce = useReducedMotion();
  const game = useByteContext(); // non-null only on a registered game screen

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [input, setInput] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [messages, setMessages] = useState<Msg[]>([
    { from: 'byte', text: MENTOR_GREETINGS[Math.floor(Math.random() * MENTOR_GREETINGS.length)] },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // keep the latest message in view
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: reduce ? 'auto' : 'smooth' });
  }, [messages, loading, reduce]);

  const push = (m: Msg) => setMessages((prev) => [...prev, m]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    const history: ChatTurn[] = messages.slice(-6).map((m) => ({ role: m.from === 'me' ? 'user' : 'byte', text: m.text }));
    push({ from: 'me', text });
    setLoading(true);
    const reply = await askByteChat({ message: text, page: pathname, locale, history });
    setLoading(false);
    push({ from: 'byte', text: reply ?? t('mentor.offline'), ai: reply !== null });
  };

  const askHint = async () => {
    if (loading) return;
    push({ from: 'me', text: t('mentor.askHint') });
    setLoading(true);
    const ctx = game?.getContext() ?? {};
    const slug = game?.game ?? 'site';
    const aiHint = await askByteAI({ game: slug, locale, attempt, ...ctx });
    const hint = aiHint ?? (await getHint({ game: slug, attempt }));
    setAttempt((a) => a + 1);
    setLoading(false);
    push({ from: 'byte', text: hint, ai: aiHint !== null });
  };

  return (
    <>
      <motion.button
        onClick={() => setOpen((o) => !o)}
        aria-label={t('mentor.open')}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="fixed bottom-24 right-4 z-50 grid h-14 w-14 place-items-center rounded-full bg-grape text-2xl text-white shadow-toy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grape focus-visible:ring-offset-2"
        animate={reduce ? {} : { y: [0, -8, 0] }}
        transition={{ duration: 3, repeat: reduce ? 0 : Infinity, ease: 'easeInOut' }}
        whileTap={{ scale: 0.9 }}
      >
        🤖
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduce ? {} : { opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? {} : { opacity: 0, y: 30, scale: 0.95 }}
            role="dialog"
            aria-modal="true"
            aria-label="Byte — AI buddy"
            className="fixed bottom-40 right-4 z-50 flex h-[440px] w-[340px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl2 bg-white shadow-toy"
          >
            <div className="flex items-center gap-2 bg-grape px-4 py-3 text-white">
              <span className="text-2xl">🤖</span>
              <div className="min-w-0">
                <p className="font-display font-extrabold leading-tight">Byte</p>
                <p className="truncate text-xs text-white/80">{t('mentor.sub')}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label={t('mentor.close')}
                className="ml-auto grid h-7 w-7 place-items-center rounded-full bg-white/20 text-sm hover:bg-white/30"
              >
                ✕
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-2 overflow-auto p-4">
              {messages.map((m, i) => (
                <div key={i} className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm ${m.from === 'me' ? 'ml-auto bg-grape text-white' : 'bg-cloud text-ink'}`}>
                  {m.from === 'byte' && m.ai && (
                    <span className="mb-1 flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wide text-grape">
                      ✨ {t('mentor.aiBadge')}
                    </span>
                  )}
                  <span className="whitespace-pre-line">{m.text}</span>
                </div>
              ))}
              {loading && (
                <div className="flex max-w-[88%] items-center gap-1 rounded-2xl bg-cloud px-3 py-2.5 text-ink">
                  {[0, 1, 2].map((d) => (
                    <motion.span
                      key={d}
                      className="h-2 w-2 rounded-full bg-grape/60"
                      animate={reduce ? {} : { y: [0, -4, 0] }}
                      transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Contextual hint quick-action — only on a game screen */}
            {game && (
              <div className="border-t border-cloud px-3 pt-2">
                <button onClick={askHint} disabled={loading} className="btn-ghost w-full py-2 text-sm disabled:opacity-60">
                  {loading ? t('mentor.thinking') : t('mentor.hint')}
                </button>
              </div>
            )}

            <form
              onSubmit={(e) => { e.preventDefault(); void send(); }}
              className="flex items-center gap-2 border-t border-cloud p-3"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('mentor.placeholder')}
                aria-label={t('mentor.placeholder')}
                maxLength={800}
                className="min-w-0 flex-1 rounded-xl2 bg-cloud px-3 py-2 text-sm text-ink outline-none ring-grape/40 focus:ring-2"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                aria-label={t('mentor.send')}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl2 bg-grape text-white disabled:opacity-50"
              >
                ➤
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

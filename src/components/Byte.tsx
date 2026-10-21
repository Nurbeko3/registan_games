'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { getHint, MENTOR_GREETINGS } from '@/data/hints';
import { useT, useLocale } from '@/lib/i18n';
import { askByteAI, askByteChat, type ChatTurn } from '@/lib/mentor/ai';
import { useByteContext } from '@/lib/mentor/context';
import { Icon } from '@/components/ui/Icon';

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
        className="fixed bottom-20 right-4 z-50 grid h-12 w-12 place-items-center rounded-full bg-brand text-white shadow-lg ring-1 ring-black/5 transition hover:bg-brand-600 lg:bottom-6 lg:right-6"
        whileTap={reduce ? undefined : { scale: 0.94 }}
      >
        <Icon name={open ? 'x' : 'bot'} className="h-5 w-5" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={reduce ? {} : { opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? {} : { opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-label="Byte — AI buddy"
            className="fixed bottom-36 right-4 z-50 flex h-[460px] max-h-[calc(100vh-10rem)] w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-xl lg:bottom-20 lg:right-6"
          >
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-50 text-brand">
                <Icon name="bot" className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="font-display text-sm font-extrabold leading-tight text-fg">Byte</p>
                <p className="truncate text-xs text-fg-faint">{t('mentor.sub')}</p>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label={t('mentor.close')}
                className="btn-subtle btn-icon ml-auto h-8 w-8 min-h-0 rounded-lg"
              >
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 space-y-2 overflow-auto bg-surface-2/60 p-4">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={`max-w-[88%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                    m.from === 'me' ? 'ml-auto rounded-br-md bg-brand text-white' : 'rounded-bl-md border border-border bg-surface text-fg'
                  }`}
                >
                  {m.from === 'byte' && m.ai && (
                    <span className="badge-brand mb-1.5 inline-flex">
                      <Icon name="spark" className="h-3 w-3" /> {t('mentor.aiBadge')}
                    </span>
                  )}
                  <span className="whitespace-pre-line">{m.text}</span>
                </div>
              ))}
              {loading && (
                <div className="flex max-w-[88%] items-center gap-1 rounded-2xl rounded-bl-md border border-border bg-surface px-3.5 py-3">
                  {[0, 1, 2].map((d) => (
                    <motion.span
                      key={d}
                      className="h-1.5 w-1.5 rounded-full bg-fg-faint"
                      animate={reduce ? {} : { y: [0, -3, 0] }}
                      transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Contextual hint quick-action — only on a game screen */}
            {game && (
              <div className="border-t border-border px-3 pt-2.5">
                <button onClick={askHint} disabled={loading} className="btn-secondary btn-sm w-full gap-1.5">
                  <Icon name="help" className="h-4 w-4" />
                  {loading ? t('mentor.thinking') : t('mentor.hint')}
                </button>
              </div>
            )}

            <form
              onSubmit={(e) => { e.preventDefault(); void send(); }}
              className="flex items-center gap-2 p-3"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('mentor.placeholder')}
                aria-label={t('mentor.placeholder')}
                maxLength={800}
                className="input min-w-0 flex-1"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                aria-label={t('mentor.send')}
                className="btn-primary btn-icon shrink-0 rounded-xl"
              >
                <Icon name="send" className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

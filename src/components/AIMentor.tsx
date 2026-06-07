'use client';

import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { getHint, MENTOR_GREETINGS, ENCOURAGEMENTS } from '@/data/hints';
import { useT } from '@/lib/i18n';

interface Msg { from: 'byte' | 'me'; text: string }

/**
 * "Byte" — the offline AI mentor. Gives predefined, kid-safe hints for the
 * current game. The getHint() seam is async so a real model can drop in later.
 */
export function AIMentor({ game }: { game: string }) {
  const t = useT();
  const shouldReduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [messages, setMessages] = useState<Msg[]>([
    { from: 'byte', text: MENTOR_GREETINGS[Math.floor(Math.random() * MENTOR_GREETINGS.length)] },
  ]);

  const askHint = async () => {
    const hint = await getHint({ game, attempt });
    setAttempt((a) => a + 1);
    setMessages((m) => [...m, { from: 'me', text: t('mentor.askHint') }, { from: 'byte', text: hint }]);
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
                  {m.text}
                </div>
              ))}
            </div>

            <div className="flex gap-2 border-t border-cloud p-3">
              <button onClick={askHint} className="btn-primary flex-1 py-2 text-sm">{t('mentor.hint')}</button>
              <button onClick={cheer} className="btn-ghost py-2 text-sm">{t('mentor.cheer')}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

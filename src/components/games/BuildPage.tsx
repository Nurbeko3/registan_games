'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameProps } from './GameProps';

/**
 * BUILD THE PAGE — Web Kingdom's flagship. Stack HTML-style blocks (heading,
 * image, text, button…) in the right order to match a target royal webpage,
 * with a live phone preview. Teaches that a page is structured blocks in order.
 */

type Block = 'title' | 'image' | 'text' | 'button' | 'list';
const PALETTE: Block[] = ['title', 'image', 'text', 'list', 'button'];
const META: Record<Block, { name: string; emoji: string }> = {
  title: { name: 'Sarlavha', emoji: '🏷️' }, image: { name: 'Rasm', emoji: '🖼️' },
  text: { name: 'Matn', emoji: '📝' }, button: { name: 'Tugma', emoji: '🔘' }, list: { name: 'Ro‘yxat', emoji: '📋' },
};

const TARGETS: Block[][] = [
  ['title', 'image', 'button'],
  ['title', 'text', 'image', 'button'],
  ['title', 'image', 'text', 'list', 'button'],
];

function Render({ b, mini }: { b: Block; mini?: boolean }) {
  const h = mini ? 'scale-90' : '';
  if (b === 'title') return <div className={`rounded-md bg-grape px-2 py-1.5 text-center text-xs font-extrabold text-white ${h}`}>👑 Saroy</div>;
  if (b === 'image') return <div className={`grid h-10 place-items-center rounded-md bg-gradient-to-br from-sky to-grape text-lg ${h}`}>🏰</div>;
  if (b === 'text') return <div className={`space-y-1 ${h}`}><div className="h-1.5 w-full rounded bg-ink/15" /><div className="h-1.5 w-4/5 rounded bg-ink/15" /></div>;
  if (b === 'list') return <div className={`space-y-1 ${h}`}>{[0, 1].map((i) => <div key={i} className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-bubble" /><div className="h-1.5 w-2/3 rounded bg-ink/15" /></div>)}</div>;
  return <div className={`rounded-full bg-sun px-3 py-1 text-center text-xs font-extrabold text-ink ${h}`}>Bosing</div>;
}

export function BuildPage({ onWin }: GameProps) {
  const [round, setRound] = useState(0);
  const target = TARGETS[round];
  const [page, setPage] = useState<Block[]>([]);
  const [wrong, setWrong] = useState(0);
  const [status, setStatus] = useState<'idle' | 'ok' | 'no'>('idle');

  const check = () => {
    const match = page.length === target.length && page.every((b, i) => b === target[i]);
    if (match) {
      setStatus('ok');
      setTimeout(() => {
        if (round < TARGETS.length - 1) { setRound((r) => r + 1); setPage([]); setStatus('idle'); }
        else { const stars = wrong === 0 ? 3 : wrong <= 2 ? 2 : 1; onWin(stars); }
      }, 850);
    } else {
      setWrong((w) => w + 1); setStatus('no'); setTimeout(() => setStatus('idle'), 1300);
    }
  };

  return (
    <div className="overflow-hidden rounded-xl2 bg-gradient-to-br from-[#ffe3f1] to-[#ffd0c4] p-4 shadow-card">
      <div className="mb-2 flex items-center justify-between">
        <span className="chip bg-white/70 text-bubble-600">👑 {round + 1}/{TARGETS.length}-sahifa</span>
        <span className="chip bg-white/70 text-ink-soft">Bloklar: {page.length}/{target.length}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* TARGET */}
        <div className="rounded-2xl bg-white/60 p-2">
          <p className="mb-1 text-center text-[11px] font-extrabold text-ink-faint">🎯 Namuna</p>
          <div className="mx-auto w-full rounded-2xl border-4 border-ink/70 bg-white p-2">
            <div className="mx-auto mb-1 h-1 w-6 rounded-full bg-ink/30" />
            <div className="space-y-1.5">{target.map((b, i) => <Render key={i} b={b} mini />)}</div>
          </div>
        </div>

        {/* YOUR PAGE */}
        <div className={`rounded-2xl p-2 transition ${status === 'ok' ? 'bg-mint/30' : status === 'no' ? 'bg-bubble/20' : 'bg-white/60'}`}>
          <p className="mb-1 text-center text-[11px] font-extrabold text-ink-faint">📱 Sizning sahifa</p>
          <div className="mx-auto min-h-[120px] w-full rounded-2xl border-4 border-grape/70 bg-white p-2">
            <div className="mx-auto mb-1 h-1 w-6 rounded-full bg-grape/30" />
            {page.length === 0 ? (
              <p className="grid h-24 place-items-center text-center text-[11px] font-bold text-ink-faint">Pastdan blok qo‘sh →</p>
            ) : (
              <div className="space-y-1.5">
                <AnimatePresence>
                  {page.map((b, i) => (
                    <motion.button key={`${b}-${i}`} layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                      onClick={() => setPage((p) => p.filter((_, idx) => idx !== i))} className="block w-full text-left" title="O‘chirish">
                      <Render b={b} />
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* palette */}
      <div className="mt-3 rounded-2xl bg-white/80 p-2">
        <div className="flex flex-wrap justify-center gap-2">
          {PALETTE.map((b) => (
            <button key={b} onClick={() => setPage((p) => [...p, b])}
              className="flex items-center gap-1 rounded-xl bg-bubble/10 px-3 py-2 text-sm font-extrabold text-bubble-600 shadow-card transition active:scale-90">
              {META[b].emoji} {META[b].name}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button onClick={check} disabled={!page.length} className="btn-primary flex-1 disabled:opacity-40">
          {status === 'ok' ? '✅ Zo‘r!' : status === 'no' ? '❌ Tartibni tekshir' : '🔍 Tekshirish'}
        </button>
        <button onClick={() => setPage([])} className="btn-ghost">Tozalash</button>
      </div>
      <p className="mt-2 text-center text-[11px] text-ink-faint">Bloklarni namunadagi <b>tartibda</b> joyla. Blokni bossang — o‘chadi.</p>
    </div>
  );
}

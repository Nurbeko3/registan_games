'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon, type IconName } from '@/components/ui/Icon';
import type { GameProps } from './GameProps';

/**
 * BUILD THE PAGE — Web Kingdom's flagship. Stack HTML-style blocks (heading,
 * image, text, button…) in the right order to match a target royal webpage,
 * with a live phone preview. Teaches that a page is structured blocks in order.
 */

type Block = 'title' | 'image' | 'text' | 'button' | 'list';
const PALETTE: Block[] = ['title', 'image', 'text', 'list', 'button'];
const META: Record<Block, { name: string; icon: IconName }> = {
  title: { name: 'Sarlavha', icon: 'ticket' }, image: { name: 'Rasm', icon: 'eye' },
  text: { name: 'Matn', icon: 'file' }, button: { name: 'Tugma', icon: 'target' }, list: { name: 'Ro‘yxat', icon: 'layers' },
};

const TARGETS: Block[][] = [
  ['title', 'image', 'button'],
  ['title', 'text', 'image', 'button'],
  ['title', 'image', 'text', 'list', 'button'],
];

function Render({ b, mini }: { b: Block; mini?: boolean }) {
  const h = mini ? 'scale-90' : '';
  if (b === 'title') return <div className={`rounded-md bg-brand px-2 py-1.5 text-center text-xs font-extrabold text-white ${h}`}>Saroy</div>;
  if (b === 'image') return <div className={`grid h-10 place-items-center rounded-md bg-gradient-to-br from-info-500 to-info-600 text-white ${h}`}><Icon name="city" className="h-5 w-5" /></div>;
  if (b === 'text') return <div className={`space-y-1 ${h}`}><div className="h-1.5 w-full rounded bg-fg/15" /><div className="h-1.5 w-4/5 rounded bg-fg/15" /></div>;
  if (b === 'list') return <div className={`space-y-1 ${h}`}>{[0, 1].map((i) => <div key={i} className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-violet-500" /><div className="h-1.5 w-2/3 rounded bg-fg/15" /></div>)}</div>;
  return <div className={`rounded-full bg-amber-400 px-3 py-1 text-center text-xs font-extrabold text-fg ${h}`}>Bosing</div>;
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
    <div className="card">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="chip bg-violet-50 text-violet-700"><Icon name="crown" className="h-3.5 w-3.5" /> {round + 1}/{TARGETS.length}-sahifa</span>
        <span className="chip bg-surface-2 text-fg-soft tabular-nums">Bloklar: {page.length}/{target.length}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* TARGET */}
        <div className="rounded-xl border border-border bg-surface-2 p-2">
          <p className="eyebrow mb-1.5 text-center">Namuna</p>
          <div className="mx-auto w-full rounded-xl border-2 border-fg/70 bg-surface p-2">
            <div className="mx-auto mb-1 h-1 w-6 rounded-full bg-fg/30" />
            <div className="space-y-1.5">{target.map((b, i) => <Render key={i} b={b} mini />)}</div>
          </div>
        </div>

        {/* YOUR PAGE */}
        <div className={`rounded-xl border p-2 transition ${status === 'ok' ? 'border-success-300 bg-success-50' : status === 'no' ? 'border-danger-300 bg-danger-50' : 'border-border bg-surface-2'}`}>
          <p className="eyebrow mb-1.5 text-center">Sizning sahifa</p>
          <div className="mx-auto min-h-[120px] w-full rounded-xl border-2 border-brand/70 bg-surface p-2">
            <div className="mx-auto mb-1 h-1 w-6 rounded-full bg-brand/30" />
            {page.length === 0 ? (
              <p className="grid h-24 place-items-center text-center text-2xs font-bold text-fg-faint">Pastdan blok qo‘sh</p>
            ) : (
              <div className="space-y-1.5">
                <AnimatePresence>
                  {page.map((b, i) => (
                    <motion.button key={`${b}-${i}`} type="button" layout initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                      onClick={() => setPage((p) => p.filter((_, idx) => idx !== i))} className="block w-full rounded-md text-left" title="O‘chirish">
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
      <div className="mt-3 rounded-xl border border-border bg-surface-2 p-2">
        <div className="flex flex-wrap justify-center gap-2">
          {PALETTE.map((b) => (
            <button key={b} type="button" onClick={() => setPage((p) => [...p, b])}
              className="btn-secondary btn-sm gap-1.5">
              <Icon name={META[b].icon} className="h-3.5 w-3.5 text-violet-600" /> {META[b].name}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <button type="button" onClick={check} disabled={!page.length} className={`flex-1 ${status === 'ok' ? 'btn-success' : status === 'no' ? 'btn-danger' : 'btn-primary'}`}>
          {status === 'ok' ? 'Zo‘r!' : status === 'no' ? 'Tartibni tekshir' : 'Tekshirish'}
        </button>
        <button type="button" onClick={() => setPage([])} className="btn-secondary">Tozalash</button>
      </div>
      <p className="mt-2 text-center text-xs text-fg-faint">Bloklarni namunadagi <b>tartibda</b> joyla. Blokni bossang — o‘chadi.</p>
    </div>
  );
}

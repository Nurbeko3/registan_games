'use client';

import { useState } from 'react';
import { Overlay } from './CreateRoomModal';
import { useT } from '@/lib/i18n';

/** Enter a 6-digit room code to join a friend's room. */
export function JoinRoomModal({ onJoin, onClose }: { onJoin: (code: string) => void; onClose: () => void }) {
  const t = useT();
  const [code, setCode] = useState('');
  const valid = code.length >= 4;
  const join = () => { if (valid) onJoin(code); };

  return (
    <Overlay onClose={onClose}>
      <p className="font-display text-xl font-extrabold">{t('arena.join.t')}</p>
      <p className="mt-1 text-sm text-ink-soft">{t('arena.join.sub')}</p>

      <input
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        onKeyDown={(e) => e.key === 'Enter' && join()}
        inputMode="numeric"
        placeholder="000000"
        autoFocus
        className="mt-4 w-full rounded-2xl border-2 border-grape-100 bg-white px-4 py-4 text-center font-display text-3xl font-extrabold tracking-[0.4em] outline-none focus:border-grape"
      />

      <button onClick={join} disabled={!valid} className="btn-primary mt-5 w-full text-lg disabled:opacity-40">
        {t('arena.join.btn')}
      </button>
    </Overlay>
  );
}

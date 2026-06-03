'use client';

import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n';

const MIN = 1;
const MAX = 30;

/** Manual match-length entry in minutes (host types it). Scores are uncapped;
 *  the clock ends the match. Clamps to a sane 1–30 minute range. */
export function MatchLengthInput({
  durationSec,
  disabled,
  onChange,
}: {
  durationSec: number;
  disabled?: boolean;
  onChange: (sec: number) => void;
}) {
  const t = useT();
  const [text, setText] = useState(String(Math.round(durationSec / 60)));

  // keep the field in sync when the host's value arrives over the network
  useEffect(() => { setText(String(Math.round(durationSec / 60))); }, [durationSec]);

  const commit = (raw: string) => {
    const n = Math.round(Number(raw));
    const mins = Number.isFinite(n) && n > 0 ? Math.min(MAX, Math.max(MIN, n)) : Math.round(durationSec / 60);
    setText(String(mins));
    onChange(mins * 60);
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        inputMode="numeric"
        min={MIN}
        max={MAX}
        value={text}
        disabled={disabled}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit((e.target as HTMLInputElement).value); }}
        className="w-20 rounded-xl border-2 border-grape-100 bg-white px-3 py-1.5 text-center font-extrabold outline-none focus:border-grape disabled:opacity-60"
      />
      <span className="text-sm font-bold text-ink-faint">{t('lobby.minutes')}</span>
    </div>
  );
}

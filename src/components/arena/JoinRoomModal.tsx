'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Primitives';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/lib/i18n';

/** Enter a 6-digit room code to join a friend's room. */
export function JoinRoomModal({ open = true, onJoin, onClose }: { open?: boolean; onJoin: (code: string) => void; onClose: () => void }) {
  const t = useT();
  const [code, setCode] = useState('');
  const valid = code.length === 6;
  const join = () => { if (valid) onJoin(code); };

  // reset the field each time the dialog opens
  useEffect(() => { if (open) setCode(''); }, [open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('arena.join.t')}
      description={t('arena.join.sub')}
      size="sm"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">{t('common.close')}</button>
          <button type="button" onClick={join} disabled={!valid} className="btn-primary">
            {t('arena.join.btn')}
            <Icon name="arrowRight" className="h-4 w-4" />
          </button>
        </>
      }
    >
      <label className="block">
        <span className="label">{t('lobby.roomCode')}</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={(e) => e.key === 'Enter' && join()}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="000000"
          autoFocus
          aria-label={t('lobby.roomCode')}
          className="input text-center font-mono text-2xl font-bold tracking-[0.4em] placeholder:tracking-[0.4em]"
        />
      </label>
    </Modal>
  );
}

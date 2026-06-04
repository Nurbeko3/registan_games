'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { isCloudEnabled } from '@/lib/supabase/client';
import { cloudSignIn, cloudSignOut, currentUserId } from '@/lib/supabase/auth';
import { pullProgress, pushProgress } from '@/lib/supabase/sync';
import { useGame } from '@/store/useGame';
import { useT } from '@/lib/i18n';

type Status = 'off' | 'signed-out' | 'signed-in' | 'busy';

/** One-tap cloud save (anonymous). Hidden entirely if Supabase isn't configured. */
export function CloudSaveCard() {
  const t = useT();
  const [status, setStatus] = useState<Status>(isCloudEnabled() ? 'signed-out' : 'off');
  const [msg, setMsg] = useState<string | null>(null);
  const playerName = useGame((s) => s.playerName);
  const setPlayerName = useGame((s) => s.setPlayerName);

  useEffect(() => {
    if (!isCloudEnabled()) return;
    currentUserId().then((id) => setStatus(id ? 'signed-in' : 'signed-out'));
  }, []);

  if (!isCloudEnabled()) return null; // offline-only build — nothing to show

  const enable = async () => {
    setStatus('busy');
    setMsg(null);
    const id = await cloudSignIn();
    if (!id) {
      setStatus('signed-out');
      setMsg(t('cloud.failed'));
      return;
    }
    const which = await pullProgress();
    setStatus('signed-in');
    setMsg(which === 'cloud' ? t('cloud.restored') : t('cloud.on'));
  };

  const syncNow = async () => {
    setStatus('busy');
    await pushProgress();
    setStatus('signed-in');
    setMsg(t('cloud.synced'));
  };

  const signOut = async () => {
    setStatus('busy');
    await cloudSignOut();
    setStatus('signed-out');
    setMsg(t('cloud.signedOut'));
  };

  return (
    <section className="card mt-6">
      <div className="flex items-center gap-3">
        <span className="text-3xl">☁️</span>
        <div className="flex-1">
          <h2 className="font-display text-xl font-extrabold">{t('cloud.title')}</h2>
          <p className="text-sm text-ink-soft">
            {status === 'signed-in' ? t('cloud.onDesc') : t('cloud.offDesc')}
          </p>
        </div>
      </div>

      {status === 'signed-in' && (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-ink-soft">{t('cloud.lbName')}</span>
            <input
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder={t('cloud.namePh')}
              maxLength={20}
              className="w-full rounded-2xl border-2 border-grape-100 bg-white px-4 py-2.5 font-bold outline-none focus:border-grape"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button onClick={syncNow} className="btn-primary flex-1">{t('cloud.syncNow')}</button>
            <Link href="/leaderboard" className="btn-sun flex-1 text-center">{t('cloud.leaderboard')}</Link>
            <button onClick={signOut} className="btn-ghost">{t('cloud.signOut')}</button>
          </div>
        </div>
      )}

      {status === 'signed-out' && <button onClick={enable} className="btn-primary mt-4 w-full">{t('cloud.turnOn')}</button>}
      {status === 'busy' && <button disabled className="btn-primary mt-4 w-full opacity-60">{t('cloud.working')}</button>}

      {msg && <p className="mt-3 text-center text-sm font-bold text-mint-600">{msg}</p>}
    </section>
  );
}

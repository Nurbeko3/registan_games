'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { isCloudEnabled } from '@/lib/supabase/client';
import {
  accountLogin, accountResume, accountSave, accountLogout, type AuthReason,
} from '@/lib/supabase/account';
import { useGame } from '@/store/useGame';
import { Icon, IconTile } from '@/components/ui/Icon';
import { useT } from '@/lib/i18n';

type Phase = 'off' | 'loading' | 'logged-out' | 'logged-in' | 'busy';

/** Student account: log in with the username + password the teacher gave you.
 *  Inside: your name, avatar (shop below) and achievements all sync to the cloud. */
export function AccountCard() {
  const t = useT();
  const playerName = useGame((s) => s.playerName);
  const setPlayerName = useGame((s) => s.setPlayerName);

  const [phase, setPhase] = useState<Phase>(isCloudEnabled() ? 'loading' : 'off');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [signedName, setSignedName] = useState('');
  const [nameDraft, setNameDraft] = useState('');
  const [savedName, setSavedName] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isCloudEnabled()) return;
    accountResume().then((u) => {
      if (u) { setSignedName(u.username); setNameDraft(u.display_name || u.username); setPhase('logged-in'); }
      else setPhase('logged-out');
    });
  }, []);

  if (!isCloudEnabled()) return null;

  const errText = (r?: AuthReason) =>
    r === 'bad' ? t('auth.errBad') : r === 'cloud' ? t('auth.offline') : t('auth.errUnknown');

  const onLogin = async () => {
    setErr(null);
    if (!username.trim() || !password) { setErr(t('auth.errBad')); return; }
    setPhase('busy');
    const r = await accountLogin(username, password);
    if (!r.ok) { setErr(errText(r.reason)); setPhase('logged-out'); return; }
    setSignedName(r.user!.username);
    setNameDraft(r.user!.display_name || r.user!.username);
    setPassword('');
    setPhase('logged-in');
  };

  const onLogout = () => {
    accountLogout();
    setSignedName(''); setUsername(''); setPassword(''); setErr(null);
    setPhase('logged-out');
  };

  const onSaveName = async () => {
    const n = nameDraft.trim();
    if (!n) return;
    setPlayerName(n);
    await accountSave();
    setSavedName(true);
    setTimeout(() => setSavedName(false), 1500);
  };

  return (
    <section className="card mt-6">
      <div className="flex items-center gap-3">
        <IconTile name="user" className="h-12 w-12 shrink-0 bg-grape-50 text-grape ring-grape-100" />
        <div className="flex-1">
          <h2 className="font-display text-xl font-extrabold">{t('auth.title')}</h2>
          <p className="text-sm text-ink-soft">
            {phase === 'logged-in' ? t('auth.syncedSub') : t('auth.loginSub')}
          </p>
        </div>
      </div>

      {phase === 'loading' && (
        <div className="mt-4 grid place-items-center py-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-grape-100 border-t-grape" />
        </div>
      )}

      {/* ── LOGGED IN ── */}
      {phase === 'logged-in' && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2 rounded-2xl bg-mint/15 px-4 py-3">
            <Icon name="profile" className="h-5 w-5 text-mint-600" />
            <div className="flex-1">
              <p className="text-xs font-bold text-ink-faint">{t('auth.signedInAs')}</p>
              <p className="font-display font-extrabold">@{signedName}</p>
            </div>
          </div>

          {/* change display name */}
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-ink-soft">{t('auth.displayName')}</span>
            <div className="flex gap-2">
              <input
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                maxLength={20}
                className="flex-1 rounded-2xl border-2 border-grape-100 bg-white px-4 py-2.5 font-bold outline-none focus:border-grape"
              />
              <button onClick={onSaveName} className="btn-primary px-4">{savedName ? '✓' : t('auth.save')}</button>
            </div>
          </label>

          <div className="flex flex-wrap gap-2">
            <button onClick={() => accountSave()} className="btn-primary flex-1">{t('auth.syncNow')}</button>
            <Link href="/leaderboard" className="btn-sun flex-1 text-center">{t('auth.leaderboard')}</Link>
            <button onClick={onLogout} className="btn-ghost">{t('auth.logout')}</button>
          </div>
          <p className="text-[11px] text-ink-faint">{t('auth.editHint')}</p>
        </div>
      )}

      {/* ── LOGGED OUT: login form ── */}
      {(phase === 'logged-out' || phase === 'busy') && (
        <div className="mt-4">
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-ink-soft">{t('auth.username')}</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('auth.usernamePh')}
              autoComplete="username"
              autoCapitalize="none"
              maxLength={20}
              className="w-full rounded-2xl border-2 border-grape-100 bg-white px-4 py-2.5 font-bold outline-none focus:border-grape"
            />
          </label>
          <label className="mt-3 block">
            <span className="mb-1 block text-sm font-bold text-ink-soft">{t('auth.password')}</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onLogin()}
              placeholder={t('auth.passwordPh')}
              type="password"
              autoComplete="current-password"
              className="w-full rounded-2xl border-2 border-grape-100 bg-white px-4 py-2.5 font-mono font-bold outline-none focus:border-grape"
            />
          </label>

          {err && <p className="mt-3 text-center text-sm font-bold text-bubble-600">{err}</p>}

          <button onClick={onLogin} disabled={phase === 'busy'} className="btn-primary mt-4 w-full text-lg disabled:opacity-60">
            {phase === 'busy' ? t('auth.working') : t('auth.loginBtn')}
          </button>
          <p className="mt-3 text-center text-[11px] text-ink-faint">{t('auth.askTeacher')}</p>
        </div>
      )}
    </section>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { isCloudEnabled } from '@/lib/supabase/client';
import {
  accountLogin, accountResume, accountSave, accountLogout, type AuthReason,
} from '@/lib/supabase/account';
import { useGame } from '@/store/useGame';
import { Icon } from '@/components/ui/Icon';
import { Notice, Spinner } from '@/components/ui/Primitives';
import { useT } from '@/lib/i18n';

type Phase = 'off' | 'loading' | 'logged-out' | 'logged-in' | 'busy';

/** Student account: log in with the username + password the teacher gave you.
 *  Inside: your name, avatar (shop below) and achievements all sync to the cloud. */
export function AccountCard({ className = '' }: { className?: string }) {
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
  void playerName;

  const errText = (r?: AuthReason) =>
    r === 'bad' ? t('auth.errBad') : r === 'rate_limited' ? t('auth.errRateLimited') : r === 'cloud' ? t('auth.offline') : t('auth.errUnknown');

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
    if (!window.confirm(t('auth.logoutConfirm'))) return;
    // accountLogout() already resets the store to a guest baseline (resetToGuest),
    // clearing the student's balance while PRESERVING device prefs (locale/sound/
    // reduced-motion). Calling resetProgress() here too would wipe those prefs.
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
    <section className={`card !p-0 ${className}`}>
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand ring-1 ring-inset ring-brand-100">
          <Icon name="user" className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-base font-extrabold text-fg">{t('auth.title')}</h2>
          <p className="text-xs text-fg-soft">
            {phase === 'logged-in' ? t('auth.syncedSub') : t('auth.loginSub')}
          </p>
        </div>
        {phase === 'logged-in' && (
          <span className="badge-success"><Icon name="cloud" className="h-3 w-3" />{t('auth.signedInAs')}</span>
        )}
      </div>

      {phase === 'loading' && (
        <div className="grid place-items-center py-8">
          <Spinner label={t('common.loading')} />
        </div>
      )}

      {/* ── LOGGED IN ── */}
      {phase === 'logged-in' && (
        <div className="space-y-4 p-5">
          <div className="flex items-center gap-3 rounded-xl bg-surface-2 px-4 py-3">
            <Icon name="profile" className="h-5 w-5 text-success-600" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-fg-faint">{t('auth.signedInAs')}</p>
              <p className="truncate font-display font-bold text-fg">@{signedName}</p>
            </div>
          </div>

          {/* change display name */}
          <div>
            <label htmlFor="account-display-name" className="label">{t('auth.displayName')}</label>
            <div className="flex gap-2">
              <input
                id="account-display-name"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && onSaveName()}
                maxLength={20}
                className="input flex-1"
              />
              <button onClick={onSaveName} className="btn-secondary shrink-0">
                {savedName ? <Icon name="check" className="h-4 w-4 text-success-600" /> : t('auth.save')}
              </button>
            </div>
            <p className="help">{t('auth.editHint')}</p>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <button onClick={() => accountSave()} className="btn-primary flex-1">
              <Icon name="refresh" className="h-4 w-4" />
              {t('auth.syncNow')}
            </button>
            <Link href="/leaderboard" className="btn-secondary flex-1 text-center">
              <Icon name="rank" className="h-4 w-4" />
              {t('auth.leaderboard')}
            </Link>
            <button onClick={onLogout} className="btn-subtle text-danger-600 hover:bg-danger-50 hover:text-danger-700">
              <Icon name="logout" className="h-4 w-4" />
              {t('auth.logout')}
            </button>
          </div>
        </div>
      )}

      {/* ── LOGGED OUT: login form ── */}
      {(phase === 'logged-out' || phase === 'busy') && (
        <form
          className="space-y-4 p-5"
          onSubmit={(e) => { e.preventDefault(); void onLogin(); }}
        >
          <div>
            <label htmlFor="account-username" className="label">{t('auth.username')}</label>
            <input
              id="account-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('auth.usernamePh')}
              autoComplete="username"
              autoCapitalize="none"
              maxLength={20}
              className={`input ${err ? 'input-error' : ''}`}
            />
          </div>
          <div>
            <label htmlFor="account-password" className="label">{t('auth.password')}</label>
            <input
              id="account-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t('auth.passwordPh')}
              type="password"
              autoComplete="current-password"
              className={`input font-mono ${err ? 'input-error' : ''}`}
            />
          </div>

          {err && <Notice tone="danger">{err}</Notice>}

          <button type="submit" disabled={phase === 'busy'} className="btn-primary w-full">
            {phase === 'busy' ? <Spinner className="h-4 w-4 border-white/40 border-t-white" /> : <Icon name="unlock" className="h-4 w-4" />}
            {phase === 'busy' ? t('auth.working') : t('auth.loginBtn')}
          </button>
          <div className="space-y-1 text-center">
            <p className="text-xs font-semibold text-fg-soft">{t('auth.switchHint')}</p>
            <p className="text-xs text-fg-faint">{t('auth.askTeacher')}</p>
          </div>
        </form>
      )}
    </section>
  );
}

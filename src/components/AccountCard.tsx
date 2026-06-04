'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { isCloudEnabled } from '@/lib/supabase/client';
import {
  signUpWithUsername, signInWithUsername, cloudSignOut, currentUsername,
  generatePassword, isValidUsername, type AuthResult,
} from '@/lib/supabase/auth';
import { pullProgress, pushProgress } from '@/lib/supabase/sync';
import { useGame } from '@/store/useGame';
import { useT } from '@/lib/i18n';

type Phase = 'off' | 'loading' | 'signed-out' | 'signed-in' | 'busy';
type Mode = 'create' | 'login';

/** Locally-remembered credentials so the kid can re-see their password on this
 *  device (the session itself keeps them logged in). Never leaves the browser. */
const CREDS_KEY = 'kcq.account';
function rememberCreds(username: string, password: string) {
  try { localStorage.setItem(CREDS_KEY, JSON.stringify({ username, password })); } catch {}
}
function readCreds(): { username: string; password: string } | null {
  try { return JSON.parse(localStorage.getItem(CREDS_KEY) || 'null'); } catch { return null; }
}

/** Username + auto-password account. Hidden entirely if Supabase isn't configured. */
export function AccountCard() {
  const t = useT();
  const playerName = useGame((s) => s.playerName);
  const setPlayerName = useGame((s) => s.setPlayerName);

  const [phase, setPhase] = useState<Phase>(isCloudEnabled() ? 'loading' : 'off');
  const [mode, setMode] = useState<Mode>('create');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [signedName, setSignedName] = useState('');
  const [savedPw, setSavedPw] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // on mount: detect an existing session + prefill the create form
  useEffect(() => {
    if (!isCloudEnabled()) return;
    setUsername(playerName || '');
    setPassword(generatePassword());
    currentUsername().then((u) => {
      if (u) { setSignedName(u); setSavedPw(readCreds()?.password ?? null); setPhase('signed-in'); }
      else setPhase('signed-out');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isCloudEnabled()) return null; // offline-only build — nothing to show

  const errText = (r?: AuthResult['reason']) =>
    r === 'taken' ? t('auth.errTaken')
    : r === 'bad-credentials' ? t('auth.errBad')
    : r === 'confirm' ? t('auth.errConfirm')
    : r === 'weak' ? t('auth.errWeak')
    : r === 'cloud' ? t('auth.offline')
    : t('auth.errUnknown');

  const afterAuth = async (name: string, pw: string) => {
    rememberCreds(name, pw);
    setPlayerName(name);
    const which = await pullProgress(); // adopt whichever side has more progress
    if (which !== 'cloud') await pushProgress();
    setSignedName(name);
    setSavedPw(pw);
    setPhase('signed-in');
    setMsg(which === 'cloud' ? t('auth.restored') : t('auth.welcome', { name }));
  };

  const onCreate = async () => {
    setErr(null); setMsg(null);
    const name = username.trim();
    if (!isValidUsername(name)) { setErr(t('auth.errUsername')); return; }
    setPhase('busy');
    const r = await signUpWithUsername(name, password);
    if (!r.ok) { setErr(errText(r.reason)); setPhase('signed-out'); return; }
    await afterAuth(name, password);
  };

  const onLogin = async () => {
    setErr(null); setMsg(null);
    const name = username.trim();
    if (!name || !password) { setErr(t('auth.errBad')); return; }
    setPhase('busy');
    const r = await signInWithUsername(name, password);
    if (!r.ok) { setErr(errText(r.reason)); setPhase('signed-out'); return; }
    await afterAuth(name, password);
  };

  const onLogout = async () => {
    setPhase('busy');
    await cloudSignOut();
    setSignedName(''); setSavedPw(null); setShowPw(false);
    setUsername(playerName || ''); setPassword(generatePassword());
    setMode('login');
    setPhase('signed-out');
    setMsg(null);
  };

  const onSync = async () => {
    setPhase('busy'); await pushProgress(); setPhase('signed-in'); setMsg(t('auth.synced'));
  };

  const copy = (text: string) => {
    try { navigator.clipboard?.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

  return (
    <section className="card mt-6">
      <div className="flex items-center gap-3">
        <span className="text-3xl">👤</span>
        <div className="flex-1">
          <h2 className="font-display text-xl font-extrabold">{t('auth.title')}</h2>
          <p className="text-sm text-ink-soft">
            {phase === 'signed-in' ? t('auth.syncedSub') : t('auth.subtitle')}
          </p>
        </div>
      </div>

      {phase === 'loading' && (
        <div className="mt-4 grid place-items-center py-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-grape-100 border-t-grape" />
        </div>
      )}

      {/* ── SIGNED IN ── */}
      {phase === 'signed-in' && (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2 rounded-2xl bg-mint/15 px-4 py-3">
            <span className="text-xl">✅</span>
            <div className="flex-1">
              <p className="text-xs font-bold text-ink-faint">{t('auth.signedInAs')}</p>
              <p className="font-display font-extrabold">{signedName}</p>
            </div>
          </div>

          {savedPw && (
            <div className="rounded-2xl bg-cloud px-4 py-3">
              <p className="text-xs font-bold text-ink-faint">{t('auth.yourPassword')}</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 font-mono font-bold tracking-wide">{showPw ? savedPw : '••••••••'}</code>
                <button onClick={() => setShowPw((v) => !v)} className="btn-ghost px-2.5 py-1 text-xs">{showPw ? t('auth.hide') : t('auth.show')}</button>
                <button onClick={() => copy(savedPw)} className="btn-ghost px-2.5 py-1 text-xs">{copied ? t('auth.copied') : t('auth.copy')}</button>
              </div>
              <p className="mt-1 text-[11px] text-ink-faint">{t('auth.savePw')}</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button onClick={onSync} className="btn-primary flex-1">{t('auth.syncNow')}</button>
            <Link href="/leaderboard" className="btn-sun flex-1 text-center">{t('auth.leaderboard')}</Link>
            <button onClick={onLogout} className="btn-ghost">{t('auth.logout')}</button>
          </div>
        </div>
      )}

      {/* ── SIGNED OUT: create / login ── */}
      {phase === 'signed-out' || phase === 'busy' ? (
        <div className="mt-4">
          <div className="mb-3 flex rounded-full bg-cloud p-1 text-sm font-extrabold">
            <button onClick={() => { setMode('create'); setErr(null); }} className={`flex-1 rounded-full py-1.5 transition ${mode === 'create' ? 'bg-grape text-white shadow-card' : 'text-ink-faint'}`}>{t('auth.create')}</button>
            <button onClick={() => { setMode('login'); setErr(null); }} className={`flex-1 rounded-full py-1.5 transition ${mode === 'login' ? 'bg-grape text-white shadow-card' : 'text-ink-faint'}`}>{t('auth.login')}</button>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-bold text-ink-soft">{t('auth.username')}</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t('auth.usernamePh')}
              maxLength={20}
              autoCapitalize="none"
              className="w-full rounded-2xl border-2 border-grape-100 bg-white px-4 py-2.5 font-bold outline-none focus:border-grape"
            />
          </label>

          <AnimatePresence mode="wait">
            {mode === 'create' ? (
              <motion.div key="pw-gen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3 rounded-2xl bg-sun/20 px-4 py-3">
                <p className="text-xs font-bold text-mango-600">{t('auth.yourPassword')}</p>
                <div className="mt-1 flex items-center gap-2">
                  <code className="flex-1 font-mono text-lg font-extrabold tracking-wide text-ink">{password}</code>
                  <button onClick={() => copy(password)} className="btn-ghost px-2.5 py-1 text-xs">{copied ? t('auth.copied') : t('auth.copy')}</button>
                  <button onClick={() => setPassword(generatePassword())} className="btn-ghost px-2.5 py-1 text-xs">↻</button>
                </div>
                <p className="mt-1 text-[11px] text-ink-faint">{t('auth.savePw')}</p>
              </motion.div>
            ) : (
              <motion.label key="pw-in" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-3 block">
                <span className="mb-1 block text-sm font-bold text-ink-soft">{t('auth.password')}</span>
                <input
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && onLogin()}
                  placeholder={t('auth.passwordPh')}
                  className="w-full rounded-2xl border-2 border-grape-100 bg-white px-4 py-2.5 font-mono font-bold outline-none focus:border-grape"
                />
              </motion.label>
            )}
          </AnimatePresence>

          {err && <p className="mt-3 text-center text-sm font-bold text-bubble-600">{err}</p>}

          <button
            onClick={mode === 'create' ? onCreate : onLogin}
            disabled={phase === 'busy'}
            className="btn-primary mt-4 w-full text-lg disabled:opacity-60"
          >
            {phase === 'busy' ? t('auth.working') : mode === 'create' ? t('auth.createBtn') : t('auth.loginBtn')}
          </button>
        </div>
      ) : null}

      {msg && phase !== 'busy' && <p className="mt-3 text-center text-sm font-bold text-mint-600">{msg}</p>}
    </section>
  );
}

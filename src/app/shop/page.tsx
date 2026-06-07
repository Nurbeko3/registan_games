'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { TopBar } from '@/components/layout/TopBar';
import { useGame, useHydrated } from '@/store/useGame';
import { AVATARS, THEMES, type Avatar, type Theme } from '@/data/cosmetics';
import { levelForXp } from '@/lib/leveling';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/lib/i18n';

// ── types ────────────────────────────────────────────────────────────────────

type PendingItem =
  | { kind: 'avatar'; id: string }
  | { kind: 'theme'; id: string };

// ── page root (hydration gate) ────────────────────────────────────────────────

export default function ShopPage() {
  const hydrated = useHydrated();

  if (!hydrated) {
    return (
      <>
        <TopBar />
        <div className="grid min-h-[50vh] place-items-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-grape-100 border-t-grape" />
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar />
      <ShopContent />
    </>
  );
}

// ── main content ─────────────────────────────────────────────────────────────

function ShopContent() {
  const t = useT();
  const coins = useGame((s) => s.coins);
  const xp = useGame((s) => s.xp);
  const level = levelForXp(xp);

  const avatarId = useGame((s) => s.avatarId);
  const unlockedAvatars = useGame((s) => s.unlockedAvatars);
  const buyAvatar = useGame((s) => s.buyAvatar);
  const selectAvatar = useGame((s) => s.selectAvatar);

  const themeId = useGame((s) => s.themeId);
  const unlockedThemes = useGame((s) => s.unlockedThemes);
  const buyTheme = useGame((s) => s.buyTheme);
  const selectTheme = useGame((s) => s.selectTheme);

  // modal for purchase confirmation
  const [pending, setPending] = useState<PendingItem | null>(null);

  // brief toast feedback
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(msg);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  // ── avatar click handler ─────────────────────────────────────────────────
  const handleAvatarClick = useCallback(
    (avatar: Avatar) => {
      const free = avatar.cost === 0;
      const owned = free || unlockedAvatars.includes(avatar.id);
      const lockedByLevel = avatar.unlockLevel ? level < avatar.unlockLevel : false;
      const affordable = coins >= avatar.cost;

      if (owned) {
        selectAvatar(avatar.id);
        return;
      }
      if (lockedByLevel) return; // button is disabled, click should not reach here
      if (!affordable) {
        showToast(t('shop.notEnough'));
        return;
      }
      setPending({ kind: 'avatar', id: avatar.id });
    },
    [unlockedAvatars, level, coins, selectAvatar, showToast, t],
  );

  // ── theme click handler ──────────────────────────────────────────────────
  const handleThemeClick = useCallback(
    (theme: Theme) => {
      const free = theme.cost === 0;
      const owned = free || unlockedThemes.includes(theme.id);
      const affordable = coins >= theme.cost;

      if (owned) {
        selectTheme(theme.id);
        return;
      }
      if (!affordable) {
        showToast(t('shop.notEnough'));
        return;
      }
      setPending({ kind: 'theme', id: theme.id });
    },
    [unlockedThemes, coins, selectTheme, showToast, t],
  );

  // ── confirm purchase ─────────────────────────────────────────────────────
  const handleConfirm = useCallback(() => {
    if (!pending) return;

    if (pending.kind === 'avatar') {
      const avatar = AVATARS.find((a) => a.id === pending.id);
      if (!avatar) { setPending(null); return; }
      const success = buyAvatar(avatar.id);
      if (success) showToast(t('shop.bought', { name: avatar.name }));
    } else {
      const theme = THEMES.find((th) => th.id === pending.id);
      if (!theme) { setPending(null); return; }
      const success = buyTheme(theme.id);
      if (success) showToast(t('shop.bought', { name: theme.name }));
    }
    setPending(null);
  }, [pending, buyAvatar, buyTheme, showToast, t]);

  const handleCancelModal = useCallback(() => setPending(null), []);

  // resolve pending item for the modal display
  const pendingAvatar = pending?.kind === 'avatar'
    ? AVATARS.find((a) => a.id === pending.id) ?? null
    : null;
  const pendingTheme = pending?.kind === 'theme'
    ? THEMES.find((th) => th.id === pending.id) ?? null
    : null;
  const pendingEmoji = pendingAvatar?.emoji ?? pendingTheme?.emoji ?? '';
  const pendingName = pendingAvatar?.name ?? pendingTheme?.name ?? '';
  const pendingCost = pendingAvatar?.cost ?? pendingTheme?.cost ?? 0;

  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-6 page-pad-bottom">

      {/* ── coins balance header ──────────────────────────────────────────── */}
      <section className="card bg-gradient-to-br from-grape to-grape-600 text-center text-white">
        <h1 className="font-display text-2xl font-extrabold">{t('shop.title')}</h1>
        <p className="mt-1 text-sm text-white/80">{t('shop.subtitle')}</p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-2xl bg-white/20 px-6 py-3">
          <Icon name="coin" className="h-8 w-8 text-sun" />
          <span className="font-display text-3xl font-extrabold">{coins}</span>
          <span className="text-sm font-bold text-white/80">{t('rw.coins')}</span>
        </div>
      </section>

      {/* ── characters section ───────────────────────────────────────────── */}
      <section className="mt-6">
        <h2 className="font-display text-xl font-extrabold">{t('rw.characters')}</h2>
        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {AVATARS.map((avatar) => (
            <AvatarCard
              key={avatar.id}
              avatar={avatar}
              active={avatarId === avatar.id}
              owned={avatar.cost === 0 || unlockedAvatars.includes(avatar.id)}
              level={level}
              coins={coins}
              onClick={() => handleAvatarClick(avatar)}
            />
          ))}
        </div>
      </section>

      {/* ── themes section ───────────────────────────────────────────────── */}
      <section className="mt-6">
        <h2 className="font-display text-xl font-extrabold">{t('rw.themes')}</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {THEMES.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              active={themeId === theme.id}
              owned={theme.cost === 0 || unlockedThemes.includes(theme.id)}
              coins={coins}
              onClick={() => handleThemeClick(theme)}
            />
          ))}
        </div>
      </section>

      {/* ── buy confirmation modal ───────────────────────────────────────── */}
      <AnimatePresence>
        {pending && (
          <BuyModal
            emoji={pendingEmoji}
            name={pendingName}
            cost={pendingCost}
            affordable={coins >= pendingCost}
            onConfirm={handleConfirm}
            onCancel={handleCancelModal}
          />
        )}
      </AnimatePresence>

      {/* ── toast notification ───────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <Toast key={toast} message={toast} />
        )}
      </AnimatePresence>
    </main>
  );
}

// ── AvatarCard ────────────────────────────────────────────────────────────────

interface AvatarCardProps {
  avatar: Avatar;
  active: boolean;
  owned: boolean;
  level: number;
  coins: number;
  onClick: () => void;
}

function AvatarCard({ avatar, active, owned, level, coins, onClick }: AvatarCardProps) {
  const t = useT();
  const shouldReduceMotion = useReducedMotion();
  const lockedByLevel = avatar.unlockLevel ? level < avatar.unlockLevel : false;
  const affordable = coins >= avatar.cost;
  const disabled = !owned && (lockedByLevel || !affordable);

  let statusLabel: React.ReactNode;
  if (active) {
    statusLabel = (
      <span className="inline-flex items-center gap-0.5">
        <Icon name="check" className="h-3 w-3" />
        {t('rw.wearing')}
      </span>
    );
  } else if (owned) {
    statusLabel = (
      <span className="inline-flex items-center gap-0.5">
        <Icon name="unlock" className="h-3 w-3" />
        {t('rw.tapWear')}
      </span>
    );
  } else if (lockedByLevel) {
    statusLabel = (
      <span className="inline-flex items-center gap-0.5">
        <Icon name="lock" className="h-3 w-3" />
        {t('common.lv')} {avatar.unlockLevel}
      </span>
    );
  } else {
    statusLabel = (
      <span className="inline-flex items-center gap-1">
        <Icon name="coin" className="h-3 w-3" />
        {avatar.cost}
      </span>
    );
  }

  return (
    <motion.button
      whileTap={shouldReduceMotion ? undefined : { scale: 0.93 }}
      onClick={onClick}
      disabled={disabled}
      aria-label={`${avatar.name}${active ? ` — ${t('rw.wearing')}` : ''}`}
      className={[
        'grid min-h-[4rem] place-items-center rounded-2xl p-3 text-center shadow-card ring-1 ring-grape-100/60 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grape',
        active
          ? 'bg-grape text-white ring-2 ring-grape'
          : owned
            ? 'bg-white hover:bg-grape-50 hover:scale-[1.03]'
            : 'bg-white hover:scale-[1.03]',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
      ].join(' ')}
    >
      <span className="text-3xl leading-none">{avatar.emoji}</span>
      <span className="mt-1 text-xs font-bold leading-tight">{avatar.name}</span>
      <span className="mt-0.5 text-[11px] font-bold leading-none">
        {statusLabel}
      </span>
    </motion.button>
  );
}

// ── ThemeCard ─────────────────────────────────────────────────────────────────

interface ThemeCardProps {
  theme: Theme;
  active: boolean;
  owned: boolean;
  coins: number;
  onClick: () => void;
}

function ThemeCard({ theme, active, owned, coins, onClick }: ThemeCardProps) {
  const t = useT();
  const shouldReduceMotion = useReducedMotion();
  const affordable = coins >= theme.cost;
  const disabled = !owned && !affordable;

  let statusLabel: React.ReactNode;
  if (active) {
    statusLabel = (
      <span className="inline-flex items-center gap-0.5">
        <Icon name="check" className="h-3 w-3" />
        {t('rw.active')}
      </span>
    );
  } else if (owned) {
    statusLabel = (
      <span className="inline-flex items-center gap-0.5">
        <Icon name="unlock" className="h-3 w-3" />
        {t('rw.use')}
      </span>
    );
  } else {
    statusLabel = (
      <span className="inline-flex items-center gap-1">
        <Icon name="coin" className="h-3 w-3" />
        {theme.cost}
      </span>
    );
  }

  return (
    <motion.button
      whileTap={shouldReduceMotion ? undefined : { scale: 0.93 }}
      onClick={onClick}
      disabled={disabled}
      aria-label={`${theme.name}${active ? ` — ${t('rw.active')}` : ''}`}
      className={[
        'min-h-[4rem] rounded-2xl p-4 text-center text-ink shadow-card transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grape',
        active ? 'ring-2 ring-grape' : 'ring-1 ring-grape-100/60',
        theme.bg,
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:scale-[1.02] hover:shadow-card',
      ].join(' ')}
    >
      <div className="text-3xl leading-none">{theme.emoji}</div>
      <p className="mt-1 text-sm font-bold">{theme.name}</p>
      <p className="mt-0.5 text-[11px] font-bold">{statusLabel}</p>
    </motion.button>
  );
}

// ── BuyModal ──────────────────────────────────────────────────────────────────

interface BuyModalProps {
  emoji: string;
  name: string;
  cost: number;
  affordable: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function BuyModal({ emoji, name, cost, affordable, onConfirm, onCancel }: BuyModalProps) {
  const t = useT();
  const shouldReduceMotion = useReducedMotion();

  // keyboard: Escape closes modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  // trap focus inside modal
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { confirmRef.current?.focus(); }, []);

  return (
    // backdrop
    <motion.div
      key="buy-modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 px-4 backdrop-blur-sm"
      onClick={onCancel}
      aria-modal="true"
      role="dialog"
      aria-labelledby="buy-modal-title"
    >
      {/* panel — stop propagation so backdrop click doesn't bleed through */}
      <motion.div
        key="buy-modal-panel"
        initial={shouldReduceMotion ? {} : { scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={shouldReduceMotion ? {} : { scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xs rounded-3xl bg-white p-6 shadow-2xl"
      >
        {/* big emoji */}
        <div className="mb-3 text-center text-6xl leading-none" aria-hidden>
          {emoji}
        </div>

        {/* title */}
        <h2 id="buy-modal-title" className="text-center font-display text-xl font-extrabold">
          {t('shop.buyTitle')}
        </h2>

        {/* question */}
        <p className="mt-2 text-center text-sm font-bold text-ink-soft">
          {t('shop.buyQ', { name, cost: String(cost) })}
        </p>

        {/* cost display */}
        <div className="mt-3 flex items-center justify-center gap-1.5">
          <Icon name="coin" className="h-5 w-5 text-sun" />
          <span className="font-display text-2xl font-extrabold text-grape">{cost}</span>
        </div>

        {/* actions */}
        <div className="mt-5 flex gap-3">
          <button
            onClick={onCancel}
            className="btn-ghost flex-1 py-3 text-base"
          >
            {t('shop.cancel')}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            disabled={!affordable}
            className="btn-primary flex-1 py-3 text-base disabled:opacity-40"
          >
            {t('shop.buy')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message }: { message: string }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? {} : { y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={shouldReduceMotion ? {} : { y: 24, opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="pointer-events-none fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-ink/90 px-5 py-3 text-sm font-bold text-white shadow-xl"
      role="status"
      aria-live="polite"
    >
      {message}
    </motion.div>
  );
}

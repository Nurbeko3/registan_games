'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { TopBar } from '@/components/layout/TopBar';
import { useGame, useHydrated } from '@/store/useGame';
import { AVATARS, THEMES, type Avatar, type Theme } from '@/data/cosmetics';
import { levelForXp } from '@/lib/leveling';
import { Icon, type IconName } from '@/components/ui/Icon';
import { AvatarBadge } from '@/components/ui/AvatarBadge';
import { Modal, Notice, PageHeader, PageLoading, SectionHeader, StatCard } from '@/components/ui/Primitives';
import { useT } from '@/lib/i18n';
import { accountSave } from '@/lib/supabase/account';
import { useMustLogIn } from '@/lib/supabase/useAccount';

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
        <PageLoading />
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
  // Buying is gated to logged-in students only in classroom (cloud) mode.
  // With no Supabase there are no profiles, so the shop stays open offline.
  const mustLogIn = useMustLogIn();

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
      if (mustLogIn) {
        showToast(t('shop.loginToast'));
        return;
      }
      if (!affordable) {
        showToast(t('shop.notEnough'));
        return;
      }
      setPending({ kind: 'avatar', id: avatar.id });
    },
    [unlockedAvatars, level, coins, mustLogIn, selectAvatar, showToast, t],
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
      if (mustLogIn) {
        showToast(t('shop.loginToast'));
        return;
      }
      if (!affordable) {
        showToast(t('shop.notEnough'));
        return;
      }
      setPending({ kind: 'theme', id: theme.id });
    },
    [unlockedThemes, coins, mustLogIn, selectTheme, showToast, t],
  );

  // ── confirm purchase ─────────────────────────────────────────────────────
  const handleConfirm = useCallback(() => {
    if (!pending) return;

    let success = false;
    if (pending.kind === 'avatar') {
      const avatar = AVATARS.find((a) => a.id === pending.id);
      if (!avatar) { setPending(null); return; }
      success = buyAvatar(avatar.id);
      if (success) showToast(t('shop.bought', { name: avatar.name }));
    } else {
      const theme = THEMES.find((th) => th.id === pending.id);
      if (!theme) { setPending(null); return; }
      success = buyTheme(theme.id);
      if (success) showToast(t('shop.bought', { name: theme.name }));
    }
    // Persist the spend immediately so a quick logout (which resets local
    // progress) can't lose the purchase before AccountSync's debounce fires.
    if (success) void accountSave();
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
  const pendingName = pendingAvatar?.name ?? pendingTheme?.name ?? '';
  const pendingCost = pendingAvatar?.cost ?? pendingTheme?.cost ?? 0;

  const ownedAvatars = AVATARS.filter((a) => a.cost === 0 || unlockedAvatars.includes(a.id)).length;
  const ownedThemes = THEMES.filter((th) => th.cost === 0 || unlockedThemes.includes(th.id)).length;

  return (
    <main id="main" className="page-pad-bottom mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader icon="bag" eyebrow={t('nav.shop')} title={t('shop.title')} description={t('shop.subtitle')} />

      {/* ── balance + inventory ──────────────────────────────────────────── */}
      <section className="mt-6 hidden grid-cols-3 gap-3 sm:grid">
        <StatCard label={t('rw.coins')} value={coins} icon="coin" tone="amber" />
        <StatCard label={t('rw.characters')} value={`${ownedAvatars}/${AVATARS.length}`} icon="user" tone="brand" />
        <StatCard label={t('rw.themes')} value={`${ownedThemes}/${THEMES.length}`} icon="layers" tone="neutral" />
      </section>
      <dl className="card mt-6 grid grid-cols-3 divide-x divide-border !p-0 sm:hidden">
        <Metric label={t('rw.coins')} value={coins} icon="coin" tone="text-amber-500" />
        <Metric label={t('rw.characters')} value={`${ownedAvatars}/${AVATARS.length}`} icon="user" tone="text-brand" />
        <Metric label={t('rw.themes')} value={`${ownedThemes}/${THEMES.length}`} icon="layers" tone="text-fg-soft" />
      </dl>

      {/* ── login-required banner (cloud mode only, when not logged in) ──── */}
      {mustLogIn && (
        <Notice
          tone="brand"
          icon="lock"
          className="mt-4"
          action={<Link href="/rewards" className="btn-primary btn-sm">{t('shop.loginCta')}</Link>}
        >
          <p className="font-bold">{t('shop.loginBannerTitle')}</p>
          <p className="mt-0.5 font-medium text-brand-700/80">{t('shop.loginRequired')}</p>
        </Notice>
      )}

      {/* ── characters section ───────────────────────────────────────────── */}
      <section className="mt-8">
        <SectionHeader title={t('rw.characters')} description={`${ownedAvatars}/${AVATARS.length}`} />
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
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
      <section className="mt-8">
        <SectionHeader title={t('rw.themes')} description={`${ownedThemes}/${THEMES.length}`} />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
      <Modal
        open={pending !== null}
        onClose={handleCancelModal}
        size="sm"
        title={t('shop.buyTitle')}
        footer={
          <>
            <button onClick={handleCancelModal} className="btn-secondary">{t('shop.cancel')}</button>
            <button onClick={handleConfirm} disabled={coins < pendingCost} className="btn-primary" autoFocus>
              <Icon name="coin" className="h-4 w-4" />
              {t('shop.buy')} · {pendingCost}
            </button>
          </>
        }
      >
        <div className="flex items-center gap-4">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-surface-2 ring-1 ring-inset ring-border">
            {pendingAvatar ? (
              <AvatarBadge avatar={pendingAvatar.id} className="h-12 w-12 text-3xl" bg="" />
            ) : pendingTheme ? (
              <span className={`h-12 w-12 rounded-lg ring-1 ring-inset ring-border ${pendingTheme.bg}`} aria-hidden />
            ) : null}
          </span>
          <div className="min-w-0">
            <p className="font-display text-base font-extrabold text-fg">{pendingName}</p>
            <p className="mt-0.5 text-sm text-fg-soft">{t('shop.buyQ', { name: pendingName, cost: String(pendingCost) })}</p>
            <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-fg">
              <Icon name="coin" className="h-4 w-4 text-amber-500" />
              <span className="tabular-nums">{coins}</span>
              <Icon name="arrowRight" className="h-3.5 w-3.5 text-fg-faint" />
              <span className={`tabular-nums ${coins - pendingCost < 0 ? 'text-danger' : 'text-fg'}`}>{coins - pendingCost}</span>
            </p>
          </div>
        </div>
      </Modal>

      {/* ── toast notification ───────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && <Toast key={toast} message={toast} />}
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

  let status: React.ReactNode;
  if (active) {
    status = <span className="badge-brand"><Icon name="check" className="h-3 w-3" />{t('rw.wearing')}</span>;
  } else if (owned) {
    status = <span className="badge-neutral">{t('rw.tapWear')}</span>;
  } else if (lockedByLevel) {
    status = <span className="badge-neutral"><Icon name="lock" className="h-3 w-3" />{t('common.lv')} {avatar.unlockLevel}</span>;
  } else {
    status = (
      <span className={affordable ? 'badge-warning' : 'badge-neutral'}>
        <Icon name="coin" className="h-3 w-3" />{avatar.cost}
      </span>
    );
  }

  return (
    <motion.button
      type="button"
      whileTap={shouldReduceMotion || disabled ? undefined : { scale: 0.97 }}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={`${avatar.name}${active ? ` — ${t('rw.wearing')}` : ''}`}
      className={[
        'flex flex-col items-center rounded-xl border bg-surface p-3 text-center transition focus-visible:ring-2 focus-visible:ring-brand',
        active
          ? 'border-brand ring-2 ring-brand/30'
          : 'border-border shadow-xs hover:border-border-strong hover:shadow-sm',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      ].join(' ')}
    >
      <AvatarBadge avatar={avatar.id} className="h-14 w-14 text-3xl" rounded="rounded-lg" bg={active ? 'bg-brand-50' : 'bg-surface-2'} />
      <span className="mt-2 w-full truncate text-xs font-bold text-fg">{avatar.name}</span>
      <span className="mt-1.5">{status}</span>
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

  let status: React.ReactNode;
  if (active) {
    status = <span className="badge-brand"><Icon name="check" className="h-3 w-3" />{t('rw.active')}</span>;
  } else if (owned) {
    status = <span className="badge-neutral">{t('rw.use')}</span>;
  } else {
    status = (
      <span className={affordable ? 'badge-warning' : 'badge-neutral'}>
        <Icon name="coin" className="h-3 w-3" />{theme.cost}
      </span>
    );
  }

  return (
    <motion.button
      type="button"
      whileTap={shouldReduceMotion || disabled ? undefined : { scale: 0.97 }}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      aria-label={`${theme.name}${active ? ` — ${t('rw.active')}` : ''}`}
      className={[
        'overflow-hidden rounded-xl border bg-surface text-left transition focus-visible:ring-2 focus-visible:ring-brand',
        active ? 'border-brand ring-2 ring-brand/30' : 'border-border shadow-xs hover:border-border-strong hover:shadow-sm',
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
      ].join(' ')}
    >
      {/* preview swatch of the theme background */}
      <div className={`relative h-20 border-b border-border ${theme.bg}`} aria-hidden>
        <div className="absolute inset-x-3 bottom-3 space-y-1.5">
          <div className="h-2 w-2/3 rounded-full bg-surface/90 ring-1 ring-border" />
          <div className="h-2 w-1/2 rounded-full bg-surface/70 ring-1 ring-border" />
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2.5">
        <span className="truncate text-xs font-bold text-fg">{theme.name}</span>
        {status}
      </div>
    </motion.button>
  );
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function Toast({ message }: { message: string }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={shouldReduceMotion ? {} : { y: 16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={shouldReduceMotion ? {} : { y: 16, opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className="pointer-events-none fixed inset-x-4 bottom-24 z-50 mx-auto flex w-fit max-w-sm items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-fg shadow-lg md:bottom-8"
      role="status"
      aria-live="polite"
    >
      <Icon name="checkCircle" className="h-4 w-4 shrink-0 text-success-600" />
      {message}
    </motion.div>
  );
}

/** Compact 3-up metric cell for phones (desktop uses StatCard). */
function Metric({ label, value, icon, tone }: { label: string; value: number | string; icon: IconName; tone: string }) {
  return (
    <div className="min-w-0 px-3 py-3">
      <dt className="flex items-center gap-1 truncate text-2xs font-semibold text-fg-faint">
        <Icon name={icon} className={`h-3.5 w-3.5 shrink-0 ${tone}`} />
        <span className="truncate">{label}</span>
      </dt>
      <dd className="mt-0.5 font-display text-lg font-extrabold tabular-nums leading-none text-fg">{value}</dd>
    </div>
  );
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TopBar } from '@/components/layout/TopBar';
import { useGame, useHydrated, selectTotalStars } from '@/store/useGame';
import { ACHIEVEMENT_GROUPS, ACHIEVEMENTS, RARITY_RING, type Achievement } from '@/data/achievements';
import { levelState } from '@/lib/leveling';
import { AccountCard } from '@/components/AccountCard';
import { isCloudEnabled } from '@/lib/supabase/client';
import { ACCOUNT_SESSION_EVENT, accountLogout, accountResume, readSession } from '@/lib/supabase/account';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/lib/i18n';

export default function RewardsPage() {
  const hydrated = useHydrated();

  if (!hydrated) {
    return (
      <>
        <TopBar />
        <div className="grid min-h-[50vh] place-items-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-grape-100 border-t-grape" /></div>
      </>
    );
  }
  return (
    <>
      <TopBar />
      <RewardsContent />
    </>
  );
}

function RewardsContent() {
  const t = useT();
  const xp = useGame((s) => s.xp);
  const ls = levelState(xp);
  const totalStars = useGame(selectTotalStars);
  const coins = useGame((s) => s.coins);
  const unlockedAch = useGame((s) => s.unlockedAchievements);
  const claimDaily = useGame((s) => s.claimDaily);
  const lastDailyClaim = useGame((s) => s.lastDailyClaim);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    let alive = true;
    const sync = () => {
      if (!readSession()) {
        setLoggedIn(false);
        return;
      }
      accountResume().then((user) => {
        if (alive) setLoggedIn(!!user);
      });
    };
    sync();
    window.addEventListener(ACCOUNT_SESSION_EVENT, sync);
    window.addEventListener('storage', sync);
    window.addEventListener('focus', sync);
    return () => {
      alive = false;
      window.removeEventListener(ACCOUNT_SESSION_EVENT, sync);
      window.removeEventListener('storage', sync);
      window.removeEventListener('focus', sync);
    };
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const canClaim = lastDailyClaim !== today;

  const onClaim = () => {
    const r = claimDaily();
    if (r) setClaimMsg(t('rw.claimMsg', { coins: r.coins, xp: r.xp }));
  };

  if (!loggedIn && isCloudEnabled()) {
    return (
      <main id="main" className="mx-auto grid min-h-[calc(100vh-12rem)] max-w-md place-items-center px-4 py-8">
        <div className="w-full">
          <AccountCard />
        </div>
      </main>
    );
  }

  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-6 page-pad-bottom">
      {/* header stats */}
      <section className="card overflow-hidden bg-gradient-to-br from-grape to-grape-600 text-center text-white">
        <h1 className="font-display text-2xl font-extrabold">{t('rw.profile')}</h1>
        <div className="mt-4 flex justify-center gap-4 font-display font-extrabold sm:gap-8">
          <div className="flex flex-col items-center rounded-2xl bg-white/15 px-4 py-3">
            <div className="text-3xl font-extrabold">{ls.level}</div>
            <div className="mt-0.5 text-xs text-white/80">{t('rw.level')}</div>
          </div>
          <div className="flex flex-col items-center rounded-2xl bg-white/15 px-4 py-3">
            <div className="flex items-center gap-1 text-3xl">{totalStars}<Icon name="star" className="h-6 w-6 text-sun" /></div>
            <div className="mt-0.5 text-xs text-white/80">{t('rw.stars')}</div>
          </div>
          <div className="flex flex-col items-center rounded-2xl bg-white/15 px-4 py-3">
            <div className="flex items-center gap-1 text-3xl">{coins}<Icon name="coin" className="h-6 w-6 text-sun" /></div>
            <div className="mt-0.5 text-xs text-white/80">{t('rw.coins')}</div>
          </div>
        </div>
      </section>

      <OfflineNameCard />

      {/* daily reward */}
      <section className="card mt-5 flex items-center gap-4">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-grape-50 text-grape">
          <Icon name="gift" className="h-7 w-7" />
        </span>
        <div className="flex-1">
          <p className="font-display font-extrabold">{t('rw.daily')}</p>
          <p className="text-sm text-ink-soft">{canClaim ? t('rw.dailyClaim') : claimMsg ?? t('rw.dailyBack')}</p>
        </div>
        <button onClick={onClaim} disabled={!canClaim} className="btn-primary disabled:opacity-40" aria-label={canClaim ? t('rw.claim') : t('rw.dailyBack')}>
          {canClaim ? t('rw.claim') : <Icon name="check" className="h-5 w-5" />}
        </button>
      </section>

      {/* compact achievements trigger */}
      <AchievementsButton unlockedCount={unlockedAch.length} totalCount={ACHIEVEMENTS.length} unlockedAch={unlockedAch} />

      <AccountCard />
      <SettingsPanel />
    </main>
  );
}

// ---------------------------------------------------------------------------
// Achievements compact trigger + modal
// ---------------------------------------------------------------------------

interface AchievementsButtonProps {
  unlockedCount: number;
  totalCount: number;
  unlockedAch: string[];
}

function AchievementsButton({ unlockedCount, totalCount, unlockedAch }: AchievementsButtonProps) {
  const t = useT();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Compact trigger card */}
      <button
        type="button"
        role="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="mt-5 flex w-full items-center gap-4 rounded-2xl bg-white px-4 py-4 shadow-card transition hover:shadow-md active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grape"
      >
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-sun/15 text-3xl">
          🏅
        </span>
        <div className="min-w-0 flex-1 text-left">
          <p className="font-display text-base font-extrabold leading-snug">
            {t('rw.achievements')}
            <span className="ml-2 rounded-full bg-mint/15 px-2.5 py-0.5 text-xs font-extrabold text-mint-700">
              {unlockedCount}/{totalCount}
            </span>
          </p>
          <p className="mt-0.5 text-sm text-ink-soft">{t('rw.achSub')}</p>
        </div>
        <span className="shrink-0 text-ink-faint" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {/* Modal */}
      <AchievementsModal open={open} onClose={() => setOpen(false)} unlockedAch={unlockedAch} />
    </>
  );
}

interface AchievementsModalProps {
  open: boolean;
  onClose: () => void;
  unlockedAch: string[];
}

function AchievementsModal({ open, onClose, unlockedAch }: AchievementsModalProps) {
  const t = useT();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Escape key listener
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Focus close button when modal opens
  useEffect(() => {
    if (open) {
      // Defer so AnimatePresence finishes mounting
      const id = setTimeout(() => closeButtonRef.current?.focus(), 50);
      return () => clearTimeout(id);
    }
  }, [open]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="ach-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-sm"
          onClick={handleBackdropClick}
          aria-modal="true"
          role="dialog"
          aria-label={t('rw.achievements')}
        >
          <motion.div
            key="ach-panel"
            ref={panelRef}
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
          >
            {/* Sticky header */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-grape-100 bg-grape-50/70 px-5 py-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-2xl" aria-hidden="true">🏅</span>
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-extrabold leading-tight">
                    {t('rw.achievements')}
                  </h2>
                  <p className="text-sm font-bold text-mint-700">
                    {unlockedAch.length}/{ACHIEVEMENTS.length}
                  </p>
                </div>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                aria-label={t('rw.achClose')}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-ink-soft shadow-sm transition hover:bg-grape-50 hover:text-grape focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grape"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <div className="space-y-3 pb-2">
                {ACHIEVEMENT_GROUPS.map((group) => {
                  const items = ACHIEVEMENTS.filter((a) => a.group === group.id);
                  const groupDone = items.filter((a) => unlockedAch.includes(a.code)).length;
                  return (
                    <div key={group.id} className="overflow-hidden rounded-2xl border border-grape-100 bg-white shadow-card">
                      <div className="flex items-center justify-between gap-3 bg-grape-50/70 px-3 py-2.5">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="text-xl">{group.emoji}</span>
                          <div className="min-w-0">
                            <h3 className="truncate font-display text-sm font-extrabold">{t(group.titleKey)}</h3>
                            <p className="truncate text-[11px] font-bold text-ink-faint">{t(group.subtitleKey)}</p>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-extrabold text-mint-700 ring-1 ring-mint/20">
                          {groupDone}/{items.length}
                        </span>
                      </div>
                      <div className="divide-y divide-grape-100/70">
                        {items.map((a) => (
                          <AchievementCard key={a.code} achievement={a} unlocked={unlockedAch.includes(a.code)} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AchievementCard({ achievement, unlocked }: { achievement: Achievement; unlocked: boolean }) {
  const t = useT();
  return (
    <div
      title={t(achievement.descriptionKey)}
      className={`flex items-center gap-2.5 px-3 py-2.5 transition ${
        unlocked ? 'bg-white' : 'bg-cloud/55 grayscale'
      }`}
    >
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xl ring-1 ${unlocked ? `${RARITY_RING[achievement.rarity]} bg-sun/15` : 'bg-white/70 ring-transparent'}`}>
        {achievement.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <p className="truncate font-display text-sm font-extrabold">{t(achievement.titleKey)}</p>
          <span className={`inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${unlocked ? 'bg-mint/15 text-mint-700' : 'bg-ink/10 text-ink-soft'}`}>
            <Icon name={unlocked ? 'check' : 'lock'} className="h-3 w-3" />
            {unlocked ? t('ach.unlockedShort') : t('ach.lockedShort')}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[11px] font-bold text-ink-faint">{t(achievement.hintKey)}</p>
      </div>
    </div>
  );
}

/** Offline player identity — cloud-logged-in users edit their name in AccountCard,
 *  so this only appears when there is no account to sync with. */
function OfflineNameCard() {
  const t = useT();
  const playerName = useGame((s) => s.playerName);
  const setPlayerName = useGame((s) => s.setPlayerName);
  const [draft, setDraft] = useState(playerName);
  const [saved, setSaved] = useState(false);

  if (isCloudEnabled()) return null;

  const save = () => {
    setPlayerName(draft.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <section className="card mt-5 flex items-center gap-3">
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-grape-50 text-grape">
        <Icon name="user" className="h-6 w-6" />
      </span>
      <div className="flex-1">
        <p className="mb-1 text-sm font-bold text-ink-soft">{t('home.name.q')}</p>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder={t('home.name.ph')}
            maxLength={20}
            className="min-w-0 flex-1 rounded-2xl border-2 border-grape-100 bg-white px-4 py-2.5 font-bold outline-none focus:border-grape"
          />
          <button onClick={save} className="btn-primary px-4">{saved ? '✓' : t('home.name.go')}</button>
        </div>
      </div>
    </section>
  );
}

function SettingsPanel() {
  const t = useT();
  const settings = useGame((s) => s.settings);
  const toggle = useGame((s) => s.toggleSetting);
  const [confirm, setConfirm] = useState(false);
  const onReset = () => {
    // accountLogout() resets progress to a guest baseline (resetToGuest), which
    // erases XP/coins/stars while keeping the device's language & accessibility
    // settings — resetting those on an "erase progress" tap would be surprising.
    accountLogout();
    setConfirm(false);
  };

  return (
    <section className="card mt-6">
      <h2 className="font-display text-xl font-extrabold">{t('rw.settings')}</h2>
      <div className="mt-3 space-y-2">
        <Toggle label={t('rw.sound')} on={settings.sound} onClick={() => toggle('sound')} />
        <Toggle label={t('rw.motion')} on={settings.reducedMotion} onClick={() => toggle('reducedMotion')} />
      </div>
      <div className="mt-4 border-t border-cloud pt-4">
        {confirm ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-bubble-600">{t('rw.erase')}</span>
            <button onClick={onReset} className="btn-primary px-3 py-1.5 text-sm">{t('rw.yes')}</button>
            <button onClick={() => setConfirm(false)} className="btn-ghost px-3 py-1.5 text-sm">{t('rw.no')}</button>
          </div>
        ) : (
          <button onClick={() => setConfirm(true)} className="text-sm font-bold text-ink-faint hover:text-bubble-600">{t('rw.reset')}</button>
        )}
      </div>
    </section>
  );
}

function Toggle({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      className="flex w-full items-center justify-between rounded-2xl bg-cloud p-3 font-bold transition hover:bg-grape-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grape"
    >
      <span>{label}</span>
      <span className={`flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors ${on ? 'bg-mint' : 'bg-grape-100'}`}>
        <motion.span layout className={`h-5 w-5 rounded-full bg-white shadow ${on ? 'ml-auto' : ''}`} />
      </span>
    </button>
  );
}

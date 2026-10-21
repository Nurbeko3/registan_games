'use client';

import { useEffect, useState } from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { useGame, useHydrated, selectTotalStars, type ColorScheme } from '@/store/useGame';
import { ACHIEVEMENT_GROUPS, ACHIEVEMENTS, RARITY_RING, type Achievement } from '@/data/achievements';
import { levelState } from '@/lib/leveling';
import { AccountCard } from '@/components/AccountCard';
import { isCloudEnabled } from '@/lib/supabase/client';
import { ACCOUNT_SESSION_EVENT, accountLogout, accountResume, readSession } from '@/lib/supabase/account';
import { Icon } from '@/components/ui/Icon';
import { AvatarBadge } from '@/components/ui/AvatarBadge';
import { ProgressBar } from '@/components/ui/Bits';
import { Modal, PageHeader, PageLoading, Segmented, StatCard, Switch } from '@/components/ui/Primitives';
import { useT } from '@/lib/i18n';
import { DetectiveRankBadge } from '@/components/case/DetectiveRankBadge';
import { StudentRankCard } from '@/components/StudentRankCard';
import { studentRankForLevel } from '@/lib/studentRanks';

export default function RewardsPage() {
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
      <RewardsContent />
    </>
  );
}

function RewardsContent() {
  const t = useT();
  const xp = useGame((s) => s.xp);
  const ls = levelState(xp);
  const rank = studentRankForLevel(ls.level);
  const totalStars = useGame(selectTotalStars);
  const coins = useGame((s) => s.coins);
  const streak = useGame((s) => s.streak);
  const avatarId = useGame((s) => s.avatarId);
  const playerName = useGame((s) => s.playerName);
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
      <main id="main" className="page-pad-bottom mx-auto grid min-h-[calc(100vh-10rem)] max-w-md place-items-center px-4 py-8">
        <div className="w-full">
          <div className="mb-6 text-center">
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand ring-1 ring-inset ring-brand-100">
              <Icon name="user" className="h-6 w-6" />
            </span>
            <h1 className="mt-4 font-display text-2xl font-extrabold tracking-tight text-fg">{t('rw.profile')}</h1>
            <p className="mt-1 text-sm text-fg-soft">{t('auth.loginSub')}</p>
          </div>
          <AccountCard />
        </div>
      </main>
    );
  }

  return (
    <main id="main" className="page-pad-bottom mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow={t('nav.profile')}
        title={
          <span className="flex items-center gap-3">
            <AvatarBadge avatar={avatarId} className="h-11 w-11 text-2xl" rounded="rounded-xl" bg="bg-brand-50" />
            <span className="min-w-0 truncate">{playerName || t('rw.profile')}</span>
          </span>
        }
        description={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{t(rank.titleKey)}</span>
            <span aria-hidden>·</span>
            <span>{t('common.level')} {ls.level}</span>
            <span aria-hidden>·</span>
            <span className="tabular-nums">{ls.xpIntoLevel}/{ls.xpForNextLevel} XP</span>
          </span>
        }
        actions={
          <div className="w-full sm:w-56">
            <ProgressBar pct={ls.progressPct} />
            <p className="mt-1.5 text-right text-xs font-semibold text-fg-faint">
              {t('common.lv')} {ls.level + 1} · {ls.xpForNextLevel - ls.xpIntoLevel} XP
            </p>
          </div>
        }
      />

      {/* KPI row */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label={t('rw.level')} value={ls.level} icon="zap" tone="brand" />
        <StatCard label={t('rw.stars')} value={totalStars} icon="star" tone="amber" />
        <StatCard label={t('rw.coins')} value={coins} icon="coin" tone="amber" />
        <StatCard label={t('common.dayStreak')} value={streak} icon="flame" tone="warning" />
      </section>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {/* ── left column ── */}
        <div className="min-w-0 space-y-5">
          <StudentRankCard level={ls.level} />

          {/* daily reward */}
          <section className="card flex items-center gap-4">
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${canClaim ? 'bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100' : 'bg-surface-2 text-fg-faint'}`}>
              <Icon name="gift" className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-extrabold text-fg">{t('rw.daily')}</p>
              <p className="text-xs text-fg-soft">{canClaim ? t('rw.dailyClaim') : claimMsg ?? t('rw.dailyBack')}</p>
            </div>
            <button
              onClick={onClaim}
              disabled={!canClaim}
              className={canClaim ? 'btn-primary shrink-0' : 'btn-secondary shrink-0'}
              aria-label={canClaim ? t('rw.claim') : t('rw.dailyBack')}
            >
              {canClaim ? t('rw.claim') : <Icon name="check" className="h-4 w-4 text-success-600" />}
            </button>
          </section>

          <AchievementsButton unlockedCount={unlockedAch.length} totalCount={ACHIEVEMENTS.length} unlockedAch={unlockedAch} />

          {/* Detective rank progress card */}
          <section aria-label={t('case.rankLabel')}>
            <p className="eyebrow mb-2 px-1">{t('case.rankLabel')}</p>
            <DetectiveRankBadge variant="full" />
          </section>
        </div>

        {/* ── right column ── */}
        <div className="min-w-0 space-y-5">
          <OfflineNameCard />
          <AccountCard />
          <SettingsPanel />
        </div>
      </div>
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
  const pct = totalCount ? Math.round((unlockedCount / totalCount) * 100) : 0;

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="card card-hover flex w-full items-center gap-4 text-left focus-visible:ring-2 focus-visible:ring-brand"
      >
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100">
          <Icon name="trophy" className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="font-display text-sm font-extrabold text-fg">{t('rw.achievements')}</p>
            <span className="badge-success">{unlockedCount}/{totalCount}</span>
          </div>
          <p className="mt-0.5 text-xs text-fg-soft">{t('rw.achSub')}</p>
          <ProgressBar pct={pct} className="mt-2 bg-amber-500" size="h-1.5" />
        </div>
        <Icon name="chevronRight" className="h-5 w-5 shrink-0 text-fg-faint" />
      </button>

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

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={t('rw.achievements')}
      description={`${unlockedAch.length}/${ACHIEVEMENTS.length} · ${t('rw.achSub')}`}
    >
      <div className="space-y-4">
        {ACHIEVEMENT_GROUPS.map((group) => {
          const items = ACHIEVEMENTS.filter((a) => a.group === group.id);
          const groupDone = items.filter((a) => unlockedAch.includes(a.code)).length;
          return (
            <section key={group.id} className="overflow-hidden rounded-xl border border-border">
              <div className="flex items-center justify-between gap-3 bg-surface-2 px-3.5 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-surface text-base leading-none ring-1 ring-inset ring-border" aria-hidden>
                    {group.emoji}
                  </span>
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-bold text-fg">{t(group.titleKey)}</h3>
                    <p className="truncate text-xs text-fg-faint">{t(group.subtitleKey)}</p>
                  </div>
                </div>
                <span className={groupDone === items.length ? 'badge-success' : 'badge-neutral'}>
                  {groupDone}/{items.length}
                </span>
              </div>
              <div className="divide-y divide-border">
                {items.map((a) => (
                  <AchievementCard key={a.code} achievement={a} unlocked={unlockedAch.includes(a.code)} />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </Modal>
  );
}

function AchievementCard({ achievement, unlocked }: { achievement: Achievement; unlocked: boolean }) {
  const t = useT();
  return (
    <div
      title={t(achievement.descriptionKey)}
      className={`flex items-center gap-3 px-3.5 py-2.5 ${unlocked ? 'bg-surface' : 'bg-surface-2/60'}`}
    >
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xl leading-none ring-1 ring-inset ${
          unlocked ? `${RARITY_RING[achievement.rarity]} bg-amber-50` : 'bg-surface-3 ring-transparent grayscale opacity-60'
        }`}
        aria-hidden
      >
        {achievement.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <p className={`truncate text-sm font-bold ${unlocked ? 'text-fg' : 'text-fg-soft'}`}>{t(achievement.titleKey)}</p>
          <span className={unlocked ? 'badge-success shrink-0' : 'badge-neutral shrink-0'}>
            <Icon name={unlocked ? 'check' : 'lock'} className="h-3 w-3" />
            {unlocked ? t('ach.unlockedShort') : t('ach.lockedShort')}
          </span>
        </div>
        <p className="mt-0.5 truncate text-xs text-fg-faint">{t(achievement.hintKey)}</p>
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
    <section className="card">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand ring-1 ring-inset ring-brand-100">
          <Icon name="user" className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-sm font-extrabold text-fg">{t('nav.profile')}</h2>
          <p className="text-xs text-fg-soft">{t('home.name.q')}</p>
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          placeholder={t('home.name.ph')}
          aria-label={t('home.name.q')}
          maxLength={20}
          className="input min-w-0 flex-1"
        />
        <button onClick={save} className="btn-primary shrink-0">
          {saved ? <Icon name="check" className="h-4 w-4" /> : t('home.name.go')}
        </button>
      </div>
    </section>
  );
}

function SettingsPanel() {
  const t = useT();
  const settings = useGame((s) => s.settings);
  const toggle = useGame((s) => s.toggleSetting);
  const setColorScheme = useGame((s) => s.setColorScheme);
  const scheme: ColorScheme = settings.colorScheme ?? 'system';
  const [confirm, setConfirm] = useState(false);
  const onReset = () => {
    // accountLogout() resets progress to a guest baseline (resetToGuest), which
    // erases XP/coins/stars while keeping the device's language & accessibility
    // settings — resetting those on an "erase progress" tap would be surprising.
    accountLogout();
    setConfirm(false);
  };

  return (
    <section className="card !p-0">
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface-2 text-fg-soft">
          <Icon name="settings" className="h-5 w-5" />
        </span>
        <h2 className="font-display text-base font-extrabold text-fg">{t('rw.settings')}</h2>
      </div>

      <div className="p-2">
        {/* appearance */}
        <div className="rounded-xl px-3 py-2.5">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-fg-soft">
              <Icon name={scheme === 'dark' ? 'moon' : scheme === 'light' ? 'sunIcon' : 'monitor'} className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-fg">{t('rw.appearance')}</span>
              <span className="block text-xs text-fg-faint">{t('rw.appearanceSub')}</span>
            </span>
          </div>
          <Segmented<ColorScheme>
            className="mt-2.5 w-full sm:ml-12 sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-none"
            ariaLabel={t('rw.appearance')}
            value={scheme}
            onChange={setColorScheme}
            options={[
              { value: 'system', label: t('rw.theme.system'), icon: 'monitor' },
              { value: 'light', label: t('rw.theme.light'), icon: 'sunIcon' },
              { value: 'dark', label: t('rw.theme.dark'), icon: 'moon' },
            ]}
          />
        </div>
        <Switch
          icon="volume"
          label={t('rw.sound')}
          description={t('rw.soundSub')}
          checked={settings.sound}
          onChange={() => toggle('sound')}
        />
        <Switch
          icon="activity"
          label={t('rw.motion')}
          description={t('rw.motionSub')}
          checked={settings.reducedMotion}
          onChange={() => toggle('reducedMotion')}
        />
      </div>

      <div className="border-t border-border px-5 py-4">
        <p className="eyebrow text-danger-600">{t('rw.danger')}</p>
        {confirm ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="mr-auto text-sm font-semibold text-fg">{t('rw.erase')}</span>
            <button onClick={onReset} className="btn-danger btn-sm">{t('rw.yes')}</button>
            <button onClick={() => setConfirm(false)} className="btn-secondary btn-sm">{t('rw.no')}</button>
          </div>
        ) : (
          <button onClick={() => setConfirm(true)} className="btn-danger-soft btn-sm mt-2">
            <Icon name="trash" className="h-3.5 w-3.5" />
            {t('rw.reset')}
          </button>
        )}
      </div>
    </section>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TopBar } from '@/components/layout/TopBar';
import { useGame, useHydrated, selectTotalStars } from '@/store/useGame';
import { ACHIEVEMENT_GROUPS, ACHIEVEMENTS, RARITY_RING, type Achievement } from '@/data/achievements';
import { AVATARS, THEMES } from '@/data/cosmetics';
import { levelForXp, levelState } from '@/lib/leveling';
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
    <main id="main" className="mx-auto max-w-3xl px-4 py-6">
      {/* header stats */}
      <section className="card bg-gradient-to-br from-grape to-grape-600 text-center text-white">
        <h1 className="font-display text-2xl font-extrabold">{t('rw.profile')}</h1>
        <div className="mt-3 flex justify-center gap-6 font-display font-extrabold">
          <div><div className="text-3xl">{ls.level}</div><div className="text-sm text-white/80">{t('rw.level')}</div></div>
          <div><div className="flex items-center justify-center gap-1 text-3xl">{totalStars}<Icon name="star" className="h-7 w-7 text-sun" /></div><div className="text-sm text-white/80">{t('rw.stars')}</div></div>
          <div><div className="flex items-center justify-center gap-1 text-3xl">{coins}<Icon name="coin" className="h-7 w-7 text-sun" /></div><div className="text-sm text-white/80">{t('rw.coins')}</div></div>
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
        <button onClick={onClaim} disabled={!canClaim} className="btn-primary disabled:opacity-40">{canClaim ? t('rw.claim') : '✓'}</button>
      </section>

      {/* achievements */}
      <section className="mt-6">
        <h2 className="font-display text-xl font-extrabold">{t('rw.achievements')} ({unlockedAch.length}/{ACHIEVEMENTS.length})</h2>

        <div className="mt-3 space-y-3">
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
      </section>

      <AccountCard />
      <AvatarShop />
      <ThemeShop />
      <SettingsPanel />
    </main>
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
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${unlocked ? 'bg-mint/15 text-mint-700' : 'bg-ink/10 text-ink-soft'}`}>
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

function AvatarShop() {
  const t = useT();
  const avatarId = useGame((s) => s.avatarId);
  const unlocked = useGame((s) => s.unlockedAvatars);
  const coins = useGame((s) => s.coins);
  const xp = useGame((s) => s.xp);
  const buy = useGame((s) => s.buyAvatar);
  const select = useGame((s) => s.selectAvatar);
  const level = levelForXp(xp);

  return (
    <section className="mt-6">
      <h2 className="font-display text-xl font-extrabold">{t('rw.characters')}</h2>
      <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
        {AVATARS.map((a) => {
          const owned = unlocked.includes(a.id);
          const active = avatarId === a.id;
          const lockedByLevel = a.unlockLevel ? level < a.unlockLevel : false;
          return (
            <motion.button
              key={a.id}
              whileTap={{ scale: 0.95 }}
              onClick={() => (owned ? select(a.id) : buy(a.id))}
              disabled={!owned && (lockedByLevel || coins < a.cost)}
              className={`grid place-items-center rounded-2xl p-3 text-center shadow-card transition ${active ? 'bg-grape text-white ring-2 ring-grape' : 'bg-white'} ${!owned && (lockedByLevel || coins < a.cost) ? 'opacity-50' : ''}`}
            >
              <span className="text-3xl">{a.emoji}</span>
              <span className="mt-1 text-xs font-bold leading-tight">{a.name}</span>
              <span className="mt-0.5 text-[11px] font-bold">
                {active ? t('rw.wearing') : owned ? t('rw.tapWear') : lockedByLevel ? `${t('common.lv')} ${a.unlockLevel}` : (
                  <span className="inline-flex items-center gap-1"><Icon name="coin" className="h-3 w-3" /> {a.cost}</span>
                )}
              </span>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}

function ThemeShop() {
  const t = useT();
  const themeId = useGame((s) => s.themeId);
  const unlocked = useGame((s) => s.unlockedThemes);
  const coins = useGame((s) => s.coins);
  const buy = useGame((s) => s.buyTheme);
  const select = useGame((s) => s.selectTheme);

  return (
    <section className="mt-6">
      <h2 className="font-display text-xl font-extrabold">{t('rw.themes')}</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {THEMES.map((th) => {
          const owned = unlocked.includes(th.id);
          const active = themeId === th.id;
          return (
            <button
              key={th.id}
              onClick={() => (owned ? select(th.id) : buy(th.id))}
              disabled={!owned && coins < th.cost}
              className={`rounded-2xl p-4 text-center shadow-card transition ${active ? 'ring-2 ring-grape' : ''} ${th.bg} ${!owned && coins < th.cost ? 'opacity-50' : ''}`}
            >
              <div className="text-3xl">{th.emoji}</div>
              <p className="mt-1 text-sm font-bold">{th.name}</p>
              <p className="text-[11px] font-bold">{active ? t('rw.active') : owned ? t('rw.use') : <span className="inline-flex items-center gap-1"><Icon name="coin" className="h-3 w-3" /> {th.cost}</span>}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SettingsPanel() {
  const t = useT();
  const settings = useGame((s) => s.settings);
  const toggle = useGame((s) => s.toggleSetting);
  const reset = useGame((s) => s.resetProgress);
  const [confirm, setConfirm] = useState(false);
  const onReset = () => {
    accountLogout();
    reset();
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
    <button onClick={onClick} className="flex w-full items-center justify-between rounded-2xl bg-cloud p-3 font-bold">
      <span>{label}</span>
      <span className={`flex h-7 w-12 items-center rounded-full p-1 transition ${on ? 'bg-mint' : 'bg-grape-100'}`}>
        <motion.span layout className={`h-5 w-5 rounded-full bg-white shadow ${on ? 'ml-auto' : ''}`} />
      </span>
    </button>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { TopBar } from '@/components/layout/TopBar';
import { useGame, useHydrated, selectTotalStars } from '@/store/useGame';
import { ACHIEVEMENTS, RARITY_RING } from '@/data/achievements';
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
        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {ACHIEVEMENTS.map((a) => {
            const got = unlockedAch.includes(a.code);
            return (
              <div key={a.code} title={a.description}
                className={`grid place-items-center rounded-2xl p-3 text-center ring-2 ${got ? `bg-white ${RARITY_RING[a.rarity]}` : 'bg-cloud opacity-50 grayscale ring-transparent'}`}>
                <span className="text-3xl">{a.emoji}</span>
                <span className="mt-1 text-xs font-bold leading-tight">{a.title}</span>
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

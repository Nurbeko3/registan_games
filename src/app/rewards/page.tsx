'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { TopBar } from '@/components/layout/TopBar';
import { useGame, useHydrated, selectTotalStars } from '@/store/useGame';
import { ACHIEVEMENTS, RARITY_RING } from '@/data/achievements';
import { AVATARS, THEMES } from '@/data/cosmetics';
import { levelForXp, levelState } from '@/lib/leveling';
import { CloudSaveCard } from '@/components/CloudSaveCard';

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
  const xp = useGame((s) => s.xp);
  const ls = levelState(xp);
  const totalStars = useGame(selectTotalStars);
  const coins = useGame((s) => s.coins);
  const unlockedAch = useGame((s) => s.unlockedAchievements);
  const claimDaily = useGame((s) => s.claimDaily);
  const lastDailyClaim = useGame((s) => s.lastDailyClaim);
  const [claimMsg, setClaimMsg] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const canClaim = lastDailyClaim !== today;

  const onClaim = () => {
    const r = claimDaily();
    if (r) setClaimMsg(`+${r.coins} 💰 and +${r.xp} ⚡!`);
  };

  return (
    <main id="main" className="mx-auto max-w-3xl px-4 py-6">
      {/* header stats */}
      <section className="card bg-gradient-to-br from-grape to-grape-600 text-center text-white">
        <h1 className="font-display text-2xl font-extrabold">Your Hero Profile</h1>
        <div className="mt-3 flex justify-center gap-6 font-display font-extrabold">
          <div><div className="text-3xl">{ls.level}</div><div className="text-sm text-white/80">Level</div></div>
          <div><div className="text-3xl">{totalStars}⭐</div><div className="text-sm text-white/80">Stars</div></div>
          <div><div className="text-3xl">{coins}💰</div><div className="text-sm text-white/80">Coins</div></div>
        </div>
      </section>

      {/* daily reward */}
      <section className="card mt-5 flex items-center gap-4">
        <div className="text-4xl">🎁</div>
        <div className="flex-1">
          <p className="font-display font-extrabold">Daily Reward</p>
          <p className="text-sm text-ink-soft">{canClaim ? 'Claim your gift for playing today!' : claimMsg ?? 'Come back tomorrow for more!'}</p>
        </div>
        <button onClick={onClaim} disabled={!canClaim} className="btn-primary disabled:opacity-40">{canClaim ? 'Claim' : '✓'}</button>
      </section>

      {/* achievements */}
      <section className="mt-6">
        <h2 className="font-display text-xl font-extrabold">🏅 Achievements ({unlockedAch.length}/{ACHIEVEMENTS.length})</h2>
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

      <CloudSaveCard />
      <AvatarShop />
      <ThemeShop />
      <SettingsPanel />
    </main>
  );
}

function AvatarShop() {
  const avatarId = useGame((s) => s.avatarId);
  const unlocked = useGame((s) => s.unlockedAvatars);
  const coins = useGame((s) => s.coins);
  const xp = useGame((s) => s.xp);
  const buy = useGame((s) => s.buyAvatar);
  const select = useGame((s) => s.selectAvatar);
  const level = levelForXp(xp);

  return (
    <section className="mt-6">
      <h2 className="font-display text-xl font-extrabold">🧑‍🚀 Characters</h2>
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
                {active ? 'Wearing' : owned ? 'Tap to wear' : lockedByLevel ? `Lv ${a.unlockLevel}` : `💰 ${a.cost}`}
              </span>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}

function ThemeShop() {
  const themeId = useGame((s) => s.themeId);
  const unlocked = useGame((s) => s.unlockedThemes);
  const coins = useGame((s) => s.coins);
  const buy = useGame((s) => s.buyTheme);
  const select = useGame((s) => s.selectTheme);

  return (
    <section className="mt-6">
      <h2 className="font-display text-xl font-extrabold">🎨 Themes</h2>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {THEMES.map((t) => {
          const owned = unlocked.includes(t.id);
          const active = themeId === t.id;
          return (
            <button
              key={t.id}
              onClick={() => (owned ? select(t.id) : buy(t.id))}
              disabled={!owned && coins < t.cost}
              className={`rounded-2xl p-4 text-center shadow-card transition ${active ? 'ring-2 ring-grape' : ''} ${t.bg} ${!owned && coins < t.cost ? 'opacity-50' : ''}`}
            >
              <div className="text-3xl">{t.emoji}</div>
              <p className="mt-1 text-sm font-bold">{t.name}</p>
              <p className="text-[11px] font-bold">{active ? 'Active' : owned ? 'Use' : `💰 ${t.cost}`}</p>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function SettingsPanel() {
  const settings = useGame((s) => s.settings);
  const toggle = useGame((s) => s.toggleSetting);
  const reset = useGame((s) => s.resetProgress);
  const [confirm, setConfirm] = useState(false);

  return (
    <section className="card mt-6">
      <h2 className="font-display text-xl font-extrabold">⚙️ Settings</h2>
      <div className="mt-3 space-y-2">
        <Toggle label="🔔 Sound effects" on={settings.sound} onClick={() => toggle('sound')} />
        <Toggle label="🌙 Reduce motion" on={settings.reducedMotion} onClick={() => toggle('reducedMotion')} />
      </div>
      <div className="mt-4 border-t border-cloud pt-4">
        {confirm ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-bubble-600">Erase all progress?</span>
            <button onClick={() => { reset(); setConfirm(false); }} className="btn-primary px-3 py-1.5 text-sm">Yes</button>
            <button onClick={() => setConfirm(false)} className="btn-ghost px-3 py-1.5 text-sm">No</button>
          </div>
        ) : (
          <button onClick={() => setConfirm(true)} className="text-sm font-bold text-ink-faint hover:text-bubble-600">Reset progress</button>
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

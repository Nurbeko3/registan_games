'use client';

import Link from 'next/link';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Icon } from '@/components/ui/Icon';
import { Stars } from '@/components/ui/Bits';
import { Confetti } from '@/components/ui/Confetti';
import { GuestRewardNudge } from '@/components/ui/GuestRewardNudge';
import { useT } from '@/lib/i18n';
import { useMustLogIn } from '@/lib/supabase/useAccount';
import type { CompleteResult } from '@/store/useGame';

interface WinFeedback {
  kind: 'win';
  result: CompleteResult;
}
interface RetryFeedback {
  kind: 'retry';
  /** Friendly reason key, e.g. cc.retry.notReached / cc.retry.lost. */
  reasonKey: string;
}
export type FeedbackPayload = WinFeedback | RetryFeedback;

interface FeedbackModalProps {
  feedback: FeedbackPayload | null;
  onReplay: () => void;
  onClose: () => void;
  nextLevelId?: string;
}

/**
 * Win celebration (stars fill + XP/coins + level-up + achievements, "Next
 * level"/"Replay") or a gentle retry prompt on loss. Reuses the platform's
 * `Confetti` + `Stars` so it matches `GameShell`'s win modal language.
 */
export function FeedbackModal({ feedback, onReplay, onClose, nextLevelId }: FeedbackModalProps) {
  const t = useT();
  const shouldReduceMotion = useReducedMotion();
  const mustLogIn = useMustLogIn();

  return (
    <AnimatePresence>
      {feedback && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-fg/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          role="dialog"
          aria-modal="true"
          aria-label={feedback.kind === 'win' ? t('cc.win') : t('cc.retry')}
          onClick={feedback.kind === 'win' ? onReplay : onClose}
        >
          {feedback.kind === 'win' && feedback.result.stars >= 1 && <Confetti />}

          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-sm rounded-t-2xl bg-surface p-6 text-center shadow-xl ring-1 ring-border sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {feedback.kind === 'win' ? (
              <WinCard result={feedback.result} onReplay={onReplay} nextLevelId={nextLevelId} mustLogIn={mustLogIn} />
            ) : (
              <RetryCard reasonKey={feedback.reasonKey} onReplay={onReplay} onClose={onClose} />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function WinCard({ result, onReplay, nextLevelId, mustLogIn }: { result: CompleteResult; onReplay: () => void; nextLevelId?: string; mustLogIn: boolean }) {
  const t = useT();
  return (
    <>
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-success-50 text-success-600">
        <Icon name="trophy" className="h-6 w-6" />
      </span>
      <p className="eyebrow mt-4 text-brand">
        {result.stars >= 3 ? t('cc.win.perfect') : result.stars >= 1 ? t('cc.win.cleared') : t('cc.win.reached')}
      </p>
      <div className="mt-2 flex justify-center"><Stars count={result.stars} size="text-4xl" /></div>

      {mustLogIn ? (
        <GuestRewardNudge className="mt-4" />
      ) : (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {result.xpAwarded > 0 && (
            <span className="chip bg-brand-50 text-brand-700"><Icon name="zap" className="h-3.5 w-3.5" /> +{result.xpAwarded} XP</span>
          )}
          {result.coinsAwarded > 0 && (
            <span className="chip bg-amber-50 text-amber-700"><Icon name="coin" className="h-3.5 w-3.5" /> +{result.coinsAwarded}</span>
          )}
        </div>
      )}

      {result.dailyBonus && (
        <p className="mt-3 inline-flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">
          <Icon name="gift" className="h-4 w-4" />
          {t('daily.completedToast', { xp: result.dailyBonus.xp, coins: result.dailyBonus.coins })}
        </p>
      )}

      {result.leveledUp && (
        <motion.p
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mt-3 font-display text-base font-extrabold text-brand"
        >
          {t('gs.levelUp', { n: result.newLevel })}
        </motion.p>
      )}
      {result.newAchievements.length > 0 && (
        <p className="mt-2 text-sm font-semibold text-amber-700">
          {result.newAchievements.map((a) => a.title).join(', ')}
        </p>
      )}

      <div className="mt-6 grid gap-2">
        {nextLevelId ? (
          <Link href={`/quest/${nextLevelId}`} className="btn-primary w-full">
            {t('cc.next')} <Icon name="arrowRight" className="h-4 w-4" />
          </Link>
        ) : null}
        <div className="flex gap-2">
          <button type="button" autoFocus onClick={onReplay} className="btn-secondary flex-1">
            <Icon name="refresh" className="h-4 w-4" /> {t('cc.replay')}
          </button>
          <Link href="/quest" className="btn-secondary flex-1">
            <Icon name="map" className="h-4 w-4" /> {t('cc.questMap')}
          </Link>
        </div>
      </div>
    </>
  );
}

function RetryCard({ reasonKey, onReplay, onClose }: { reasonKey: string; onReplay: () => void; onClose: () => void }) {
  const t = useT();
  return (
    <>
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-brand">
        <Icon name="compass" className="h-6 w-6" />
      </span>
      <p className="mt-4 font-display text-lg font-extrabold text-fg">{t('cc.retry.title')}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-fg-soft">{t(reasonKey)}</p>

      <div className="mt-6 grid gap-2">
        <button type="button" autoFocus onClick={onReplay} className="btn-primary w-full">
          {t('cc.tryAgain')}
        </button>
        <button type="button" onClick={onClose} className="btn-secondary w-full">
          {t('cc.keepEditing')}
        </button>
      </div>
    </>
  );
}

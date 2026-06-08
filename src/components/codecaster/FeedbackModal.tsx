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
          className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-5 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label={feedback.kind === 'win' ? t('cc.win') : t('cc.retry')}
          onClick={feedback.kind === 'win' ? onReplay : onClose}
        >
          {feedback.kind === 'win' && feedback.result.stars >= 1 && <Confetti />}

          <motion.div
            initial={shouldReduceMotion ? false : { scale: 0.7, y: 30 }}
            animate={shouldReduceMotion ? {} : { scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 240, damping: 18 }}
            className="card w-full max-w-sm text-center"
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
      <p className="font-display text-sm font-bold uppercase tracking-wide text-grape">
        {result.stars >= 3 ? t('cc.win.perfect') : result.stars >= 1 ? t('cc.win.cleared') : t('cc.win.reached')}
      </p>
      <div className="mt-3 flex justify-center"><Stars count={result.stars} size="text-4xl" /></div>

      {mustLogIn ? (
        <GuestRewardNudge className="mt-4" />
      ) : (
        <div className="mt-4 flex flex-wrap justify-center gap-3">
          {result.xpAwarded > 0 && (
            <span className="chip bg-sun/30 text-ink"><Icon name="zap" className="h-4 w-4" /> +{result.xpAwarded} XP</span>
          )}
          {result.coinsAwarded > 0 && (
            <span className="chip bg-mango/20 text-ink"><Icon name="coin" className="h-4 w-4" /> +{result.coinsAwarded}</span>
          )}
        </div>
      )}

      {result.leveledUp && (
        <motion.p
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="mt-3 font-display text-lg font-extrabold text-bubble-600"
        >
          {t('gs.levelUp', { n: result.newLevel })}
        </motion.p>
      )}
      {result.newAchievements.length > 0 && (
        <p className="mt-2 font-bold text-mango">
          {result.newAchievements.map((a) => a.title).join(', ')}
        </p>
      )}

      <div className="mt-5 grid gap-2">
        <button autoFocus onClick={onReplay} className="btn-ghost w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grape focus-visible:ring-offset-2">
          {t('cc.replay')}
        </button>
        <div className="flex gap-2">
          <Link href="/quest" className="btn-ghost flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grape focus-visible:ring-offset-2">
            <Icon name="map" className="mr-1.5 inline h-4 w-4" /> {t('cc.questMap')}
          </Link>
          {nextLevelId && (
            <Link href={`/quest/${nextLevelId}`} className="btn-sun flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sun focus-visible:ring-offset-2">
              {t('cc.next')}
            </Link>
          )}
        </div>
      </div>
    </>
  );
}

function RetryCard({ reasonKey, onReplay, onClose }: { reasonKey: string; onReplay: () => void; onClose: () => void }) {
  const t = useT();
  return (
    <>
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-grape-50 text-grape">
        <Icon name="compass" className="h-7 w-7" />
      </span>
      <p className="mt-3 font-display text-lg font-extrabold text-ink">{t('cc.retry.title')}</p>
      <p className="mt-1.5 text-sm font-bold leading-relaxed text-ink-soft">{t(reasonKey)}</p>

      <div className="mt-5 grid gap-2">
        <button autoFocus onClick={onReplay} className="btn-primary w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grape focus-visible:ring-offset-2">
          {t('cc.tryAgain')}
        </button>
        <button onClick={onClose} className="btn-ghost w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grape focus-visible:ring-offset-2">
          {t('cc.keepEditing')}
        </button>
      </div>
    </>
  );
}

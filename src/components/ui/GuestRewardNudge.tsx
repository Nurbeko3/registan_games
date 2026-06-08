'use client';

import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/lib/i18n';

/**
 * Friendly inline nudge shown on win/result screens in cloud-guest mode
 * (Supabase configured but no student profile logged in) — explains why the
 * "+coins/+XP" chips read 0 and points the player to where login happens.
 *
 * Mirrors the look of the shop's login-required banner (`shop.loginBannerTitle`
 * / `shop.loginRequired`) so the app stays visually consistent.
 */
export function GuestRewardNudge({ className = '' }: { className?: string }) {
  const t = useT();
  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border-2 border-mint/40 bg-mint/10 p-3 text-left ${className}`}
      role="status"
    >
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-mint/20 text-mint-700">
        <Icon name="lock" className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm font-extrabold text-ink">{t('guest.winTitle')}</p>
        <p className="mt-0.5 text-xs font-bold leading-relaxed text-ink-soft">{t('guest.winNudge')}</p>
      </div>
      <Link href="/rewards" className="btn-primary shrink-0 self-center px-3 py-1.5 text-xs">
        {t('guest.cta')}
      </Link>
    </div>
  );
}

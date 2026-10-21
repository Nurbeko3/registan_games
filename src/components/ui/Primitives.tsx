'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Icon, type IconName } from './Icon';
import { playSfx } from '@/lib/sound';

/* ────────────────────────────────────────────────────────────────────────────
   Shared layout + state primitives for the KidsCode design system.
   Keep these presentational: no store access, no data fetching.
   ──────────────────────────────────────────────────────────────────────────── */

/** Standard page header — eyebrow · title · description · actions (right). */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  icon,
  className = '',
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: IconName;
  className?: string;
}) {
  return (
    <header className={`flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between ${className}`}>
      <div className="flex min-w-0 items-start gap-3.5">
        {icon && (
          <span className="mt-0.5 grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand ring-1 ring-inset ring-brand-100">
            <Icon name={icon} className="h-5 w-5" />
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-fg sm:text-[1.75rem] sm:leading-tight">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-fg-soft sm:text-[0.9375rem]">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Section heading row with optional trailing link/action. */
export function SectionHeader({
  title,
  description,
  action,
  className = '',
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-end justify-between gap-4 ${className}`}>
      <div className="min-w-0">
        <h2 className="h-section">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-fg-soft">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Inline "see all →" style link used next to section headers. */
export function TextLink({ href, children, className = '' }: { href: string; children: ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-1 rounded-md py-1 font-display text-sm font-bold text-brand transition hover:text-brand-700 ${className}`}
    >
      {children}
      <Icon name="chevronRight" className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/** KPI / statistic tile. */
export function StatCard({
  label,
  value,
  icon,
  hint,
  tone = 'neutral',
  className = '',
}: {
  label: ReactNode;
  value: ReactNode;
  icon?: IconName;
  hint?: ReactNode;
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'amber' | 'danger';
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-surface-2 text-fg-soft',
    brand: 'bg-brand-50 text-brand',
    success: 'bg-success-50 text-success-600',
    warning: 'bg-warning-50 text-warning-600',
    amber: 'bg-amber-50 text-amber-600',
    danger: 'bg-danger-50 text-danger-600',
  };
  return (
    <div className={`card flex items-start gap-3.5 !p-4 ${className}`}>
      {icon && (
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${tones[tone]}`}>
          <Icon name={icon} className="h-5 w-5" />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-xs font-semibold leading-tight text-fg-faint">{label}</p>
        <p className="mt-0.5 font-display text-2xl font-extrabold leading-none tabular-nums tracking-tight text-fg">{value}</p>
        {hint && <p className="mt-1 text-xs text-fg-faint">{hint}</p>}
      </div>
    </div>
  );
}

/** Empty / error state block. */
export function EmptyState({
  icon = 'info',
  title,
  description,
  action,
  tone = 'neutral',
  className = '',
}: {
  icon?: IconName;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  tone?: 'neutral' | 'brand' | 'danger' | 'success';
  className?: string;
}) {
  const tones = {
    neutral: 'bg-surface-2 text-fg-faint',
    brand: 'bg-brand-50 text-brand',
    danger: 'bg-danger-50 text-danger',
    success: 'bg-success-50 text-success-600',
  };
  return (
    <div className={`card flex flex-col items-center px-6 py-10 text-center ${className}`}>
      <span className={`grid h-12 w-12 place-items-center rounded-xl ${tones[tone]}`}>
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <p className="mt-4 font-display text-base font-extrabold text-fg">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-fg-soft">{description}</p>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/** Loading skeleton bar. */
export function Skeleton({ className = 'h-4 w-full' }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

/** Centered spinner for hydration / fetch gates. */
export function Spinner({ className = 'h-6 w-6', label }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label ?? 'Loading'} className="inline-grid place-items-center">
      <span className={`${className} animate-spin rounded-full border-2 border-border border-t-brand`} />
    </span>
  );
}

/** Full-area loading placeholder used while the store hydrates. */
export function PageLoading() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <Spinner className="h-7 w-7" />
    </div>
  );
}

/** Accessible switch. */
export function Switch({
  checked,
  onChange,
  label,
  description,
  icon,
  className = '',
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  icon?: IconName;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => { playSfx('toggle'); onChange(!checked); }}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-surface-2 ${className}`}
    >
      {icon && (
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-fg-soft">
          <Icon name={icon} className="h-4.5 w-4.5 h-[18px] w-[18px]" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-fg">{label}</span>
        {description && <span className="block text-xs text-fg-faint">{description}</span>}
      </span>
      <span
        className={`relative inline-flex h-6 w-10 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 ${
          checked ? 'bg-brand' : 'bg-border-strong'
        }`}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 500, damping: 32 }}
          className={`h-5 w-5 rounded-full bg-white shadow-sm ${checked ? 'ml-auto' : ''}`}
        />
      </span>
    </button>
  );
}

/** Segmented option group (small, for 2–4 choices such as the colour scheme). */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className = '',
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; icon?: IconName }[];
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={`inline-flex rounded-lg bg-surface-3 p-0.5 ${className}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => { if (!active) playSfx('toggle'); onChange(o.value); }}
            className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-md px-3 text-xs font-bold transition ${
              active ? 'bg-surface text-fg shadow-xs' : 'text-fg-soft hover:text-fg'
            }`}
          >
            {o.icon && <Icon name={o.icon} className="h-3.5 w-3.5" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Modal dialog: focus trap-lite (focuses the panel, Escape closes, backdrop
 * click closes), body scroll lock, reduced-motion aware.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  ariaLabel,
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  ariaLabel?: string;
}) {
  const reduce = useReducedMotion();
  const panelRef = useRef<HTMLDivElement>(null);
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const id = setTimeout(() => panelRef.current?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      clearTimeout(id);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-fg/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel ?? (typeof title === 'string' ? title : undefined)}
            initial={reduce ? false : { opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-surface shadow-xl ring-1 ring-border outline-none sm:rounded-2xl ${sizes[size]}`}
          >
            {(title || description) && (
              <div className="flex items-start gap-3 border-b border-border px-5 py-4">
                <div className="min-w-0 flex-1">
                  {title && <h2 className="font-display text-lg font-extrabold leading-tight text-fg">{title}</h2>}
                  {description && <p className="mt-0.5 text-sm text-fg-soft">{description}</p>}
                </div>
                <button type="button" onClick={onClose} aria-label="Close" className="btn-subtle btn-icon -mr-2 -mt-1 h-9 w-9 min-h-0 rounded-lg">
                  <Icon name="x" className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                </button>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3.5">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Toast-like status message (inline or fixed by the caller). */
export function Notice({
  tone = 'neutral',
  icon,
  children,
  className = '',
  action,
}: {
  tone?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger';
  icon?: IconName;
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  const tones = {
    neutral: 'border-border bg-surface-2 text-fg-soft',
    brand: 'border-brand-100 bg-brand-50 text-brand-700',
    success: 'border-success-100 bg-success-50 text-success-700',
    warning: 'border-warning-100 bg-warning-50 text-warning-700',
    danger: 'border-danger-100 bg-danger-50 text-danger-700',
  };
  const defaultIcon: Record<string, IconName> = { neutral: 'info', brand: 'info', success: 'checkCircle', warning: 'warning', danger: 'warning' };
  return (
    <div role="status" className={`flex items-start gap-3 rounded-xl border px-3.5 py-3 text-sm ${tones[tone]} ${className}`}>
      <Icon name={icon ?? defaultIcon[tone]} className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1 font-medium">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Horizontal step / progress dots. */
export function ProgressSteps({ total, current, className = '' }: { total: number; current: number; className?: string }) {
  return (
    <div className={`flex items-center gap-1 ${className}`} aria-hidden>
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < current ? 'bg-brand' : 'bg-border'}`} />
      ))}
    </div>
  );
}

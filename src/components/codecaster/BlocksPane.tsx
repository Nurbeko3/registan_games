'use client';

import { useMemo, useState } from 'react';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useT } from '@/lib/i18n';
import {
  appendBlock, blocksToPython, cloneBlock, countBlocks, createBlock, insertBlock, moveBlock,
  paletteKindsForLevel, pathExists, removeBlock, updateBlock,
  DIRECTIONS, type Block, type BlockKind, type BlockPath, type Direction,
} from '@/lib/codecaster/blocks';
import type { CodecasterLevel } from '@/data/codecaster/types';

/**
 * Blocks → code editor (ages 7–9). Students stack colour-coded blocks; the
 * generated Python is pushed to the parent through `onCodeChange` so the
 * normal Run / grading pipeline is used unchanged.
 *
 * CONTRACT (used by PlayScreen's Code Studio "Blocks" tab):
 *   <BlocksPane level={level} onCodeChange={setCode} disabled={running} resetKey={level.id} />
 * The pane owns its block state; `resetKey` changes clear it.
 *
 * Interaction model (touch-first, no drag required):
 *   - tap a palette chip → the block is appended to the ACTIVE target
 *     (the main stack by default, or a container's "Add here" slot once tapped)
 *   - every block has Up / Down / Duplicate / Remove; containers show their
 *     children indented inside a C-shaped frame, `if` also has an "otherwise" slot
 */
export interface BlocksPaneProps {
  level: CodecasterLevel;
  onCodeChange: (code: string) => void;
  disabled?: boolean;
  resetKey?: string;
  className?: string;
}

type Family = 'motion' | 'items' | 'combat' | 'speech' | 'control' | 'condition' | 'note';

const BLOCK_META: Record<BlockKind, { labelKey: string; icon: IconName; family: Family }> = {
  moveRight: { labelKey: 'blocks.moveRight', icon: 'arrowRight', family: 'motion' },
  moveLeft: { labelKey: 'blocks.moveLeft', icon: 'arrowLeft', family: 'motion' },
  moveUp: { labelKey: 'blocks.moveUp', icon: 'arrowUp', family: 'motion' },
  moveDown: { labelKey: 'blocks.moveDown', icon: 'arrowDown', family: 'motion' },
  collect: { labelKey: 'blocks.collect', icon: 'gem', family: 'items' },
  useKey: { labelKey: 'blocks.useKey', icon: 'unlock', family: 'items' },
  attack: { labelKey: 'blocks.attack', icon: 'sword', family: 'combat' },
  say: { labelKey: 'blocks.say', icon: 'chat', family: 'speech' },
  comment: { labelKey: 'blocks.comment', icon: 'file', family: 'note' },
  repeat: { labelKey: 'blocks.repeat', icon: 'loop', family: 'control' },
  ifCanMove: { labelKey: 'blocks.ifCanMove', icon: 'puzzle', family: 'condition' },
};

/** Colour per family: chip (palette) and tile (stack) share the same hue. */
const FAMILY: Record<Family, { chip: string; tile: string; bar: string; text: string }> = {
  motion:    { chip: 'bg-brand-50 text-brand-700 ring-brand-200 hover:bg-brand-100',          tile: 'bg-brand-50 ring-brand-200',     bar: 'bg-brand-300',   text: 'text-brand-700' },
  items:     { chip: 'bg-amber-50 text-amber-700 ring-amber-200 hover:bg-amber-100',          tile: 'bg-amber-50 ring-amber-200',     bar: 'bg-amber-400',   text: 'text-amber-700' },
  combat:    { chip: 'bg-danger-50 text-danger-700 ring-danger-200 hover:bg-danger-100',      tile: 'bg-danger-50 ring-danger-200',   bar: 'bg-danger-300',  text: 'text-danger-700' },
  speech:    { chip: 'bg-info-50 text-info-700 ring-info-200 hover:bg-info-100',              tile: 'bg-info-50 ring-info-200',       bar: 'bg-info-300',    text: 'text-info-700' },
  control:   { chip: 'bg-violet-50 text-violet-700 ring-violet-200 hover:bg-violet-100',      tile: 'bg-violet-50 ring-violet-200',   bar: 'bg-violet-300',  text: 'text-violet-700' },
  condition: { chip: 'bg-success-50 text-success-700 ring-success-200 hover:bg-success-100',  tile: 'bg-success-50 ring-success-200', bar: 'bg-success-300', text: 'text-success-700' },
  note:      { chip: 'bg-surface-3 text-fg-soft ring-border hover:bg-surface-2',               tile: 'bg-surface-2 ring-border',       bar: 'bg-border-strong', text: 'text-fg-soft' },
};

const pathKey = (p: BlockPath) => p.join('/');

export function BlocksPane({ level, onCodeChange, disabled = false, resetKey, className = '' }: BlocksPaneProps) {
  const t = useT();
  const kinds = useMemo(() => paletteKindsForLevel(level.commands), [level]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [target, setTarget] = useState<BlockPath>([]);
  const [key, setKey] = useState(resetKey);
  if (key !== resetKey) { setKey(resetKey); setBlocks([]); setTarget([]); }

  const code = useMemo(() => blocksToPython(blocks), [blocks]);
  const total = countBlocks(blocks);
  const activeTarget = pathExists(blocks, target) ? target : [];

  const commit = (next: Block[]) => {
    setBlocks(next);
    if (!pathExists(next, target)) setTarget([]);
    onCodeChange(blocksToPython(next));
  };

  const add = (kind: BlockKind) => commit(appendBlock(blocks, activeTarget, createBlock(kind)));

  const targetLabel = (() => {
    if (activeTarget.length === 0) return t('blocks.targetRoot');
    // the container is the block at the last [index] of the path
    let list = blocks;
    let label = '';
    for (let i = 0; i < activeTarget.length; i += 2) {
      const b = list[activeTarget[i] as number];
      if (!b) break;
      label = t(BLOCK_META[b.kind].labelKey);
      if (b.kind === 'repeat') list = b.children;
      else if (b.kind === 'ifCanMove') list = activeTarget[i + 1] === 'otherwise' ? b.otherwise : b.children;
    }
    return t('blocks.targetInside', { block: label });
  })();

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* palette */}
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <p className="eyebrow">{t('blocks.palette')}</p>
          <span className="badge-neutral">{t('blocks.count', { n: total })}</span>
        </div>
        <div className="flex flex-wrap gap-2" role="toolbar" aria-label={t('blocks.palette')}>
          {kinds.map((kind) => {
            const m = BLOCK_META[kind];
            const f = FAMILY[m.family];
            return (
              <button
                key={kind}
                type="button"
                disabled={disabled}
                onClick={() => add(kind)}
                className={`inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3.5 font-display text-sm font-bold ring-1 ring-inset shadow-xs transition active:translate-y-px disabled:opacity-50 ${f.chip}`}
              >
                <Icon name={m.icon} className="h-4 w-4" />
                {t(m.labelKey)}
                <Icon name="plus" className="h-3.5 w-3.5 opacity-60" />
              </button>
            );
          })}
        </div>
        <p className="mt-1.5 text-xs text-fg-faint" aria-live="polite">{targetLabel}</p>
      </div>

      {/* stack */}
      <div className="rounded-xl border border-border bg-surface p-3">
        <BlockList
          blocks={blocks}
          path={[]}
          root={blocks}
          disabled={disabled}
          onChange={commit}
          target={activeTarget}
          onTarget={setTarget}
        />
      </div>

      {/* live Python */}
      <div className="overflow-hidden rounded-xl border border-border bg-surface-2">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Icon name="binary" className="h-3.5 w-3.5 text-fg-faint" />
          <p className="text-2xs font-bold uppercase tracking-wide text-fg-faint">{t('blocks.preview')}</p>
          <span className="ml-auto font-mono text-2xs text-fg-faint">main.py</span>
        </div>
        <pre className="max-h-56 overflow-auto p-3 font-mono text-xs leading-6 text-fg" aria-label={t('blocks.generated')}>
          {code.length === 0 ? (
            <span className="text-fg-faint">{t('cc.outputEmpty')}</span>
          ) : (
            code.replace(/\n$/, '').split('\n').map((line, i) => (
              <span key={i} className="flex">
                <span className="w-7 shrink-0 select-none text-right text-fg-faint">{i + 1}</span>
                <span className="pl-3">{line}</span>
              </span>
            ))
          )}
        </pre>
      </div>
    </div>
  );
}

interface ListProps {
  blocks: Block[];
  path: BlockPath;
  root: Block[];
  disabled: boolean;
  onChange: (next: Block[]) => void;
  target: BlockPath;
  onTarget: (p: BlockPath) => void;
}

function BlockList({ blocks, path, root, disabled, onChange, target, onTarget }: ListProps) {
  const t = useT();
  const isRoot = path.length === 0;
  const isActive = pathKey(target) === pathKey(path);

  return (
    <div className="space-y-1.5">
      {blocks.length === 0 && isRoot && (
        <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-fg-faint">{t('blocks.empty')}</p>
      )}
      <ol className="space-y-1.5">
        {blocks.map((b, i) => (
          <BlockTile
            key={b.id}
            block={b}
            index={i}
            count={blocks.length}
            path={path}
            root={root}
            disabled={disabled}
            onChange={onChange}
            target={target}
            onTarget={onTarget}
          />
        ))}
      </ol>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onTarget(path)}
        aria-pressed={isActive}
        className={`flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-lg border border-dashed px-3 text-xs font-bold transition disabled:opacity-50 ${
          isActive ? 'border-brand bg-brand-50 text-brand-700 ring-2 ring-brand/30' : 'border-border text-fg-faint hover:border-border-strong hover:text-fg'
        }`}
      >
        <Icon name="plus" className="h-3.5 w-3.5" /> {t('blocks.addHere')}
      </button>
    </div>
  );
}

function BlockTile({ block: b, index: i, count, path, root, disabled, onChange, target, onTarget }: Omit<ListProps, 'blocks'> & { block: Block; index: number; count: number }) {
  const t = useT();
  const m = BLOCK_META[b.kind];
  const f = FAMILY[m.family];
  const isContainer = b.kind === 'repeat' || b.kind === 'ifCanMove';

  const iconBtn = (label: string, icon: IconName, onClick: () => void, extra = '', isDisabled = disabled) => (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-8 w-8 shrink-0 place-items-center rounded-md text-current/70 transition hover:bg-black/5 hover:text-current disabled:opacity-30 dark:hover:bg-white/10 ${extra}`}
    >
      <Icon name={icon} className="h-3.5 w-3.5" />
    </button>
  );

  return (
    <li className={`relative rounded-xl ring-1 ring-inset shadow-xs ${f.tile} ${f.text}`}>
      {/* puzzle notch */}
      <span aria-hidden className={`absolute -top-px left-4 h-1.5 w-6 rounded-b-md ${f.bar}`} />
      <div className="flex flex-wrap items-center gap-1.5 py-1.5 pl-3 pr-1.5 sm:flex-nowrap">
        <Icon name={m.icon} className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate font-display text-sm font-bold text-fg">{t(m.labelKey)}</span>

        {b.kind === 'repeat' && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-surface px-1 py-0.5 ring-1 ring-inset ring-border">
            {iconBtn('−', 'minus', () => onChange(updateBlock(root, path, i, { times: Math.max(1, b.times - 1) } as Partial<Block>)), 'h-7 w-7', disabled || b.times <= 1)}
            <span className="w-7 text-center font-mono text-sm font-bold tabular-nums text-fg" aria-label={t('blocks.times')}>{b.times}</span>
            {iconBtn('+', 'plus', () => onChange(updateBlock(root, path, i, { times: Math.min(20, b.times + 1) } as Partial<Block>)), 'h-7 w-7', disabled || b.times >= 20)}
            <span className="pr-1.5 text-2xs font-bold uppercase text-fg-faint">{t('blocks.times')}</span>
          </span>
        )}
        {b.kind === 'ifCanMove' && (
          <select
            value={b.direction}
            disabled={disabled}
            aria-label={t('blocks.direction')}
            onChange={(e) => onChange(updateBlock(root, path, i, { direction: e.target.value as Direction } as Partial<Block>))}
            className="input h-8 w-auto min-h-0 py-0 pl-2 pr-7 text-xs"
          >
            {DIRECTIONS.map((d) => <option key={d} value={d}>{t(`blocks.dir.${d}`)}</option>)}
          </select>
        )}
        {(b.kind === 'say' || b.kind === 'comment') && (
          <input
            value={b.text ?? ''}
            disabled={disabled}
            aria-label={t(m.labelKey)}
            maxLength={60}
            onChange={(e) => onChange(updateBlock(root, path, i, { text: e.target.value } as Partial<Block>))}
            className="input h-8 w-36 min-h-0 py-0 text-xs"
          />
        )}

        <span className="ml-auto flex items-center">
          {iconBtn(t('blocks.up'), 'chevronDown', () => onChange(moveBlock(root, path, i, -1)), '[&>svg]:rotate-180', disabled || i === 0)}
          {iconBtn(t('blocks.down'), 'chevronDown', () => onChange(moveBlock(root, path, i, 1)), '', disabled || i === count - 1)}
          {iconBtn(t('blocks.duplicate'), 'copy', () => onChange(insertBlock(root, path, i + 1, cloneBlock(b))))}
          {iconBtn(t('blocks.remove'), 'trash', () => onChange(removeBlock(root, path, i)), 'hover:!text-danger')}
        </span>
      </div>

      {isContainer && (
        <div className="pb-2 pl-3 pr-2">
          <div className={`border-l-[3px] pl-2.5 ${f.bar.replace('bg-', 'border-')}`}>
            <BlockList blocks={b.children} path={[...path, i, 'children']} root={root} disabled={disabled} onChange={onChange} target={target} onTarget={onTarget} />
          </div>
          {b.kind === 'ifCanMove' && (
            <>
              <p className="mt-2 pl-0.5 font-display text-xs font-bold">{t('blocks.else')}</p>
              <div className={`mt-1 border-l-[3px] pl-2.5 ${f.bar.replace('bg-', 'border-')}`}>
                <BlockList blocks={b.otherwise} path={[...path, i, 'otherwise']} root={root} disabled={disabled} onChange={onChange} target={target} onTarget={onTarget} />
              </div>
            </>
          )}
        </div>
      )}
    </li>
  );
}

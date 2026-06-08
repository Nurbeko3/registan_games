'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/lib/i18n';
import type { EngineState, EntityKind, TileType } from '@/lib/codecaster/types';

/**
 * Renders an `EngineState` as an auto-scaling CSS-grid dungeon.
 *
 * Original emoji/shape art only (no CodeCombat assets): 🧙 hero, 🪙 coin,
 * 🔑 key, 🚪 door, 👹 goblin, 🐉 boss, ⬛ wall, 🕳️ pit, ❤ hp.
 * The hero animates tile-to-tile with Framer Motion (skipped under
 * prefers-reduced-motion / the app's `settings.reducedMotion`).
 */

const TILE_BG: Record<TileType, string> = {
  floor: 'bg-cloud/60',
  wall: 'bg-ink/80',
  pit: 'bg-ink-soft/70',
  spike: 'bg-bubble/25',
  door: 'bg-mango/30',
  goal: 'bg-mint/30',
};

const TILE_GLYPH: Partial<Record<TileType, string>> = {
  wall: '⬛',
  pit: '🕳️',
  door: '🚪',
  goal: '🌟',
};

const ENTITY_GLYPH: Record<EntityKind, string> = {
  coin: '🪙',
  gem: '💎',
  key: '🔑',
  chest: '🎁',
  goblin: '👹',
  slime: '🟢',
  bat: '🦇',
  guard: '🛡️',
  boss: '🐉',
};

const FACING_ROTATE: Record<string, number> = { up: -90, down: 90, left: 180, right: 0 };

/** Largest a single tile is allowed to grow to — keeps short/wide boards from
 *  stretching into a thin full-width hairline; the board centers instead. */
const MAX_TILE_PX = 88;
/** Smallest a tile may shrink to before the board scrolls instead. */
const MIN_TILE_PX = 40;

export function DungeonView({ state }: { state: EngineState }) {
  const t = useT();
  const shouldReduceMotion = useReducedMotion();
  const { tiles, hero, entities, turn } = state;
  const cols = tiles[0]?.length ?? 0;
  const rows = tiles.length;

  return (
    <div className="flex h-full flex-col gap-4">
      {/* HUD — single horizontal bar, never wraps */}
      <div className="flex items-center gap-2 overflow-x-auto">
        <span className="chip shrink-0 bg-bubble/15 text-bubble-600">
          <Icon name="heart" className="h-4 w-4" /> {hero.hp}
        </span>
        <span className="chip shrink-0 bg-mango/20 text-ink">
          <Icon name="coin" className="h-4 w-4" /> {hero.coins}
        </span>
        <span className="chip shrink-0 bg-sky/15 text-sky-600">
          <Icon name="gem" className="h-4 w-4" /> {hero.gems}
        </span>
        <span className="chip shrink-0 bg-grape-50 text-grape">
          <Icon name="lock" className="h-4 w-4" /> {hero.keys}
        </span>
        <span className="ml-auto shrink-0 chip bg-white text-ink-faint ring-1 ring-grape-100/60">
          <Icon name="signal" className="h-4 w-4" /> {t('cc.step', { n: turn })}
        </span>
      </div>

      {/* Arena — generously padded frame; the board centers within it at a
          clamped tile size so short/wide or tall/narrow grids both read as a
          comfortable centered band, never a hairline or a tiny corner. */}
      <div className="flex flex-1 items-center justify-center rounded-xl2 bg-ink/5 p-4 ring-1 ring-grape-100/60 sm:p-6">
        <div
          role="img"
          aria-label={t('cc.dungeonAlt')}
          className="relative grid gap-0.5"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(${MIN_TILE_PX}px, ${MAX_TILE_PX}px))`,
            gridTemplateRows: `repeat(${rows}, minmax(${MIN_TILE_PX}px, ${MAX_TILE_PX}px))`,
            width: `min(100%, ${cols * MAX_TILE_PX}px)`,
            aspectRatio: `${cols} / ${rows}`,
          }}
        >
          {tiles.map((row, y) =>
            row.map((tile, x) => (
              <div
                key={`${x}-${y}`}
                className={`relative grid place-items-center rounded-md text-[min(6vw,2rem)] leading-none ${TILE_BG[tile]}`}
              >
                {TILE_GLYPH[tile] && <span aria-hidden className="opacity-80">{TILE_GLYPH[tile]}</span>}
              </div>
            )),
          )}

          {/* Entities layer (absolute, positioned over the grid) */}
          {entities.map((e) => (
            <div
              key={e.id}
              className="pointer-events-none absolute grid place-items-center text-[min(6.5vw,2.2rem)] leading-none transition-[left,top] duration-300 ease-out"
              style={{
                left: `${(e.pos.x / cols) * 100}%`,
                top: `${(e.pos.y / rows) * 100}%`,
                width: `${100 / cols}%`,
                height: `${100 / rows}%`,
              }}
              aria-hidden
            >
              <span>{ENTITY_GLYPH[e.kind]}</span>
              {typeof e.hp === 'number' && (
                <span className="absolute -top-1 right-0.5 rounded-full bg-bubble px-1 text-[9px] font-extrabold text-white">
                  {e.hp}
                </span>
              )}
            </div>
          ))}

          {/* Hero — animates tile-to-tile */}
          <motion.div
            className="pointer-events-none absolute grid place-items-center text-[min(7vw,2.4rem)] leading-none"
            style={{ width: `${100 / cols}%`, height: `${100 / rows}%` }}
            animate={{ left: `${(hero.pos.x / cols) * 100}%`, top: `${(hero.pos.y / rows) * 100}%` }}
            initial={false}
            transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 22 }}
            aria-hidden
          >
            <motion.span
              animate={{ rotate: FACING_ROTATE[hero.facing] ?? 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 22 }}
            >
              🧙
            </motion.span>
          </motion.div>
        </div>
      </div>

      {/* Mission log */}
      {state.log.length > 0 && (
        <div className="max-h-28 overflow-auto rounded-xl2 bg-cloud/70 px-3 py-2 text-xs font-bold text-ink-soft">
          {state.log.slice(-6).map((line, i) => <p key={i} className="truncate">{line}</p>)}
        </div>
      )}
    </div>
  );
}

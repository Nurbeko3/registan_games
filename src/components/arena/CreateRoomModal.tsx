'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ARENA_MODES, TEAM_SIZES, getMode } from '@/data/arenaModes';
import { ARENA_MAPS } from '@/data/arenaMaps';
import { DIFFICULTIES } from './PracticeSetup';
import { DEFAULT_SETTINGS, type RoomSettings } from '@/lib/arena/network/types';
import { Icon } from '@/components/ui/Icon';
import { useT } from '@/lib/i18n';
import { GRADES, type Grade } from '@/lib/arena/types';
import type { ArenaDifficulty } from '@/lib/arena/engine';

/** Host picks starting settings; final tweaks still possible in the lobby. */
export function CreateRoomModal({ onCreate, onClose }: { onCreate: (s: RoomSettings) => void; onClose: () => void }) {
  const t = useT();
  const [mapId, setMapId] = useState(DEFAULT_SETTINGS.mapId);
  const [modeId, setModeId] = useState<RoomSettings['modeId']>(DEFAULT_SETTINGS.modeId);
  const [perTeam, setPerTeam] = useState(DEFAULT_SETTINGS.perTeam);
  const [difficulty, setDifficulty] = useState<ArenaDifficulty>(DEFAULT_SETTINGS.difficulty);
  const [grade, setGrade] = useState<Grade | undefined>(DEFAULT_SETTINGS.grade);
  const [botFill, setBotFill] = useState(true);

  const create = () =>
    onCreate({ ...DEFAULT_SETTINGS, mapId, modeId, perTeam, difficulty, grade, botFill, targetScore: getMode(modeId).targetScore });

  return (
    <Overlay onClose={onClose}>
      <p className="flex items-center gap-2 font-display text-xl font-extrabold"><Icon name="wrench" className="h-5 w-5 text-grape" /> {t('arena.create')}</p>
      <p className="mt-1 text-sm text-ink-soft">{t('arena.pickBasics')}</p>

      <Row label={t('arena.map')}>
        <Pills items={ARENA_MAPS.map((m) => ({ id: m.id, label: `${m.emoji} ${m.name} · ${m.size} · ${m.challenge}` }))} value={mapId} onPick={setMapId} />
      </Row>
      <Row label={t('arena.mode')}>
        <Pills items={ARENA_MODES.map((m) => ({ id: m.id, label: `${m.emoji} ${m.name}` }))} value={modeId} onPick={(id) => setModeId(id as RoomSettings['modeId'])} />
      </Row>
      <Row label={t('arena.teamSize')}>
        <Pills items={TEAM_SIZES.map((ts) => ({ id: String(ts.perTeam), label: ts.label }))} value={String(perTeam)} onPick={(id) => setPerTeam(Number(id))} />
      </Row>
      <Row label={t('arena.botDifficulty')}>
        <Pills items={DIFFICULTIES.map((d) => ({ id: d.id, label: `${d.emoji} ${d.label}` }))} value={difficulty} onPick={(id) => setDifficulty(id as ArenaDifficulty)} />
      </Row>
      <Row label={t('arena.grade')}>
        <Pills
          items={[{ id: 'all', label: t('arena.gradeAll') }, ...GRADES.map((g) => ({ id: String(g), label: t('arena.gradeN', { n: g }) }))]}
          value={grade == null ? 'all' : String(grade)}
          onPick={(id) => setGrade(id === 'all' ? undefined : (Number(id) as Grade))}
        />
      </Row>
      <Row label={t('arena.fillBots')}>
        <button
          onClick={() => setBotFill((b) => !b)}
          className={`rounded-full px-4 py-1.5 text-sm font-extrabold shadow-card transition ${botFill ? 'bg-mint text-white' : 'bg-white text-ink-faint'}`}
        >
          {botFill ? t('arena.on') : t('arena.off')}
        </button>
      </Row>

      <button onClick={create} className="btn-primary mt-5 w-full text-lg"><Icon name="rocket" className="h-5 w-5" /> {t('arena.createBtn')}</button>
    </Overlay>
  );
}

export function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4 backdrop-blur-sm"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.85, y: 20 }} animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 22 }}
        className="card max-h-[88vh] w-full max-w-md overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <p className="mb-1.5 text-xs font-bold text-ink-faint">{label}</p>
      {children}
    </div>
  );
}

function Pills({ items, value, onPick }: { items: { id: string; label: string }[]; value: string; onPick: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((it) => (
        <button
          key={it.id}
          onClick={() => onPick(it.id)}
          className={`rounded-full px-3 py-1.5 text-xs font-extrabold shadow-card transition ${
            value === it.id ? 'bg-grape text-white' : 'bg-white hover:bg-grape-50'
          }`}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

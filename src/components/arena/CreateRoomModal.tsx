'use client';

import { useState } from 'react';
import { ARENA_MODES, TEAM_SIZES, getMode } from '@/data/arenaModes';
import { ARENA_MAPS } from '@/data/arenaMaps';
import { DIFFICULTIES } from './PracticeSetup';
import { DEFAULT_SETTINGS, type RoomSettings } from '@/lib/arena/network/types';
import { Icon } from '@/components/ui/Icon';
import { Modal, Switch } from '@/components/ui/Primitives';
import { useT } from '@/lib/i18n';
import { GRADES, type Grade } from '@/lib/arena/types';
import type { ArenaDifficulty } from '@/lib/arena/engine';

/** Host picks starting settings; final tweaks still possible in the lobby. */
export function CreateRoomModal({ open = true, onCreate, onClose }: { open?: boolean; onCreate: (s: RoomSettings) => void; onClose: () => void }) {
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
    <Modal
      open={open}
      onClose={onClose}
      title={t('arena.create')}
      description={t('arena.pickBasics')}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">{t('common.close')}</button>
          <button type="button" onClick={create} className="btn-primary">
            <Icon name="rocket" className="h-4 w-4" /> {t('arena.createBtn')}
          </button>
        </>
      }
    >
      <SettingRow label={t('arena.map')}>
        <Pills items={ARENA_MAPS.map((m) => ({ id: m.id, label: `${m.name} · ${m.size} · ${m.challenge}` }))} value={mapId} onPick={setMapId} />
      </SettingRow>
      <SettingRow label={t('arena.mode')}>
        <Pills items={ARENA_MODES.map((m) => ({ id: m.id, label: m.name }))} value={modeId} onPick={(id) => setModeId(id as RoomSettings['modeId'])} />
      </SettingRow>
      <SettingRow label={t('arena.teamSize')}>
        <Pills items={TEAM_SIZES.map((ts) => ({ id: String(ts.perTeam), label: ts.label }))} value={String(perTeam)} onPick={(id) => setPerTeam(Number(id))} />
      </SettingRow>
      <SettingRow label={t('arena.botDifficulty')}>
        <Pills items={DIFFICULTIES.map((d) => ({ id: d.id, label: d.label }))} value={difficulty} onPick={(id) => setDifficulty(id as ArenaDifficulty)} />
      </SettingRow>
      <SettingRow label={t('arena.grade')}>
        <Pills
          items={[{ id: 'all', label: t('arena.gradeAll') }, ...GRADES.map((g) => ({ id: String(g), label: t('arena.gradeN', { n: g }) }))]}
          value={grade == null ? 'all' : String(grade)}
          onPick={(id) => setGrade(id === 'all' ? undefined : (Number(id) as Grade))}
        />
      </SettingRow>
      <div className="mt-3 rounded-xl border border-border">
        <Switch checked={botFill} onChange={setBotFill} label={t('arena.fillBots')} icon="bot" />
      </div>
    </Modal>
  );
}

/** Labelled settings row — shared by the create dialog and the lobby. */
export function SettingRow({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`mt-3 first:mt-0 ${className}`}>
      <p className="label">{label}</p>
      {children}
    </div>
  );
}

/** Compact option pills (single-select). */
export function Pills({
  items,
  value,
  disabled,
  onPick,
}: {
  items: { id: string; label: string }[];
  value: string;
  disabled?: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup">
      {items.map((it) => {
        const active = value === it.id;
        return (
          <button
            key={it.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onPick(it.id)}
            className={`inline-flex min-h-[32px] items-center rounded-lg border px-2.5 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
              active
                ? 'border-brand bg-brand-50 text-brand-700'
                : 'border-border bg-surface text-fg-soft hover:border-border-strong hover:text-fg'
            }`}
          >
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

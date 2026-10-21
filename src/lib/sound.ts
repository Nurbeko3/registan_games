/**
 * Site-wide sound effects — zero assets, pure WebAudio synthesis.
 *
 * `playSfx(name)` is safe to call anywhere (SSR, tests, muted users): it
 * no-ops unless running in a browser with WebAudio and the player's
 * `settings.sound` is on. The AudioContext is created lazily on the first
 * call (which always follows a user gesture — a click, a key press), so
 * autoplay policies are respected.
 *
 * Keep this the ONLY place UI code reaches for sound; the arena keeps its own
 * event-driven synth in `src/lib/arena/audio.ts` for in-match effects.
 */

import { useGame } from '@/store/useGame';

export type SfxName =
  | 'click'     // generic tap / select
  | 'toggle'    // switch / tab change
  | 'success'   // level cleared, correct answer
  | 'error'     // wrong answer, runtime error
  | 'star'      // star fill (call once per star, staggered by the UI)
  | 'coin'      // coins awarded / purchase
  | 'levelUp'   // level or rank up fanfare
  | 'unlock'    // achievement / item unlocked
  | 'tick';     // countdown / step

interface Note { f: number; dur: number; type?: OscillatorType; gain?: number; slide?: number; at?: number }

/** Each effect is a tiny score of 1–4 notes (freq Hz, duration s, optional pitch slide). */
const SCORES: Record<SfxName, Note[]> = {
  click:   [{ f: 520, dur: 0.045, type: 'triangle', gain: 0.05 }],
  toggle:  [{ f: 420, dur: 0.05, type: 'sine', gain: 0.045, slide: 160 }],
  success: [
    { f: 523, dur: 0.12, type: 'sine', gain: 0.07 },
    { f: 659, dur: 0.12, type: 'sine', gain: 0.07, at: 0.11 },
    { f: 784, dur: 0.22, type: 'sine', gain: 0.08, at: 0.22 },
  ],
  error:   [{ f: 220, dur: 0.16, type: 'triangle', gain: 0.06, slide: -70 }, { f: 180, dur: 0.2, type: 'triangle', gain: 0.05, at: 0.15 }],
  star:    [{ f: 880, dur: 0.14, type: 'sine', gain: 0.06, slide: 320 }],
  coin:    [{ f: 988, dur: 0.07, type: 'square', gain: 0.035 }, { f: 1319, dur: 0.16, type: 'square', gain: 0.035, at: 0.07 }],
  levelUp: [
    { f: 523, dur: 0.1, type: 'sine', gain: 0.07 },
    { f: 659, dur: 0.1, type: 'sine', gain: 0.07, at: 0.1 },
    { f: 784, dur: 0.1, type: 'sine', gain: 0.07, at: 0.2 },
    { f: 1047, dur: 0.38, type: 'sine', gain: 0.09, at: 0.3 },
  ],
  unlock:  [{ f: 660, dur: 0.1, type: 'triangle', gain: 0.06 }, { f: 990, dur: 0.26, type: 'triangle', gain: 0.06, at: 0.1, slide: 200 }],
  tick:    [{ f: 700, dur: 0.035, type: 'square', gain: 0.03 }],
};

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) {
    try { ctx = new Ctor(); } catch { return null; }
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  return ctx;
}

/** True when the player has sound effects enabled. */
export function soundEnabled(): boolean {
  try { return useGame.getState().settings.sound !== false; } catch { return false; }
}

/** Play a named effect. Never throws; silently no-ops when muted or unsupported. */
export function playSfx(name: SfxName): void {
  if (!soundEnabled()) return;
  const ac = getContext();
  if (!ac) return;
  const score = SCORES[name];
  const now = ac.currentTime;
  for (const n of score) {
    try {
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      const start = now + (n.at ?? 0);
      const end = start + n.dur;
      osc.type = n.type ?? 'sine';
      osc.frequency.setValueAtTime(n.f, start);
      if (n.slide) osc.frequency.linearRampToValueAtTime(Math.max(40, n.f + n.slide), end);
      const g = n.gain ?? 0.05;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(g, start + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(gain).connect(ac.destination);
      osc.start(start);
      osc.stop(end + 0.02);
    } catch { /* ignore — sound is non-essential */ }
  }
}

/** Play N star chimes with a small stagger (used by win screens). */
export function playStars(count: number, stepMs = 140): void {
  if (!soundEnabled() || count <= 0) return;
  for (let i = 0; i < count; i += 1) {
    setTimeout(() => playSfx('star'), i * stepMs);
  }
}

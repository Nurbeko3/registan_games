/** Audio event ARCHITECTURE for BATTLE LEARN ARENA.
 *
 *  No audio files are bundled. The engine + match layer emit *semantic* events;
 *  attach a hook to turn them into sound. A tiny optional WebAudio synth is
 *  included so the arena can feel alive with zero assets — wire it up with
 *  `createSynth()`. Honors the player's sound setting via `setMuted`. */

export type ArenaSound =
  | 'shoot' | 'hit' | 'crit' | 'kill' | 'multikill' | 'hurt'
  | 'respawn' | 'shield' | 'countdown'
  | 'correct' | 'wrong' | 'victory' | 'defeat' | 'streak';

export interface SoundEvent { sound: ArenaSound; intensity: number }
export type AudioHook = (e: SoundEvent) => void;

/** Lightweight event bus between the game and whatever plays sound. */
export class ArenaAudio {
  private hook: AudioHook | null = null;
  private muted = false;
  setHook(h: AudioHook | null) { this.hook = h; }
  setMuted(m: boolean) { this.muted = m; }
  emit(sound: ArenaSound, intensity = 1) { if (!this.muted) this.hook?.({ sound, intensity }); }
}

// ── optional zero-asset WebAudio synth ───────────────────────────────────────
interface Tone { f: number; type: OscillatorType; dur: number; gain: number; slide?: number }

const TONES: Record<ArenaSound, Tone> = {
  shoot:     { f: 320, type: 'square',   dur: 0.06, gain: 0.035, slide: -120 },
  hit:       { f: 240, type: 'triangle', dur: 0.05, gain: 0.045 },
  crit:      { f: 880, type: 'square',   dur: 0.10, gain: 0.06,  slide: 220 },
  kill:      { f: 520, type: 'sawtooth', dur: 0.16, gain: 0.06,  slide: 260 },
  multikill: { f: 660, type: 'square',   dur: 0.22, gain: 0.07,  slide: 330 },
  hurt:      { f: 170, type: 'sawtooth', dur: 0.10, gain: 0.05,  slide: -60 },
  respawn:   { f: 440, type: 'sine',     dur: 0.20, gain: 0.06,  slide: 440 },
  shield:    { f: 600, type: 'sine',     dur: 0.18, gain: 0.05,  slide: 120 },
  countdown: { f: 500, type: 'sine',     dur: 0.10, gain: 0.05 },
  correct:   { f: 660, type: 'sine',     dur: 0.18, gain: 0.06,  slide: 320 },
  wrong:     { f: 200, type: 'triangle', dur: 0.18, gain: 0.05,  slide: -50 },
  victory:   { f: 523, type: 'sine',     dur: 0.40, gain: 0.07,  slide: 400 },
  defeat:    { f: 300, type: 'triangle', dur: 0.40, gain: 0.05,  slide: -120 },
  streak:    { f: 740, type: 'square',   dur: 0.16, gain: 0.06,  slide: 200 },
};

/** Build a WebAudio synth hook (no files). `resume()` must be called from a user
 *  gesture (browsers block audio otherwise). Returns a no-op hook if unsupported. */
export function createSynth(): { hook: AudioHook; resume: () => void } {
  let ctx: AudioContext | null = null;
  const ensure = (): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AC) ctx = new AC();
    }
    return ctx;
  };

  const hook: AudioHook = ({ sound, intensity }) => {
    const ac = ensure();
    if (!ac) return;
    const t = TONES[sound];
    if (!t) return;
    try {
      const now = ac.currentTime;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = t.type;
      osc.frequency.setValueAtTime(t.f, now);
      if (t.slide) osc.frequency.linearRampToValueAtTime(Math.max(40, t.f + t.slide), now + t.dur);
      gain.gain.setValueAtTime(t.gain * Math.min(1.4, intensity), now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t.dur);
      osc.connect(gain).connect(ac.destination);
      osc.start(now);
      osc.stop(now + t.dur);
    } catch {
      /* never let audio break the game */
    }
  };

  return { hook, resume: () => { ensure()?.resume().catch(() => {}); } };
}

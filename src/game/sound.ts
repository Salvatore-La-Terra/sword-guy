/**
 * Lightweight, dependency-free Web Audio sound cues for the game.
 *
 * This module is intentionally isolated from Phaser/GameScene: it only
 * touches the browser's Web Audio API and exposes a small functional API
 * that a scene can call into. All cues are synthesized (oscillators +
 * short noise bursts) so no audio asset files are required.
 *
 * Browser autoplay policies block audio until a user gesture occurs, so the
 * underlying AudioContext is created/resumed lazily: the first call to
 * `playSound` (or the automatic `pointerdown`/`keydown`/`touchstart`
 * listeners installed below) attempts to create and resume the context.
 * Any failure (unsupported API, blocked autoplay, etc.) is swallowed so
 * gameplay is never interrupted by audio errors.
 */

export type SoundCue =
  | 'attack'
  | 'hit'
  | 'block'
  | 'heal'
  | 'kill'
  | 'waveStart'
  | 'waveClear'
  | 'defeat';

type OscType = OscillatorType;

interface ToneOptions {
  /** Starting frequency in Hz. */
  freq: number;
  /** Optional ending frequency for a pitch ramp; defaults to `freq`. */
  endFreq?: number;
  /** Duration in seconds. */
  duration: number;
  /** Oscillator waveform. */
  type: OscType;
  /** Peak linear gain (0-1) before the envelope decay. */
  gain: number;
  /** Delay in seconds before this tone starts, relative to `now`. */
  delay?: number;
}

const AUDIO_CONTEXT_CTOR: (new () => AudioContext) | undefined =
  typeof window !== 'undefined'
    ? window.AudioContext ?? (window as unknown as { webkitAudioContext?: new () => AudioContext }).webkitAudioContext
    : undefined;

class GeneratedSoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private unavailable = false;
  private unlockListenersAttached = false;

  constructor() {
    this.attachUnlockListeners();
  }

  /** Whether sound generation is muted (does not reflect API availability). */
  isMuted(): boolean {
    return this.muted;
  }

  /** Explicitly set the muted state. */
  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : 1;
    }
  }

  /** Flip the muted state and return the new value. */
  toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /**
   * Attempt to play a short generated cue. Fails silently (no-op) when the
   * Web Audio API is unavailable, the context cannot be created/resumed
   * (e.g. no user gesture has happened yet), or the manager is muted.
   */
  play(cue: SoundCue): void {
    if (this.muted || this.unavailable) {
      return;
    }
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) {
      return;
    }
    try {
      this.render(cue, ctx, this.masterGain);
    } catch {
      // Swallow any synthesis errors - audio is optional and must never
      // break gameplay.
    }
  }

  /**
   * Attempts to create (if needed) and resume the AudioContext. Safe to call
   * repeatedly; intended to be triggered from user-gesture event handlers to
   * satisfy browser autoplay restrictions.
   */
  unlock(): void {
    this.ensureContext();
  }

  private attachUnlockListeners(): void {
    if (this.unlockListenersAttached || typeof window === 'undefined') {
      return;
    }
    this.unlockListenersAttached = true;
    const resume = () => this.ensureContext();
    try {
      window.addEventListener('pointerdown', resume, { passive: true });
      window.addEventListener('keydown', resume);
      window.addEventListener('touchstart', resume, { passive: true });
    } catch {
      // Environments without a DOM (or restricted ones) simply won't get
      // auto-unlock; `play()` still fails silently in that case.
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.unavailable) {
      return null;
    }
    try {
      if (!this.ctx) {
        if (!AUDIO_CONTEXT_CTOR) {
          this.unavailable = true;
          return null;
        }
        this.ctx = new AUDIO_CONTEXT_CTOR();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.muted ? 0 : 1;
        this.masterGain.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume().catch(() => {
          // Resume can reject if still not allowed; ignore and retry later.
        });
      }
      return this.ctx;
    } catch {
      this.unavailable = true;
      this.ctx = null;
      this.masterGain = null;
      return null;
    }
  }

  private render(cue: SoundCue, ctx: AudioContext, dest: GainNode): void {
    const now = ctx.currentTime;
    switch (cue) {
      case 'attack':
        this.tone(ctx, dest, now, { freq: 320, endFreq: 190, duration: 0.09, type: 'square', gain: 0.14 });
        break;
      case 'hit':
        this.tone(ctx, dest, now, { freq: 150, endFreq: 90, duration: 0.08, type: 'square', gain: 0.16 });
        this.noiseBurst(ctx, dest, now, 0.06, 0.12);
        break;
      case 'block':
        this.tone(ctx, dest, now, { freq: 950, endFreq: 720, duration: 0.07, type: 'triangle', gain: 0.12 });
        break;
      case 'heal':
        this.arpeggio(ctx, dest, now, [523.25, 659.25, 783.99], 0.09, 'sine', 0.1);
        break;
      case 'kill':
        this.tone(ctx, dest, now, { freq: 210, endFreq: 55, duration: 0.22, type: 'sawtooth', gain: 0.14 });
        break;
      case 'waveStart':
        this.arpeggio(ctx, dest, now, [392, 523.25], 0.1, 'square', 0.09);
        break;
      case 'waveClear':
        this.arpeggio(ctx, dest, now, [523.25, 659.25, 783.99, 1046.5], 0.08, 'triangle', 0.12);
        break;
      case 'defeat':
        this.tone(ctx, dest, now, { freq: 220, endFreq: 50, duration: 0.6, type: 'sawtooth', gain: 0.16 });
        break;
      default:
        break;
    }
  }

  /** A single pitched tone with a quick attack and exponential decay. */
  private tone(ctx: AudioContext, dest: GainNode, now: number, options: ToneOptions): void {
    const startAt = now + (options.delay ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = options.type;
    osc.frequency.setValueAtTime(options.freq, startAt);
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(1, options.endFreq ?? options.freq),
      startAt + options.duration
    );

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, options.gain), startAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + options.duration);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(startAt);
    osc.stop(startAt + options.duration + 0.02);
  }

  /** A short sequence of tones played back-to-back, e.g. for heal/wave cues. */
  private arpeggio(
    ctx: AudioContext,
    dest: GainNode,
    now: number,
    freqs: number[],
    noteDuration: number,
    type: OscType,
    gain: number
  ): void {
    freqs.forEach((freq, index) => {
      this.tone(ctx, dest, now, {
        freq,
        duration: noteDuration,
        type,
        gain,
        delay: index * noteDuration * 0.85
      });
    });
  }

  /** Short filtered noise burst layered under percussive cues (e.g. hit). */
  private noiseBurst(ctx: AudioContext, dest: GainNode, now: number, duration: number, gain: number): void {
    const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200;
    filter.Q.value = 0.8;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(gain, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    source.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(dest);
    source.start(now);
    source.stop(now + duration + 0.02);
  }
}

/** Singleton instance shared across the game. */
export const soundManager = new GeneratedSoundManager();

/**
 * Convenience function for scenes: play a named cue. No-ops silently if
 * audio is unavailable, not yet unlocked, or muted.
 */
export function playSound(cue: SoundCue): void {
  soundManager.play(cue);
}

/** Toggle mute state; returns the resulting muted flag. */
export function toggleSoundMuted(): boolean {
  return soundManager.toggleMute();
}

/** Explicitly set the muted state. */
export function setSoundMuted(muted: boolean): void {
  soundManager.setMuted(muted);
}

/** Current muted state. */
export function isSoundMuted(): boolean {
  return soundManager.isMuted();
}

/**
 * Call from a user-gesture handler (pointerdown/keydown) to proactively
 * create/resume the AudioContext ahead of the first cue. Optional: `play()`
 * already attempts this lazily, and this module auto-attaches its own
 * window-level unlock listeners.
 */
export function unlockSound(): void {
  soundManager.unlock();
}

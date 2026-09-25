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
 * The generated soundtrack is stricter: it waits until one of those listeners
 * observes a trusted user gesture before scheduling any music.
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

/** Location of the recorded soundtrack, served from the `public/` folder. */
const MUSIC_TRACK_URL = `${import.meta.env.BASE_URL}audio/cathedral-of-ash.mp3`;
/** Linear gain applied to the recorded soundtrack (kept under sound effects). */
const MUSIC_TRACK_GAIN = 0.35;

class GeneratedSoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private muted = false;
  private unavailable = false;
  private unlockListenersAttached = false;
  private userGestureReceived = false;
  private musicRequested = false;
  private musicGain: GainNode | null = null;
  private musicTimer: ReturnType<typeof setTimeout> | null = null;
  private musicOscillators = new Set<OscillatorNode>();
  private musicSource: AudioBufferSourceNode | null = null;
  private musicBuffer: AudioBuffer | null = null;
  private musicBufferPromise: Promise<AudioBuffer | null> | null = null;

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

  /**
   * Request the generated soundtrack. If no trusted user gesture has occurred
   * yet, playback is deferred until the first pointer, keyboard, or touch
   * interaction. Repeated calls are idempotent.
   */
  startMusic(): void {
    this.musicRequested = true;
    if (this.userGestureReceived) {
      this.beginMusic();
    }
  }

  /**
   * Whether the generated soundtrack is currently scheduled/audible (i.e. a
   * trusted user gesture has already unlocked it). Useful for UI that needs
   * to reflect autoplay-blocked vs. actively-playing state.
   */
  isMusicPlaying(): boolean {
    return this.musicRequested && this.musicGain !== null;
  }

  /** Whether a trusted user gesture has occurred yet (autoplay unlock state). */
  hasUserGesture(): boolean {
    return this.userGestureReceived;
  }

  /** Stop the soundtrack and discard all currently scheduled music notes. */
  stopMusic(): void {
    this.musicRequested = false;
    if (this.musicTimer !== null) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
    for (const oscillator of this.musicOscillators) {
      try {
        oscillator.stop();
      } catch {
        // An oscillator may already have ended between iteration and stop().
      }
      oscillator.disconnect();
    }
    this.musicOscillators.clear();
    if (this.musicSource) {
      try {
        this.musicSource.stop();
      } catch {
        // The buffer source may already have ended.
      }
      this.musicSource.disconnect();
      this.musicSource = null;
    }
    this.musicGain?.disconnect();
    this.musicGain = null;
  }

  private attachUnlockListeners(): void {
    if (this.unlockListenersAttached || typeof window === 'undefined') {
      return;
    }
    this.unlockListenersAttached = true;
    const resume = (event: Event) => {
      if (!event.isTrusted) {
        return;
      }
      this.userGestureReceived = true;
      this.ensureContext();
      if (this.musicRequested) {
        this.beginMusic();
      }
    };
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

  private beginMusic(): void {
    if (!this.musicRequested || this.musicGain || this.unavailable) {
      return;
    }
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) {
      return;
    }

    try {
      this.musicGain = ctx.createGain();
      this.musicGain.gain.value = MUSIC_TRACK_GAIN;
      this.musicGain.connect(this.masterGain);
    } catch {
      this.stopMusic();
      return;
    }

    void this.loadMusicBuffer(ctx).then(buffer => {
      // The request may have been cancelled (stopMusic()) while the file
      // was loading/decoding; bail out rather than starting stale audio.
      if (!this.musicRequested || !this.musicGain) {
        return;
      }
      if (buffer) {
        this.playMusicBuffer(ctx, buffer);
      } else {
        // Fall back to the generated melody if the recorded track can't be
        // fetched or decoded (e.g. offline, unsupported format).
        this.musicGain.gain.value = 0.14;
        this.scheduleMusicPhrase(ctx);
      }
    });
  }

  /** Fetches and decodes the recorded soundtrack once, caching the result. */
  private loadMusicBuffer(ctx: AudioContext): Promise<AudioBuffer | null> {
    if (this.musicBuffer) {
      return Promise.resolve(this.musicBuffer);
    }
    if (!this.musicBufferPromise) {
      this.musicBufferPromise = fetch(MUSIC_TRACK_URL)
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to fetch soundtrack: ${response.status}`);
          }
          return response.arrayBuffer();
        })
        .then(data => ctx.decodeAudioData(data))
        .then(buffer => {
          this.musicBuffer = buffer;
          return buffer;
        })
        .catch(() => null);
    }
    return this.musicBufferPromise;
  }

  /** Starts a looping buffer source playing the recorded soundtrack. */
  private playMusicBuffer(ctx: AudioContext, buffer: AudioBuffer): void {
    if (!this.musicGain) {
      return;
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.musicGain);
    source.start();
    this.musicSource = source;
  }

  private scheduleMusicPhrase(ctx: AudioContext): void {
    if (!this.musicRequested || !this.musicGain) {
      return;
    }

    const phraseStart = ctx.currentTime + 0.08;
    const notes = [
      { beat: 0, freq: 293.66, duration: 0.7 },
      { beat: 2, freq: 349.23, duration: 0.55 },
      { beat: 3, freq: 392, duration: 0.8 },
      { beat: 5.5, freq: 349.23, duration: 0.55 },
      { beat: 7, freq: 293.66, duration: 1 }
    ];
    const secondsPerBeat = 0.72;

    for (const note of notes) {
      this.musicTone(
        ctx,
        this.musicGain,
        phraseStart + note.beat * secondsPerBeat,
        note.freq,
        note.duration
      );
    }

    this.musicTimer = setTimeout(() => {
      this.musicTimer = null;
      this.scheduleMusicPhrase(ctx);
    }, 7000);
  }

  /** Quiet, rounded plucked-string approximation used only by the soundtrack. */
  private musicTone(
    ctx: AudioContext,
    dest: GainNode,
    startAt: number,
    frequency: number,
    duration: number
  ): void {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequency, startAt);

    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.075, startAt + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

    oscillator.connect(gain);
    gain.connect(dest);
    oscillator.addEventListener('ended', () => {
      this.musicOscillators.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    });
    this.musicOscillators.add(oscillator);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration + 0.02);
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

/**
 * Request the quiet, sparse generated medieval-style soundtrack. Playback
 * begins only after a trusted user gesture and repeated calls do not create
 * additional loops.
 */
export function startMedievalMusic(): void {
  soundManager.startMusic();
}

/** Stop the generated soundtrack and cancel all scheduled music notes. */
export function stopMedievalMusic(): void {
  soundManager.stopMusic();
}

/**
 * Whether the soundtrack has actually started producing sound (i.e. a
 * trusted gesture already unlocked it). False while autoplay is still
 * blocked, even if `startMedievalMusic()` has been requested.
 */
export function isMedievalMusicPlaying(): boolean {
  return soundManager.isMusicPlaying();
}

/** Whether any trusted user gesture (click/key/touch) has been observed yet. */
export function hasReceivedUserGesture(): boolean {
  return soundManager.hasUserGesture();
}

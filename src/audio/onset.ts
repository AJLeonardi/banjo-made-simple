// Strum detector: spectral flux over the banjo's band (80 Hz–2 kHz) with an
// adaptive threshold, or a sudden jump in loudness (catches a re-strum over a
// chord that's still ringing). The metronome click sits above 3 kHz so it
// doesn't trigger either.

import { magnitudeSpectrum } from './fft';

const FRAME = 1024;
const LOW_HZ = 80;
const HIGH_HZ = 2000;
const REFRACTORY = 0.15;

export interface OnsetOptions {
  /** 0 (deaf) .. 1 (twitchy). */
  sensitivity: number;
  /** Minimum seconds between onsets (default 0.15: one strum). Picking uses less, for rolls. */
  refractory?: number;
  /**
   * Compare each frame with the per-bin maximum of this many previous frames (default 1 =
   * plain spectral flux). Picking uses 3: strings that are still ringing make frame-to-frame
   * flux jitter, and a max reference ("SuperFlux") ignores that jitter but not a new note.
   */
  history?: number;
  /** Multiplies the minimum flux for an onset (default 1). Picking with history 3 uses ~0.35. */
  fluxScale?: number;
  /**
   * Time the onset on the differenced signal (the pick's attack transient) instead of raw
   * energy. Raw energy also swells when two close notes beat against each other, which
   * pulls the timestamp early. Picking uses this.
   */
  attackRefine?: boolean;
  /**
   * Also trigger on a sudden loudness jump (default true: catches a re-strum over a chord
   * that's still ringing). Off for picking: beating strings swell like that too, and the
   * SuperFlux reference already catches a re-picked string.
   */
  energyJump?: boolean;
  /**
   * Top of the band watched for onsets (default 2 kHz). Picking watches up to 6 kHz to hear
   * the pick's attack click, which is what marks a repeated note on a still-ringing string.
   * Anything the app itself plays must then stay above 8 kHz or below 90 Hz.
   */
  highHz?: number;
  /**
   * Within the refractory time, let an onset at least 3× stronger than the last one
   * replace it (default false). A faint false trigger then can't hide the real pick right
   * after it. `lastReplaced` tells the caller to drop the previous onset.
   */
  strongerReplaces?: boolean;
}

export class OnsetDetector {
  private prevFrames: Float32Array[] = [];
  private history: number[] = [];
  private lastOnset = -Infinity;
  private lo: number;
  private hi: number;
  lastFlux = 0;
  /** Flux threshold in force at the last frame, and how far the last onset exceeded it. */
  lastThreshold = 0;
  lastOnsetStrength = 0;
  /** True when the last onset returned replaced the one before it (strongerReplaces). */
  lastReplaced = false;
  lastBandRms = 0;

  constructor(private sampleRate: number, public opts: OnsetOptions) {
    this.lo = Math.floor((LOW_HZ * FRAME) / sampleRate);
    this.hi = Math.ceil(((opts.highHz ?? HIGH_HZ) * FRAME) / sampleRate);
  }

  get minRms() {
    // sensitivity 0 → 0.03, 1 → 0.001 (log scale)
    return 0.03 * Math.pow(0.001 / 0.03, this.opts.sensitivity);
  }

  /** Feed the latest audio (ending at time `now`). Returns the onset time if a strum just started. */
  process(samples: Float32Array, now: number): number | null {
    const mag = magnitudeSpectrum(samples, FRAME, FRAME);
    let flux = 0;
    const prev = this.prevFrames;
    for (let b = this.lo; b <= this.hi; b++) {
      const cur = Math.log1p(100 * mag[b]);
      let ref = 0;
      for (const p of prev) if (p[b] > ref) ref = p[b];
      const was = prev.length ? Math.log1p(100 * ref) : cur;
      if (cur > was) flux += cur - was;
    }
    prev.push(mag);
    if (prev.length > (this.opts.history ?? 1)) prev.shift();
    this.lastFlux = flux;

    const sorted = [...this.history].sort((a, b) => a - b);
    const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
    this.history.push(flux);
    if (this.history.length > 40) this.history.shift();

    this.lastBandRms = this.bandRms(mag);
    const loud = this.lastBandRms > this.minRms;
    const minFlux = (this.opts.fluxScale ?? 1) * (6 + 30 * (1 - this.opts.sensitivity));
    this.lastThreshold = Math.max(minFlux, median * 2.5);
    const fluxHit = flux > this.lastThreshold;
    const jumpHit = (this.opts.energyJump ?? true) && this.energyJump(samples, mag) > 1.8 - 0.4 * this.opts.sensitivity;
    const strength = flux / this.lastThreshold;
    const refractory = now - this.lastOnset <= (this.opts.refractory ?? REFRACTORY);
    const replaces = refractory && !!this.opts.strongerReplaces && fluxHit && strength >= 3 * this.lastOnsetStrength;
    if (loud && (fluxHit || jumpHit) && (!refractory || replaces)) {
      const t = this.refine(samples, now);
      this.lastOnset = t;
      this.lastOnsetStrength = strength;
      this.lastReplaced = replaces;
      return t;
    }
    return null;
  }

  /** RMS of the signal within the band (Parseval, corrected for the Hann window). */
  bandRms(mag: Float32Array): number {
    let e = 0;
    for (let k = this.lo; k <= this.hi; k++) e += mag[k] * mag[k];
    return Math.sqrt((2 * e) / (FRAME * FRAME * 0.375));
  }

  /** In-band loudness of the latest frame vs. the frame before it (amplitude ratio). */
  private energyJump(samples: Float32Array, mag: Float32Array): number {
    if (samples.length < 2 * FRAME) return 0;
    const before = magnitudeSpectrum(samples.subarray(0, samples.length - FRAME), FRAME, FRAME);
    let a = 0, b = 0;
    for (let k = this.lo; k <= this.hi; k++) {
      a += mag[k] * mag[k];
      b += before[k] * before[k];
    }
    return b > 0 ? Math.sqrt(a / b) : 0;
  }

  /** Locate the energy rise inside the last ~2048 samples for a sharper timestamp. */
  private refine(samples: Float32Array, now: number): number {
    const hop = 128;
    const region = Math.min(samples.length, 2048);
    const start = samples.length - region;
    const e: number[] = [];
    for (let i = start; i + hop <= samples.length; i += hop) {
      let s = 0;
      if (this.opts.attackRefine)
        for (let j = Math.max(1, i); j < i + hop; j++) s += (samples[j] - samples[j - 1]) ** 2;
      else for (let j = i; j < i + hop; j++) s += samples[j] * samples[j];
      e.push(s);
    }
    const base = Math.min(...e.slice(0, 3));
    const max = Math.max(...e);
    const k = Math.max(0, e.findIndex((x) => x > base + 0.3 * (max - base)));
    return now - (samples.length - (start + k * hop)) / this.sampleRate;
  }
}

// Single-note picking detector: which string(s) did the player just pick?
//
// A banjo rings. When you pick the 2nd string in a roll, the 3rd and 5th strings you
// picked a moment ago are still sounding, so "which pitches are in the spectrum" isn't
// "which note was just played". For every onset we compare the spectrum just *after*
// it with the spectrum just *before* it and keep only what got louder: the new note(s).
// Then each pitch on the fretboard is scored by how much of that new energy sits on its
// harmonics; the best is the note played, and a strong second one (that isn't just an
// overtone of the first) is a pinch partner.
//
// Low notes (the 4th string) barely carry their fundamental on a phone mic, so a low
// candidate can be recognised from its 2nd/3rd harmonics. To keep that from turning a
// high D4 into a low D3 (or vice versa), a candidate an octave below the winner only
// takes over when there is new energy the higher note can't explain (its 3rd harmonic).

import { midiToFreq } from '../music/notes';
import { fft, hann } from './fft';
import { OnsetDetector, OnsetOptions } from './onset';

export const SEMI_LOW = 48; // C3
export const SEMI_HIGH = 100; // E7
const BINS = SEMI_HIGH - SEMI_LOW + 1;

/** Fretboard range we ever try to name: low D (4th string open) .. G5 (1st string, 17th fret). */
export const NOTE_LOW = 50;
export const NOTE_HIGH = 79;

/**
 * Seconds after the onset that the note is analysed (also the feedback delay). Long enough
 * to resolve neighbouring semitones (F# next to the ringing 5th-string G), short enough to
 * fit between 8th notes at 160 bpm.
 */
export const PICK_DELAY = 0.14;
const AFTER_START = 0.008;
const BEFORE_LEN = 0.11;
const BEFORE_GAP = 0.004;
/** Rolls are 8th notes: ≥0.2 s apart even at 150 bpm. Pinches are a single onset. */
export const PICK_REFRACTORY = 0.09;

/** Semitone offsets of harmonics 1..10 (the 7th, 9th sit within the ±40-cent bins). */
const HARMONIC_OFFSETS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((h) => Math.round(12 * Math.log2(h)));
const HARMONIC_WEIGHTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((h) => 1 / Math.sqrt(h));
/** Below A3 the fundamental may be nearly inaudible on a phone mic. */
const LOW_REGISTER = 57;
/** A delta bin below this fraction of the strongest is treated as nothing. */
const DELTA_FLOOR = 0.08;
/** A bin counts as "present" for the octave checks above this. */
const PRESENT = 0.1;
/** Absolute floor for in-range tonal energy (amplitude) to count at all. */
const MIN_LEVEL = 0.002;
/** In-range peak must be at least this × the after-window RMS (a banjo note alone is ~1.4×). */
const IN_RANGE_SHARE = 0.25;
/** A pinch partner needs this fraction of the main note's salience. */
const SECOND_NOTE = 0.3;

export interface PickAnalysis {
  /** New energy per semitone bin (SEMI_LOW..SEMI_HIGH), normalised so the max is 1. */
  delta: Float32Array;
  /** Notes judged to have just been picked, strongest first (usually 1, 2 for a pinch). */
  heard: number[];
  /** Salience of heard[0] (0 if nothing). */
  strength: number;
  /** RMS of the after-onset window. */
  rms: number;
  /**
   * How much of what's sounding after the onset is new: max(after − before) / max(after).
   * A fresh pick is well above 0.3; two close notes beating against each other (which can
   * look like an onset) stay low.
   */
  fresh: number;
}

export interface PickEvent extends PickAnalysis {
  onsetTime: number;
}

const FFT_SIZE = 16384;

/** Peak amplitude per semitone bin of `len` samples starting at `start`. */
export function windowSemis(samples: Float32Array, start: number, len: number, sampleRate: number): Float32Array {
  const out = new Float32Array(BINS);
  start = Math.max(0, Math.floor(start));
  len = Math.min(Math.floor(len), samples.length - start, FFT_SIZE);
  if (len < 256) return out;
  const re = new Float64Array(FFT_SIZE);
  const im = new Float64Array(FFT_SIZE);
  const w = hann(len);
  let wsum = 0;
  for (let i = 0; i < len; i++) {
    re[i] = samples[start + i] * w[i];
    wsum += w[i];
  }
  fft(re, im);
  const half = FFT_SIZE / 2;
  const mag = new Float32Array(half);
  // 2/Σw turns a windowed sinusoid's peak back into its amplitude, so windows of
  // different lengths are comparable.
  const norm = 2 / wsum;
  for (let i = 0; i < half; i++) mag[i] = Math.hypot(re[i], im[i]) * norm;
  const hz = sampleRate / FFT_SIZE;
  for (let i = 0; i < BINS; i++) {
    const f = midiToFreq(SEMI_LOW + i);
    const lo = Math.max(1, Math.floor((f * Math.pow(2, -0.4 / 12)) / hz));
    const hi = Math.min(half - 2, Math.ceil((f * Math.pow(2, 0.4 / 12)) / hz));
    let at = lo;
    for (let b = lo; b <= hi; b++) if (mag[b] > mag[at]) at = b;
    // A maximum on the edge that keeps rising past it is the neighbouring note's skirt.
    const skirt = (at === lo && mag[lo - 1] > mag[lo]) || (at === hi && mag[hi + 1] > mag[hi]);
    out[i] = skirt ? 0 : mag[at];
  }
  return out;
}

const bin = (d: Float32Array, midi: number) => (midi >= SEMI_LOW && midi <= SEMI_HIGH ? d[midi - SEMI_LOW] : 0);
const present = (d: Float32Array, midi: number) => bin(d, midi) >= PRESENT;

/**
 * Harmonic sum: how much new energy sits on this pitch's harmonics (square-root
 * compressed, so one very loud overtone can't dominate).
 */
function salience(d: Float32Array, m: number): number {
  let s = 0;
  for (let h = 0; h < HARMONIC_OFFSETS.length; h++) s += HARMONIC_WEIGHTS[h] * Math.sqrt(bin(d, m + HARMONIC_OFFSETS[h]));
  return s;
}

/**
 * Spectra a candidate is judged on: `d` is the new energy (after − before), `a` the whole
 * after-onset spectrum, both normalised to max 1.
 */
interface Spectra {
  d: Float32Array;
  a: Float32Array;
}

/**
 * Is `m` itself (not just its overtones) sounding enough to be the note played? Checked on
 * the whole after-onset spectrum: re-picking a string that's still ringing barely raises
 * its fundamental (the upper harmonics had decayed more), so the delta alone can miss it.
 * Pinch partners (`strict`) must show their fundamental in the new energy itself.
 */
function fundamentalOk(sp: Spectra, m: number, strict: boolean): boolean {
  if (strict) return bin(sp.d, m) >= (m >= LOW_REGISTER ? 0.25 : 0.1);
  if (m >= LOW_REGISTER) return bin(sp.d, m) >= PRESENT || bin(sp.a, m) >= 0.15;
  return bin(sp.a, m) >= 0.04 || (present(sp.d, m + 12) && present(sp.d, m + 19));
}

/** Harmonics 1..16 (up to SEMI_HIGH), as semitone bins: what a note "explains" in the delta. */
const EXPLAIN_OFFSETS = [...new Set(Array.from({ length: 16 }, (_, i) => Math.round(12 * Math.log2(i + 1))))];
const harmonicBins = (m: number) => new Set(EXPLAIN_OFFSETS.map((o) => m + o).filter((x) => x <= SEMI_HIGH));

/**
 * Would `low` (an octave, a twelfth or two octaves below `m`) be the better answer?
 * Compare how much of the new energy each one's harmonic series explains: `low` must
 * account for clearly more (its odd harmonics, which `m` has no reason to produce).
 * The low fundamental itself can be faint (phone mic, or a still-ringing string picked
 * again), so a missing fundamental is allowed when the evidence is overwhelming.
 */
function lowerExplainsMore(sp: Spectra, m: number, low: number, total: number): boolean {
  if (low < NOTE_LOW) return false;
  const mine = harmonicBins(m);
  const theirs = harmonicBins(low);
  let gain = 0;
  let extraPresent = 0;
  for (const b of theirs) {
    if (mine.has(b)) continue;
    gain += bin(sp.d, b);
    if (present(sp.d, b)) extraPresent++;
  }
  for (const b of mine) if (!theirs.has(b)) gain -= bin(sp.d, b);
  if (extraPresent < 2 || gain < 0.15 * total) return false;
  return fundamentalOk(sp, low, false) || (gain >= 0.3 * total && extraPresent >= 3);
}

function bestCandidate(sp: Spectra, strict: boolean): { m: number; s: number } | null {
  const d = sp.d;
  let best: { m: number; s: number } | null = null;
  for (let m = NOTE_LOW; m <= NOTE_HIGH; m++) {
    if (!fundamentalOk(sp, m, strict)) continue;
    const s = salience(d, m);
    if (!best || s > best.s) best = { m, s };
  }
  if (!best) return null;
  let total = 0;
  for (const v of d) total += v;
  // The harmonic sum can land on an overtone of the note played (its octave or the fifth
  // above that). Walk down while a lower note explains energy the winner can't.
  for (let moved = true; moved; ) {
    moved = false;
    for (const down of [12, 19, 24]) {
      if (lowerExplainsMore(sp, best.m, best.m - down, total)) {
        best = { m: best.m - down, s: salience(d, best.m - down) };
        moved = true;
        break;
      }
    }
  }
  return best;
}

/** The single most likely note in a (non-delta) spectrum, e.g. for the tuner. */
export function strongestNote(semis: Float32Array): number | null {
  const max = Math.max(...semis);
  if (max <= 0) return null;
  const n = semis.map((v) => (v / max < DELTA_FLOOR ? 0 : v / max));
  return bestCandidate({ d: n, a: n }, false)?.m ?? null;
}

/** Analyse the pick whose onset is at sample index `onset` in `samples`. */
export function analyzePick(samples: Float32Array, onset: number, sampleRate: number, maxAfter = PICK_DELAY): PickAnalysis {
  const aStart = onset + AFTER_START * sampleRate;
  const aLen = Math.min(samples.length - aStart, (Math.min(PICK_DELAY, maxAfter) - AFTER_START) * sampleRate);
  const bLen = BEFORE_LEN * sampleRate;
  const bStart = onset - BEFORE_GAP * sampleRate - bLen;
  const after = windowSemis(samples, aStart, aLen, sampleRate);
  const before = bStart >= 0 ? windowSemis(samples, bStart, bLen, sampleRate) : new Float32Array(BINS);

  const delta = new Float32Array(BINS);
  let max = 0;
  for (let i = 0; i < BINS; i++) {
    delta[i] = Math.max(0, after[i] - before[i]);
    if (delta[i] > max) max = delta[i];
  }
  let rms = 0;
  const a0 = Math.max(0, Math.floor(aStart));
  const a1 = Math.min(samples.length, Math.floor(aStart + aLen));
  for (let i = a0; i < a1; i++) rms += samples[i] * samples[i];
  rms = a1 > a0 ? Math.sqrt(rms / (a1 - a0)) : 0;

  const amax = Math.max(...after) || 1;
  const fresh = max / amax;
  // What's sounding in banjo range must be a real share of everything sounding (and above
  // the noise). Otherwise normalising would blow up leakage — e.g. the speaker-mode bass
  // skirting into the lowest bins — into a "note".
  if (max <= 0 || amax < Math.max(MIN_LEVEL, IN_RANGE_SHARE * rms)) return { delta: delta.fill(0), heard: [], strength: 0, rms, fresh };
  for (let i = 0; i < BINS; i++) {
    delta[i] /= max;
    if (delta[i] < DELTA_FLOOR) delta[i] = 0;
  }

  const a = after.map((v) => v / amax);
  const heard: number[] = [];
  const first = bestCandidate({ d: delta, a }, false);
  if (!first) return { delta, heard, strength: 0, rms, fresh };
  heard.push(first.m);

  // Pinch partner: remove the first note's harmonics and look again.
  const rest = delta.slice();
  for (const m of harmonicBins(first.m)) rest[m - SEMI_LOW] = 0;
  const second = bestCandidate({ d: rest, a }, true);
  if (second && second.s >= SECOND_NOTE * first.s && Math.abs(second.m - first.m) !== 12) heard.push(second.m);
  return { delta, heard, strength: first.s, rms, fresh };
}

/**
 * Streaming wrapper: feed the latest audio every ~10 ms; returns a PickEvent once a new
 * onset is PICK_DELAY old.
 */
/**
 * An event needs either this much new energy, or a strong attack (STRONG_ONSET × the onset
 * threshold). Beating between ringing strings has neither; a repeated note on a ringing
 * string adds little new energy but has a sharp pick attack.
 */
export const FRESH_MIN = 0.12;
const STRONG_ONSET = 5;
/** No one re-picks the same note this fast in a roll; a second trigger is the same pick. */
const DOUBLE_TRIGGER = 0.12;

export class PickCore {
  readonly onsets: OnsetDetector;
  private pending: { t: number; strength: number }[] = [];
  private last: PickEvent | null = null;

  constructor(private sampleRate: number, opts: OnsetOptions) {
    this.onsets = new OnsetDetector(sampleRate, { refractory: PICK_REFRACTORY, history: 5, fluxScale: 0.35, attackRefine: true, energyJump: false, highHz: 6000, strongerReplaces: true, ...opts });
  }

  /** `samples` is the most recent audio (≥ 0.25 s), ending at time `now`. */
  feed(samples: Float32Array, now: number): PickEvent | null {
    const onset = this.onsets.process(samples, now);
    if (onset !== null) {
      // A much stronger onset right after a faint one replaces it (see strongerReplaces).
      if (this.onsets.lastReplaced) this.pending.pop();
      this.pending.push({ t: onset, strength: this.onsets.lastOnsetStrength });
    }
    if (!this.pending.length || now < this.pending[0].t + PICK_DELAY) return null;
    const { t, strength } = this.pending.shift()!;
    const idx = samples.length - (now - t) * this.sampleRate;
    if (idx < 0) return null; // stalled too long; the audio is gone
    // A quick next note shouldn't leak into this one's window.
    const next = this.pending.length ? this.pending[0].t - t - 0.005 : PICK_DELAY;
    const ev: PickEvent = { onsetTime: t, ...analyzePick(samples, idx, this.sampleRate, next) };
    if (!ev.heard.length || (ev.fresh < FRESH_MIN && strength < STRONG_ONSET)) return null;
    const prev = this.last;
    if (prev && t - prev.onsetTime < DOUBLE_TRIGGER && ev.heard.every((m) => prev.heard.includes(m))) return null;
    this.last = ev;
    return ev;
  }
}

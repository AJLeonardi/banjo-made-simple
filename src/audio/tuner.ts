// Tuner: which note is ringing, and how many cents sharp or flat.
//
// The note is found with the same harmonic-sum picker the game uses (so a bright string
// whose 2nd harmonic is loudest still reads as the right octave); its frequency is then
// refined from the strongest of its first three harmonics with parabolic interpolation
// on a finely zero-padded spectrum.

import { midiToFreq } from '../music/notes';
import { OPEN, StringNum } from '../music/banjo';
import { fft, hann } from './fft';
import { strongestNote, windowSemis } from './picker';

const SIZE = 32768;

export interface PitchReading {
  midi: number;
  freq: number;
  /** Cents from `midi` (−50..50). */
  cents: number;
  /** RMS of the window: too quiet readings should be ignored. */
  rms: number;
}

export function estimatePitch(samples: Float32Array, sampleRate: number, seconds = 0.3): PitchReading | null {
  const n = Math.min(samples.length, Math.round(sampleRate * seconds));
  const start = samples.length - n;
  let rms = 0;
  for (let i = start; i < samples.length; i++) rms += samples[i] * samples[i];
  rms = Math.sqrt(rms / n);
  if (rms < 0.002) return null;

  const midi = strongestNote(windowSemis(samples, start, n, sampleRate));
  if (midi === null) return null;

  const re = new Float64Array(SIZE);
  const im = new Float64Array(SIZE);
  const w = hann(n);
  for (let i = 0; i < n; i++) re[i] = samples[start + i] * w[i];
  fft(re, im);
  const mag = (k: number) => Math.hypot(re[k], im[k]);
  const hz = sampleRate / SIZE;

  // Strongest of harmonics 1..3, searched within ±60 cents of where it should be.
  let best = { f: 0, m: 0 };
  for (let h = 1; h <= 3; h++) {
    const f = midiToFreq(midi) * h;
    const lo = Math.floor((f * 2 ** (-0.6 / 12)) / hz);
    const hi = Math.ceil((f * 2 ** (0.6 / 12)) / hz);
    let k = lo;
    for (let b = lo; b <= hi; b++) if (mag(b) > mag(k)) k = b;
    const a = mag(k - 1), b = mag(k), c = mag(k + 1);
    const p = a - 2 * b + c !== 0 ? (0.5 * (a - c)) / (a - 2 * b + c) : 0;
    // Prefer the fundamental unless an overtone is clearly stronger.
    const weight = b * (h === 1 ? 1.5 : 1);
    if (weight > best.m) best = { f: ((k + p) * hz) / h, m: weight };
  }
  if (!best.f) return null;
  const exact = 69 + 12 * Math.log2(best.f / 440);
  const near = Math.round(exact);
  return { midi: near, freq: best.f, cents: Math.round((exact - near) * 100), rms };
}

/** The open string a reading is probably tuning (closest open-string pitch). */
export function nearestString(exactMidi: number): StringNum {
  let s: StringNum = 1;
  for (const k of [1, 2, 3, 4, 5] as StringNum[]) if (Math.abs(OPEN[k] - exactMidi) < Math.abs(OPEN[s] - exactMidi)) s = k;
  return s;
}

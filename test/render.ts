// Renders picked notes with the Karplus-Strong synth, one voice per string.
import { OPEN, StringNum } from '../src/music/banjo';
import { pluck, SR } from './synth';
import { addNoise, highpass } from './stream';

/** A picked event: pitches, and (optionally) the strings they're on, so re-picking a string stops its old note. */
export interface N { t: number; midi: number[]; strings?: number[] }

export function render(notes: N[], dur: number, opts: { hp?: number; noise?: number; seed?: number; shape?: 'noise' | 'pick' } = {}) {
  let buf = new Float32Array(Math.round(SR * dur));
  notes.forEach((n, i) =>
    n.midi.forEach((m, j) => {
      const s = n.strings?.[j] ?? stringOf(m);
      // Picking a string again stops what it was playing (5 ms damp), like a real string.
      const next = notes.slice(i + 1).find((x) => x.midi.some((mm, k) => (x.strings?.[k] ?? stringOf(mm)) === s));
      const tmp = new Float32Array(buf.length);
      pluck(tmp, Math.round(SR * n.t), m, 0.25, (opts.seed ?? 1) * 97 + i * 7 + j, 0.997, opts.shape ?? 'pick');
      const end = next ? Math.round(SR * next.t) : tmp.length;
      const fade = Math.round(SR * 0.005);
      for (let k = Math.max(0, end - fade); k < tmp.length; k++) tmp[k] *= k >= end ? 0 : (end - k) / fade;
      for (let k = 0; k < buf.length; k++) buf[k] += tmp[k];
    }),
  );
  if (opts.hp) buf = highpass(buf, opts.hp);
  addNoise(buf, opts.noise ?? 0.002, opts.seed ?? 1);
  return buf;
}

/** Default string for a pitch when a test doesn't say: lowest fret, first position. */
export function stringOf(m: number): StringNum {
  if (m === OPEN[5]) return 5;
  for (const s of [4, 3, 2, 1] as StringNum[]) if (m - OPEN[s] >= 0 && m - OPEN[s] <= 3) return s;
  return 1;
}


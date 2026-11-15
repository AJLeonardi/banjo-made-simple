import { describe, expect, it } from 'vitest';
import { estimatePitch } from '../src/audio/tuner';
import { OPEN, StringNum } from '../src/music/banjo';
import { pluck, SR } from './synth';
import { addNoise, highpass } from './stream';

function ring(midi: number, seed: number, hp = 0) {
  let buf = new Float32Array(Math.round(SR * 0.8));
  pluck(buf, Math.round(SR * 0.05), midi, 0.3, seed, 0.998, 'pick');
  if (hp) buf = highpass(buf, hp);
  addNoise(buf, 0.002, seed);
  return buf.subarray(0, Math.round(SR * 0.5));
}

describe('tuner', () => {
  it('reads each open string within ±6 cents, in tune and 25 cents sharp/flat', () => {
    for (const s of [1, 2, 3, 4, 5] as StringNum[])
      for (const off of [-0.25, 0, 0.25])
        for (const hp of [0, 250]) {
          const r = estimatePitch(ring(OPEN[s] + off, s * 7, hp), SR)!;
          expect(r, `string ${s} ${off}`).not.toBeNull();
          expect(r.midi, `string ${s} ${off} hp ${hp}`).toBe(OPEN[s]);
          expect(Math.abs(r.cents - off * 100), `string ${s} ${off} hp ${hp}: ${r.cents}`).toBeLessThanOrEqual(6);
        }
  });

  it('says nothing in silence', () => {
    expect(estimatePitch(new Float32Array(SR * 0.4), SR)).toBeNull();
  });
});

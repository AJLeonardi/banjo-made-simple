import { describe, expect, it } from 'vitest';
import { PickCore, PickEvent } from '../src/audio/picker';
import { OPEN, StringNum } from '../src/music/banjo';
import { SR } from './synth';
import { addNoise, stream } from './stream';
import { N, render } from './render';

function detect(buf: Float32Array) {
  const core = new PickCore(SR, { sensitivity: 0.6 });
  return stream<PickEvent>(buf, (s, now) => core.feed(s, now));
}

/** Match each played note to the detected event closest in time (±40 ms). */
function score(notes: N[], events: PickEvent[]) {
  const misses: string[] = [];
  for (const n of notes) {
    const ev = events.find((e) => Math.abs(e.onsetTime - n.t) < 0.04);
    if (!ev) misses.push(`${n.midi} @${n.t.toFixed(2)}: no onset`);
    else if (!n.midi.every((m) => ev.heard.includes(m))) misses.push(`${n.midi} @${n.t.toFixed(2)}: heard ${ev.heard}`);
  }
  return misses;
}

const pos = (s: StringNum, f: number) => OPEN[s] + f;

// Forward roll T I M T I M T M over a chord shape, frets per string 1..4.
function forwardRoll(frets: Record<1 | 2 | 3 | 4, number>, bars: number, start: number, gap: number): N[] {
  const pattern: StringNum[] = [3, 2, 1, 5, 2, 1, 5, 1];
  const out: N[] = [];
  for (let b = 0; b < bars; b++)
    pattern.forEach((s, i) => out.push({ t: start + (b * 8 + i) * gap, midi: [s === 5 ? OPEN[5] : pos(s, frets[s as 1 | 2 | 3 | 4])], strings: [s] }));
  return out;
}

describe('pick detector', () => {
  it('names every note on strings 1–4, frets 0–7, and the 5th string, played alone', () => {
    const misses: string[] = [];
    for (const s of [1, 2, 3, 4] as StringNum[])
      for (let f = 0; f <= 7; f++) {
        const notes = [{ t: 0.3, midi: [pos(s, f)] }];
        misses.push(...score(notes, detect(render(notes, 0.8, { seed: s * 10 + f }))));
      }
    const fifth = [{ t: 0.3, midi: [OPEN[5]] }];
    misses.push(...score(fifth, detect(render(fifth, 0.8))));
    expect(misses).toEqual([]);
  });

  for (const [shape, limit] of [['pick', 0.02], ['noise', 0.07]] as const)
    it(`follows forward rolls with earlier notes still ringing (G, C, D7 at 100 and 140 bpm, ${shape} plucks)`, () => {
      const shapes = [
        { 1: 0, 2: 0, 3: 0, 4: 0 },
        { 1: 2, 2: 1, 3: 0, 4: 2 },
        { 1: 4, 2: 1, 3: 2, 4: 0 },
      ] as const;
      let total = 0;
      const misses: string[] = [];
      for (const bpm of [100, 140])
        shapes.forEach((sh, k) => {
          const notes = forwardRoll(sh, 2, 0.3, 30 / bpm);
          total += notes.length;
          misses.push(...score(notes, detect(render(notes, 0.3 + notes.length * (30 / bpm) + 0.3, { seed: k + bpm, shape }))));
        });
      console.log(`${shape} roll misses ${misses.length}/${total}`, misses.slice(0, 10));
      expect(misses.length / total).toBeLessThan(limit);
    });

  it('still works when the mic barely hears low fundamentals', () => {
    const notes: N[] = [];
    // A melody walking across all four strings, some repeated notes.
    const seq = [pos(4, 0), pos(3, 0), pos(4, 2), pos(3, 2), pos(2, 0), pos(2, 1), pos(1, 0), pos(1, 2), pos(4, 0), pos(4, 0), pos(3, 0), OPEN[5]];
    seq.forEach((m, i) => notes.push({ t: 0.3 + i * 0.3, midi: [m] }));
    const misses = score(notes, detect(render(notes, 0.3 + seq.length * 0.3 + 0.3, { hp: 250, seed: 3 })));
    expect(misses).toEqual([]);
  });

  it('hears both notes of a pinch (5th + 1st, and 3rd + 1st)', () => {
    const notes = [
      { t: 0.3, midi: [OPEN[5], OPEN[1]] },
      { t: 0.9, midi: [pos(3, 0), pos(1, 0)] },
      { t: 1.5, midi: [pos(4, 0), pos(1, 2)] },
    ];
    expect(score(notes, detect(render(notes, 2.1)))).toEqual([]);
  });

  it('a wrong string is wrong: low D (4th) is not high D (1st), B on 2nd is not C', () => {
    const lowD = [{ t: 0.3, midi: [pos(4, 0)] }];
    const ev = detect(render(lowD, 0.8, { hp: 250 }));
    expect(ev[0].heard).toContain(50);
    expect(ev[0].heard).not.toContain(62);
    const highD = [{ t: 0.3, midi: [pos(1, 0)] }];
    const ev2 = detect(render(highD, 0.8, { hp: 250 }));
    expect(ev2[0].heard).toEqual([62]);
    const b = [{ t: 0.3, midi: [pos(2, 0)] }];
    expect(detect(render(b, 0.8))[0].heard).toEqual([59]);
  });

  it('hears repeated notes on the same string (0.25 s apart), on every string', () => {
    const misses: string[] = [];
    for (const s of [1, 2, 3, 4] as StringNum[])
      for (const hp of [0, 250]) {
        const notes = [0, 1, 2, 3].map((i) => ({ t: 0.3 + i * 0.25, midi: [pos(s, 0)], strings: [s] }));
        misses.push(...score(notes, detect(render(notes, 1.6, { hp, seed: s + hp }))).map((m) => `string ${s} hp ${hp}: ${m}`));
      }
    expect(misses).toEqual([]);
  });

  it('no phantom notes while F# (1st string) and the 5th-string G ring and beat together', () => {
    const notes = [{ t: 0.3, midi: [pos(1, 4), OPEN[5]], strings: [1, 5] }];
    const ev = detect(render(notes, 2.5));
    expect(ev.length).toBe(1);
  });

  // Speaker-mode backing: sine bass E1–B2 with a 30 ms attack, on beats 1 and 3.
  function addBass(buf: Float32Array, start: number, beat: number, midis: number[], gain = 0.3) {
    midis.forEach((m, i) => {
      const f = 440 * 2 ** ((m - 69) / 12);
      const t0 = Math.round(SR * (start + i * 2 * beat));
      const len = Math.round(SR * beat * 1.6);
      for (let k = 0; k < len && t0 + k < buf.length; k++) {
        const t = k / SR;
        const env = Math.min(1, t / 0.03) * Math.exp(-t * 2);
        buf[t0 + k] += gain * env * Math.sin(2 * Math.PI * f * t);
      }
    });
  }

  it('speaker-mode bass alone is never heard as a picked note', () => {
    const buf = new Float32Array(SR * 4);
    addBass(buf, 0.3, 0.5, [43, 38, 36, 31, 38, 33, 43, 38]); // G2 D2 C2 G1 D2 A1 …
    addNoise(buf, 0.002);
    expect(detect(buf)).toEqual([]);
  });

  it('a roll is still read correctly with the speaker-mode bass underneath', () => {
    const notes = forwardRoll({ 1: 0, 2: 0, 3: 0, 4: 0 }, 2, 0.3, 0.25);
    const buf = render(notes, 0.3 + notes.length * 0.25 + 0.3, { seed: 9 });
    addBass(buf, 0.3, 0.5, [43, 38, 43, 38]);
    expect(score(notes, detect(buf))).toEqual([]);
  });

  it('ignores silence and quiet noise', () => {
    const buf = new Float32Array(SR);
    addNoise(buf, 0.004);
    expect(detect(buf)).toEqual([]);
  });
});

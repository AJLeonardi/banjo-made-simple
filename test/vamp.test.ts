// Vamping = closed chord shapes chopped on beats 2 and 4, muted ~0.12 s after the strike.
import { describe, expect, it } from 'vitest';
import { ListenerCore, StrumEvent } from '../src/audio/listener';
import { judge } from '../src/audio/matcher';
import { CHORD_BY_ID, Voicing } from '../src/music/library';
import { pluck, SR } from './synth';
import { addNoise, stream } from './stream';

/** Chop: strum strings 4→1 quickly (no 5th string), then the left hand releases (mute). */
function chops(seq: { t: number; v: Voicing }[], dur: number, mute = 0.12, seed = 1) {
  const buf = new Float32Array(Math.round(SR * dur));
  seq.forEach(({ t, v }, i) => {
    const tmp = new Float32Array(buf.length);
    v.midi.forEach((m, j) => pluck(tmp, Math.round(SR * (t + j * 0.008)), m, 0.25, seed * 131 + i * 11 + j, 0.996, 'pick'));
    const end = Math.round(SR * (t + mute));
    for (let k = end; k < tmp.length; k++) tmp[k] *= Math.exp(-(k - end) / (SR * 0.01));
    for (let k = 0; k < buf.length; k++) buf[k] += tmp[k];
  });
  addNoise(buf, 0.002, seed);
  return buf;
}

/** Run the strum listener like the vamp screen: first check at 0.14 s, accept on the first correct check. */
function listen(buf: Float32Array, targets: { t: number; v: Voicing }[], checkPosition: boolean) {
  const core = new ListenerCore(SR, { sensitivity: 0.6 });
  core.firstEval = 0.14;
  const results = new Map<number, string>();
  stream<StrumEvent>(buf, (s, now) => {
    const ev = core.feed(s, now);
    if (!ev) return null;
    const target = targets.find((x) => Math.abs(x.t - ev.onsetTime) < 0.05);
    if (!target) return ev;
    const j = judge(ev.analysis, target.v, { checkPosition, minScore: 0.6, positionTolerance: 0.015 });
    if (j.verdict === 'correct') {
      results.set(target.t, 'correct');
      core.endGesture(now, 0.15);
    } else if (ev.final && !results.has(target.t)) results.set(target.t, j.verdict);
    return ev;
  });
  return targets.map((x) => results.get(x.t) ?? 'no onset');
}

const closed = (chord: string) => CHORD_BY_ID[chord].voicings.filter((v) => !v.hasOpen && v.minFret >= 2 && v.maxFret <= 12);

describe('vamping (chord chops)', () => {
  it('recognises every closed major / 7th / minor shape (frets 2–12) as a short muted chop', () => {
    const misses: string[] = [];
    let total = 0;
    for (const name of ['G', 'C', 'D', 'A', 'E', 'F', 'G7', 'D7', 'A7', 'E7', 'Am', 'Em', 'Dm', 'Bm'])
      for (const v of closed(name)) {
        total++;
        const seq = [{ t: 0.3, v }];
        const r = listen(chops(seq, 0.9, 0.12, v.position + name.length), seq, false)[0];
        if (r !== 'correct') misses.push(`${v.id} [${v.frets}] ${r}`);
      }
    console.log(`vamp chord misses ${misses.length}/${total}`, misses);
    expect(misses.length / total).toBeLessThan(0.05);
  });

  // Vamp steps judge the chord, not the neck position: the flash-cards position heuristic
// discounts G4 as "the open 5th string", which vampers don't play, so it misreads shapes
// like C [5,5,5,5]. The fretboard shows the shape to use either way.
  it('follows a G–C–D–G vamp on beats 2 and 4 at 120 bpm', () => {
    const beat = 0.5;
    const shapes = ['G', 'G', 'C', 'C', 'D', 'D', 'G', 'G'].map((c) => closed(c).find((v) => v.minFret >= 3 && v.minFret <= 8)!);
    const seq = shapes.map((v, i) => ({ t: 0.3 + beat * (1 + 2 * i), v }));
    const res = listen(chops(seq, seq[seq.length - 1].t + 0.6), seq, false);
    expect(res).toEqual(Array(8).fill('correct'));
  });

  it('a wrong chord chop is not correct', () => {
    const g = closed('G')[0];
    const c = closed('C')[0];
    const seq = [{ t: 0.3, v: c }];
    const r = listen(chops(seq, 0.9), [{ t: 0.3, v: g }], false)[0];
    expect(r).not.toBe('correct');
  });
});

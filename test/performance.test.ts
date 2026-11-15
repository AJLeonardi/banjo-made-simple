import { describe, expect, it } from 'vitest';
import { notesTab, rollTab, ROLLS, vampTab, VAMP } from '../src/content/exercises';
import { Performance } from '../src/game/performance';
import { OPEN } from '../src/music/banjo';
import { pitchOf } from '../src/music/tab';

const G3 = OPEN[3], B3 = OPEN[2], D4 = OPEN[1], G4 = OPEN[5];

describe('wait mode', () => {
  it('waits for the right note, records wrong attempts and what was heard', () => {
    const p = new Performance(notesTab([{ s: 3, rh: 'T' }, { s: 2, rh: 'I' }]), { mode: 'wait', secPerBeat: 0.5 });
    expect(p.current!.pitches).toEqual([G3]);
    expect(p.pick(10, [D4]).result).toBe('wrong');
    expect(p.current!.heard).toEqual([D4]);
    expect(p.pick(11, [G3]).result).toBe('hit');
    expect(p.current!.pitches).toEqual([B3]);
    expect(p.pick(12, [B3]).result).toBe('hit');
    expect(p.done).toBe(true);
    expect(p.summary().accuracy).toBeCloseTo(2 / 3);
  });

  it('the same wrong sound repeating (a ringing chord re-triggering) is one try', () => {
    const p = new Performance(vampTab([{ chord: 'G', frets: VAMP.G }]), { mode: 'wait', secPerBeat: 0.5 });
    p.strum(2.0, 'wrongChord', 'C', true);
    p.strum(2.6, 'wrongChord', 'C', true);
    expect(p.current!.attempts).toBe(1);
    p.strum(5.0, 'wrongChord', 'C', true); // a new try, later
    p.strum(5.3, 'wrongChord', 'D', true); // a different wrong chord
    expect(p.current!.attempts).toBe(3);
  });

  it('the chord or note just played right, still ringing, is not a wrong try for the next one', () => {
    const p = new Performance(vampTab([{ chord: 'C', frets: VAMP.C }, { chord: 'D', frets: VAMP.D }]), { mode: 'wait', secPerBeat: 0.5 });
    p.strum(5.0, 'correct', 'C', false); // hits the first C
    expect(p.strum(5.9, 'wrongChord', 'C', true).result).toBe('ignored'); // C ringing on
    expect(p.strum(9.0, 'wrongChord', 'C', true).result).toBe('wrong'); // a real wrong try later
    const q = new Performance(notesTab([{ s: 3, rh: 'T' }, { s: 2, rh: 'I' }]), { mode: 'wait', secPerBeat: 0.5 });
    q.pick(1, [G3]);
    expect(q.pick(1.4, [G3]).result).toBe('ignored');
  });

  it('judges a slide by following the pitch, and asks again when it does not arrive', () => {
    const p = new Performance(notesTab([{ s: 3, f: 2, rh: 'T' }, { s: 3, f: 4, rh: 'T', tech: 's' }, { s: 2, rh: 'I' }]), { mode: 'wait', secPerBeat: 0.5 });
    const A3 = G3 + 2, B3s = G3 + 4;
    expect(p.pick(1, [A3]).result).toBe('hit');
    expect(p.current!.tech).toBe('s');
    expect(p.pitch(1.2, A3).result).toBe('ignored'); // still on fret 2
    expect(p.pitch(1.5, B3s).result).toBe('hit'); // slid to 4
    expect(p.current!.pitches).toEqual([B3]);
    // Second try: the slide never gets there → back to the starting note.
    const q = new Performance(notesTab([{ s: 3, f: 2, rh: 'T' }, { s: 3, f: 4, rh: 'T', tech: 's' }]), { mode: 'wait', secPerBeat: 0.5 });
    q.pick(1, [A3]);
    expect(q.pitch(4, A3).result).toBe('wrong');
    expect(q.current!.pitches).toEqual([A3]);
    expect(q.targets[1].attempts).toBe(1);
    q.pick(5, [A3]);
    expect(q.pitch(5.3, B3s).result).toBe('hit');
    expect(q.done).toBe(true);
  });

  it('a hammer-on or pull-off onset on the target pitch counts; re-picking the start restarts the clock', () => {
    const p = new Performance(notesTab([{ s: 3, rh: 'T' }, { s: 3, f: 2, rh: 'T', tech: 'h' }]), { mode: 'wait', secPerBeat: 0.5 });
    p.pick(1, [G3]);
    expect(p.pick(3.0, [G3]).result).toBe('ignored'); // picked open again
    expect(p.pitch(4.0, G3).result).toBe('ignored'); // within 2.5 s of the re-pick
    expect(p.pick(4.2, [G3 + 2]).result).toBe('hit'); // the hammer
  });

  it('technique notes are shown but not judged in tempo mode', () => {
    const p = new Performance(notesTab([{ s: 3, f: 2, rh: 'T' }, { s: 3, f: 4, rh: 'T', tech: 's' }]), { mode: 'tempo', secPerBeat: 0.5 });
    expect(p.targets[1].judged).toBe(false);
  });

  it('a pinch needs both notes; one of them is partial', () => {
    const p = new Performance(notesTab([{ s: 5, rh: 'T', with: { s: 1, rh: 'M' } }]), { mode: 'wait', secPerBeat: 0.5 });
    expect(p.pick(0, [G4]).result).toBe('partial');
    expect(p.pick(1, [D4, G4]).result).toBe('hit');
  });

  it('waits for a technique note after its starting note', () => {
    const p = new Performance(notesTab([{ s: 3, f: 2, rh: 'T' }, { s: 3, f: 3, rh: 'T', tech: 's' }, { s: 2, rh: 'I' }]), { mode: 'wait', secPerBeat: 0.5 });
    p.pick(0, [G3 + 2]);
    expect(p.current!.tech).toBe('s');
    expect(p.current!.pitches).toEqual([G3 + 3]);
  });

  it('chord targets ignore picks, and only a final wrong check counts', () => {
    const p = new Performance(vampTab([{ chord: 'G', frets: VAMP.G }]), { mode: 'wait', secPerBeat: 0.5 });
    expect(p.pick(0, [G3]).result).toBe('ignored');
    expect(p.strum(0, 'wrongChord', 'C', false).result).toBe('ignored');
    expect(p.strum(0, 'wrongChord', 'C', true).result).toBe('wrong');
    expect(p.current!.heardChord).toBe('C');
    expect(p.strum(1, 'correct', 'G', false).result).toBe('hit');
  });
});

describe('tempo mode', () => {
  const roll = rollTab(ROLLS.forward, ['G']); // 8 eighth notes
  const spb = 0.5; // 120 bpm → 8ths 0.25 s apart

  it('matches notes in their window, scores misses and wrong notes', () => {
    const p = new Performance(roll, { mode: 'tempo', secPerBeat: spb });
    const ts = p.targets;
    // Play all but #2 (miss) and #5 (wrong note), slightly late.
    ts.forEach((t, i) => {
      if (i === 2) return;
      p.pick(t.time + 0.03, i === 5 ? [OPEN[4]] : t.pitches);
    });
    p.advance(10);
    const s = p.summary();
    expect(s.hits).toBe(6);
    expect(s.misses).toBe(1);
    expect(s.wrong).toBe(1);
    expect(ts[5].heard).toEqual([OPEN[4]]);
    expect(s.accuracy).toBeCloseTo(6 / 8);
    expect(s.timing!).toBeCloseTo(0.03);
  });

  it('a note far outside the window is a stray, not a penalty', () => {
    const p = new Performance(roll, { mode: 'tempo', secPerBeat: spb });
    expect(p.pick(p.targets[0].time - 0.3, [G3]).result).toBe('stray');
    expect(p.pick(p.targets[7].time + 0.4, [G3]).result).toBe('stray');
  });

  it('a wrong note then the right one inside the window is a hit', () => {
    const p = new Performance(roll, { mode: 'tempo', secPerBeat: spb });
    const t0 = p.targets[0];
    p.pick(t0.time - 0.05, [D4]);
    expect(p.pick(t0.time + 0.02, t0.pitches).result).toBe('hit');
  });

  it('does not close a target before its verdict could arrive', () => {
    const p = new Performance(roll, { mode: 'tempo', secPerBeat: spb });
    const t0 = p.targets[0];
    expect(p.advance(t0.time + 0.15)).toEqual([]);
    expect(p.advance(t0.time + 1).length).toBeGreaterThan(0);
    expect(t0.outcome).toBe('miss');
  });

  it('vamp chops: correct chords hit; timing-only mode accepts any strum', () => {
    const tab = vampTab([{ chord: 'G', frets: VAMP.G }, { chord: 'C', frets: VAMP.C }]);
    const p = new Performance(tab, { mode: 'tempo', secPerBeat: spb });
    const [a, b, c, d] = p.targets;
    p.strum(a.time, 'correct', 'G', false);
    p.strum(b.time + 0.05, 'wrongChord', 'D', true);
    p.strum(c.time, 'partial', null, true);
    p.advance(100);
    expect([a.outcome, b.outcome, c.outcome, d.outcome]).toEqual(['hit', 'wrong', 'partial', 'miss']);
    const q = new Performance(tab, { mode: 'tempo', secPerBeat: spb, chordTimingOnly: true });
    q.targets.forEach((t) => q.strum(t.time, 'unclear', null, true));
    q.advance(100);
    expect(q.summary().accuracy).toBe(1);
  });

  it('pick events from a strum do not disturb chord targets', () => {
    const p = new Performance(vampTab([{ chord: 'G', frets: VAMP.G }]), { mode: 'tempo', secPerBeat: spb });
    expect(p.pick(p.targets[0].time, [pitchOf(p.targets[0].event.notes[0])]).result).toBe('stray');
  });
});

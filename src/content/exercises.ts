// Small builders for lesson exercises: roll patterns over chords, single notes, chord drills.

import { RightHand, StringNum } from '../music/banjo';
import { Frets } from '../music/library';
import { fretOn, LeftFinger, rollShape, shapeFingers, Tab, TabEvent, TabNote, Tech, voicingNotes } from '../music/tab';

/** One roll step: string + picking finger; [s, rh, s2, rh2] for a pinch. */
export type RollStep = [StringNum, RightHand] | [StringNum, RightHand, StringNum, RightHand];

export const ROLLS = {
  /** T I T M (strings 3 2 5 1), twice per bar. */
  alternatingThumb: [[3, 'T'], [2, 'I'], [5, 'T'], [1, 'M'], [4, 'T'], [2, 'I'], [5, 'T'], [1, 'M']] as RollStep[],
  /** T I M T I M T M (strings 3 2 1 5 2 1 5 1). */
  forward: [[3, 'T'], [2, 'I'], [1, 'M'], [5, 'T'], [2, 'I'], [1, 'M'], [5, 'T'], [1, 'M']] as RollStep[],
  /** M I T M I T M I (strings 1 2 5 1 2 5 1 2). */
  backward: [[1, 'M'], [2, 'I'], [5, 'T'], [1, 'M'], [2, 'I'], [5, 'T'], [1, 'M'], [2, 'I']] as RollStep[],
  /** T I M T M I T M (strings 3 2 1 5 1 2 3 1). */
  forwardReverse: [[3, 'T'], [2, 'I'], [1, 'M'], [5, 'T'], [1, 'M'], [2, 'I'], [3, 'T'], [1, 'M']] as RollStep[],
  /** I M T I M T I M (strings 2 1 5 2 1 5 2 1). */
  indexLeading: [[2, 'I'], [1, 'M'], [5, 'T'], [2, 'I'], [1, 'M'], [5, 'T'], [2, 'I'], [1, 'M']] as RollStep[],
  /** M T I M T I M T (strings 1 3 2 1 3 2 1 5). */
  middleLeading: [[1, 'M'], [3, 'T'], [2, 'I'], [1, 'M'], [3, 'T'], [2, 'I'], [1, 'M'], [5, 'T']] as RollStep[],
  /** Thumb then pinch: T3, pinch T5+M1 (bum-pinch), twice per bar as quarter notes. */
  bumPinch: [[3, 'T'], [5, 'T', 1, 'M'], [4, 'T'], [5, 'T', 1, 'M']] as RollStep[],
};

const lhOn = (shape: Frets, s: StringNum): LeftFinger | undefined => (s === 5 ? undefined : shapeFingers(shape)[4 - s]);

function note(shape: Frets, s: StringNum, rh: RightHand): TabNote {
  return { string: s, fret: fretOn(shape, s), rh, lh: lhOn(shape, s) };
}

/**
 * A roll pattern repeated over a chord per bar. `stepBeats` is the length of one step
 * (0.5 = 8th notes; 1 = quarter notes for slow drills).
 */
export function rollTab(pattern: RollStep[], chords: string[], stepBeats = 0.5, beatsPerBar = 4): Tab {
  const events: TabEvent[] = [];
  const perBar = Math.round(beatsPerBar / stepBeats);
  chords.forEach((chord, bar) => {
    const shape = rollShape(chord);
    for (let i = 0; i < perBar; i++) {
      const step = pattern[i % pattern.length];
      const notes = [note(shape, step[0], step[1])];
      if (step.length === 4) notes.push(note(shape, step[2], step[3]));
      events.push({ beat: bar * beatsPerBar + i * stepBeats, dur: stepBeats, kind: 'pick', notes });
    }
  });
  return { beatsPerBar, bars: chords.length, chords, events, parts: [{ name: 'A', startBar: 0, bars: chords.length }] };
}

export interface SingleNote {
  s: StringNum;
  f?: number;
  rh: RightHand;
  lh?: LeftFinger;
  tech?: Tech;
  /** Pinch partner. */
  with?: { s: StringNum; f?: number; rh: RightHand; lh?: LeftFinger };
  beats?: number;
}

/** A sequence of single notes (one per beat by default), over a chord. */
export function notesTab(notes: SingleNote[], chord = 'G', beatsPerBar = 4): Tab {
  const events: TabEvent[] = [];
  let beat = 0;
  for (const n of notes) {
    const d = n.beats ?? 1;
    const ns: TabNote[] = [{ string: n.s, fret: n.f ?? 0, rh: n.rh, lh: n.lh ?? (n.f ? (Math.min(4, n.f) as LeftFinger) : undefined), tech: n.tech }];
    if (n.with) ns.push({ string: n.with.s, fret: n.with.f ?? 0, rh: n.with.rh, lh: n.with.lh });
    events.push({ beat, dur: d, kind: 'pick', notes: ns });
    beat += d;
  }
  const bars = Math.max(1, Math.ceil(beat / beatsPerBar));
  return { beatsPerBar, bars, chords: Array(bars).fill(chord), events, parts: [{ name: 'A', startBar: 0, bars }] };
}

/** Chord drill: one strum (or chop) per event, `beatsEach` apart. */
export function chordTab(items: { chord: string; frets?: Frets }[], style: 'strum' | 'chop', beatsEach = 4, beatsPerBar = 4): Tab {
  const events: TabEvent[] = items.map((it, i) => {
    const frets = it.frets ?? rollShape(it.chord);
    return { beat: i * beatsEach, dur: beatsEach, kind: 'chord', chord: it.chord, frets, notes: voicingNotes(frets), style };
  });
  const bars = Math.max(1, Math.ceil((items.length * beatsEach) / beatsPerBar));
  const chords = Array.from({ length: bars }, (_, b) => items[Math.min(items.length - 1, Math.floor((b * beatsPerBar) / beatsEach))].chord);
  return { beatsPerBar, bars, chords, events, parts: [{ name: 'A', startBar: 0, bars }] };
}

/** Vamp drill: chops on 2 and 4 over a chord per bar, with given closed shapes. */
export function vampTab(bars: { chord: string; frets: Frets }[], beatsPerBar = 4): Tab {
  const events: TabEvent[] = [];
  bars.forEach((b, i) => {
    for (const beat of beatsPerBar === 3 ? [1, 2] : [1, 3])
      events.push({ beat: i * beatsPerBar + beat, dur: 0.5, kind: 'chord', chord: b.chord, frets: b.frets, notes: voicingNotes(b.frets), style: 'chop' });
  });
  return { beatsPerBar, bars: bars.length, chords: bars.map((b) => b.chord), events, parts: [{ name: 'A', startBar: 0, bars: bars.length }] };
}

/** Repeat a list of notes n times (for drills). */
export const times = <T,>(n: number, xs: T[]): T[] => Array.from({ length: n }, () => xs).flat();

/** Closed vamp shapes used in the backup course. */
export const VAMP = {
  G: [5, 4, 3, 5] as Frets, // "F shape" G, frets 3–5
  C: [5, 5, 5, 5] as Frets, // barre-ish C at 5 (G C E G)
  D: [7, 7, 7, 7] as Frets, // barre D at 7
  D7: [10, 7, 7, 7] as Frets,
};

/** "Open G Ramble": an original 8-bar piece on open strings only (course 1). */
export function openGRamble(): Tab {
  const bars: RollStep[][] = [
    [[3, 'T'], [2, 'I'], [1, 'M'], [5, 'T']],
    [[3, 'T'], [5, 'T', 1, 'M'], [4, 'T'], [5, 'T', 1, 'M']],
    [[2, 'I'], [1, 'M'], [5, 'T'], [1, 'M']],
    [[3, 'T'], [5, 'T', 1, 'M'], [3, 'T'], [5, 'T', 1, 'M']],
    [[4, 'T'], [2, 'I'], [1, 'M'], [5, 'T']],
    [[3, 'T'], [5, 'T', 1, 'M'], [4, 'T'], [5, 'T', 1, 'M']],
    [[2, 'I'], [3, 'T'], [1, 'M'], [5, 'T']],
    [[3, 'T', 1, 'M']],
  ];
  const events: TabEvent[] = [];
  const g = rollShape('G');
  bars.forEach((steps, b) =>
    steps.forEach((st, i) => {
      const notes = [note(g, st[0], st[1])];
      if (st.length === 4) notes.push(note(g, st[2], st[3]));
      events.push({ beat: b * 4 + i, dur: steps.length === 1 ? 4 : 1, kind: 'pick', notes });
    }),
  );
  return { beatsPerBar: 4, bars: 8, chords: Array(8).fill('G'), events, parts: [{ name: 'A', startBar: 0, bars: 8 }] };
}

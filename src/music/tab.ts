// Tablature: what to play, when, and with which fingers. One Tab drives the scrolling
// highway, the fretboard ("where your fingers go"), scoring, and the synthesized banjo.

import { OPEN, RightHand, StringNum } from './banjo';
import { CHORD_BY_ID, Frets } from './library';

/** Hammer-on, pull-off or slide *into* this note from the previous note on the same string. */
export type Tech = 'h' | 'p' | 's';

export type LeftFinger = 1 | 2 | 3 | 4;

export interface TabNote {
  string: StringNum;
  fret: number;
  /** Picking-hand finger. */
  rh?: RightHand;
  /** Fretting-hand finger (1 index … 4 pinky); none for open strings. */
  lh?: LeftFinger;
  /** Sounded by the left hand, not picked: shown, but not judged (the mic can't hear a clean attack). */
  tech?: Tech;
  /** Part of the melody (drawn bolder in Scruggs arrangements). */
  melody?: boolean;
}

export type TabEventKind = 'pick' | 'chord';

export interface TabEvent {
  /** Position in beats from the start of the tab. */
  beat: number;
  /** Length in beats (until the next event, for display/synth). */
  dur: number;
  kind: TabEventKind;
  /** pick: the string(s) picked together (2 = pinch). chord: the voicing's strings. */
  notes: TabNote[];
  /** chord events: the chord (library id) and voicing frets for strings [4,3,2,1]. */
  chord?: string;
  frets?: Frets;
  /** Chord events: chop (vamp: muted right after) or strum (let ring). */
  style?: 'chop' | 'strum';
}

export interface TabPart {
  name: string;
  startBar: number;
  bars: number;
}

export interface Tab {
  beatsPerBar: number;
  bars: number;
  /** Chord name per bar (for the backing band and the chord line above the highway). */
  chords: string[];
  events: TabEvent[];
  parts: TabPart[];
}

export const pitchOf = (n: TabNote) => OPEN[n.string] + n.fret;

/** Pitches the mic should hear for an event (technique notes excluded: not judged). */
export function judgedPitches(e: TabEvent): number[] {
  return e.notes.filter((n) => !n.tech).map(pitchOf);
}

/** The notes of a chord voicing as tab notes (strings 4→1), with fretting fingers. */
export function voicingNotes(frets: Frets): TabNote[] {
  const lh = shapeFingers(frets);
  return frets.map((f, i) => ({ string: (4 - i) as StringNum, fret: f, lh: lh[i] }));
}

/** Common first-position fingerings, by frets [4,3,2,1]. */
const KNOWN_FINGERS: Record<string, (LeftFinger | undefined)[]> = {
  '2,0,1,2': [2, undefined, 1, 3], // C
  '0,2,3,4': [undefined, 1, 2, 3], // D
  '0,2,1,4': [undefined, 2, 1, 4], // D7
  '2,0,0,2': [2, undefined, undefined, 3], // Em
  '2,2,1,2': [2, 3, 1, 4], // Am
  '3,2,1,3': [3, 2, 1, 4], // F
  '2,1,0,2': [2, 1, undefined, 3], // E
  '0,1,0,2': [undefined, 1, undefined, 2], // E7
  '3,0,0,0': [3, undefined, undefined, undefined], // G7
  '5,2,2,2': [4, 1, 1, 1], // A7
};

/**
 * Fretting fingers for a chord shape (strings [4,3,2,1]). Known open shapes use their
 * standard fingering; closed shapes: the lowest fret is the index finger (a barre if
 * several strings share it), higher frets take 2, 3, 4 in order, lower strings first.
 */
export function shapeFingers(frets: Frets): (LeftFinger | undefined)[] {
  const known = KNOWN_FINGERS[frets.join(',')];
  if (known) return known;
  const fretted = frets.map((f, i) => ({ f, i })).filter((x) => x.f > 0);
  const out: (LeftFinger | undefined)[] = [undefined, undefined, undefined, undefined];
  if (!fretted.length) return out;
  const min = Math.min(...fretted.map((x) => x.f));
  if (fretted.every((x) => x.f === min)) {
    fretted.forEach((x) => (out[x.i] = 1));
    return out;
  }
  let next = 2;
  fretted
    .sort((a, b) => a.f - b.f || a.i - b.i)
    .forEach((x) => {
      if (x.f === min) out[x.i] = 1;
      else out[x.i] = Math.min(4, next++) as LeftFinger;
    });
  return out;
}

/** First-position (rolling) shape of a chord: library position 1. */
export function rollShape(chord: string): Frets {
  const c = CHORD_BY_ID[chord];
  if (!c) throw new Error(`Unknown chord ${chord}`);
  return c.voicings[0].frets;
}

/** Fret of a string (1–4) in a [4,3,2,1] frets array; the 5th string is always open. */
export function fretOn(frets: Frets, s: StringNum): number {
  return s === 5 ? 0 : frets[4 - s];
}

export function tabDuration(tab: Tab): number {
  return tab.bars * tab.beatsPerBar;
}

/** Slice of a tab (bars [from, to)), re-based to beat 0. */
export function sliceTab(tab: Tab, fromBar: number, toBar: number): Tab {
  const b0 = fromBar * tab.beatsPerBar;
  const b1 = toBar * tab.beatsPerBar;
  return {
    beatsPerBar: tab.beatsPerBar,
    bars: toBar - fromBar,
    chords: tab.chords.slice(fromBar, toBar),
    events: tab.events.filter((e) => e.beat >= b0 && e.beat < b1).map((e) => ({ ...e, beat: e.beat - b0 })),
    parts: tab.parts
      .filter((p) => p.startBar >= fromBar && p.startBar < toBar)
      .map((p) => ({ ...p, startBar: p.startBar - fromBar, bars: Math.min(p.bars, toBar - p.startBar) })),
  };
}

/** Tab for one named part (e.g. 'A'), or the whole tab. */
export function partTab(tab: Tab, part: string | 'all'): Tab {
  if (part === 'all') return tab;
  const p = tab.parts.find((x) => x.name === part);
  return p ? sliceTab(tab, p.startBar, p.startBar + p.bars) : tab;
}

/** Concatenate tabs (e.g. A part then B part). */
export function joinTabs(tabs: Tab[]): Tab {
  const out: Tab = { beatsPerBar: tabs[0].beatsPerBar, bars: 0, chords: [], events: [], parts: [] };
  for (const t of tabs) {
    const off = out.bars * out.beatsPerBar;
    out.events.push(...t.events.map((e) => ({ ...e, beat: e.beat + off })));
    out.parts.push(...t.parts.map((p) => ({ ...p, startBar: p.startBar + out.bars })));
    out.chords.push(...t.chords);
    out.bars += t.bars;
  }
  return out;
}

/** Repeat a tab n times. */
export const repeatTab = (tab: Tab, n: number) => joinTabs(Array.from({ length: n }, () => tab));

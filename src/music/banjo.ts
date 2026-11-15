// The 5-string banjo in open G (gDGBD), with strings numbered the way tab numbers them:
// 1 = high D (closest to the floor), 4 = low D, 5 = the short high-g drone string.

import { midiName, NOTE_NAMES, pc } from './notes';

export type StringNum = 1 | 2 | 3 | 4 | 5;
export const STRINGS: StringNum[] = [1, 2, 3, 4, 5];

/** Open-string pitch (MIDI) per string. */
export const OPEN: Record<StringNum, number> = { 1: 62, 2: 59, 3: 55, 4: 50, 5: 67 };

/** The 5th string starts at the 5th fret, so its fret numbers start there too (open = 0). */
export const FIFTH_STRING_START = 5;

/** Highest fret the app ever asks for on each string. */
export const MAX_FRET_ON: Record<StringNum, number> = { 1: 17, 2: 17, 3: 17, 4: 17, 5: 0 };

export const STRING_NAMES: Record<StringNum, string> = {
  1: '1st (D)',
  2: '2nd (B)',
  3: '3rd (G)',
  4: '4th (D)',
  5: '5th (g)',
};

export interface FretPos {
  string: StringNum;
  fret: number;
}

export const pitchAt = (p: FretPos) => OPEN[p.string] + p.fret;

export const noteName = (midi: number) => NOTE_NAMES[pc(midi)];
export { midiName };

/** Every place on the neck (up to maxFret) where `midi` can be played. */
export function positionsFor(midi: number, maxFret = 12): FretPos[] {
  const out: FretPos[] = [];
  for (const s of STRINGS) {
    const f = midi - OPEN[s];
    if (f >= 0 && f <= Math.min(maxFret, MAX_FRET_ON[s])) out.push({ string: s, fret: f });
  }
  return out;
}

/**
 * Where a heard pitch most likely came from, given where the player was *asked* to play.
 * Same pitch on another string sounds the same, so this is a best guess: prefer the
 * expected string (wrong fret), then the nearest string and fret.
 */
export function likelyPosition(midi: number, expected?: FretPos): FretPos | null {
  const cands = positionsFor(midi, 17);
  if (!cands.length) return null;
  if (!expected) return cands.reduce((a, b) => (b.fret < a.fret ? b : a));
  const cost = (p: FretPos) =>
    (p.string === expected.string ? 0 : 3 + Math.abs(p.string - expected.string)) + Math.abs(p.fret - expected.fret) * 0.5;
  return cands.reduce((a, b) => (cost(b) < cost(a) ? b : a));
}

/** Left-hand finger (1 index … 4 pinky) for a single fretted note in first position. */
export function defaultFinger(fret: number): 1 | 2 | 3 | 4 | undefined {
  if (fret <= 0) return undefined;
  if (fret <= 4) return fret as 1 | 2 | 3 | 4;
  return undefined; // up the neck: depends on the shape, left to the arrangement
}

export type RightHand = 'T' | 'I' | 'M';
export const RH_NAMES: Record<RightHand, string> = { T: 'Thumb', I: 'Index', M: 'Middle' };

/** Which right-hand fingers normally play which strings in Scruggs style. */
export const RH_STRINGS: Record<RightHand, StringNum[]> = { T: [5, 4, 3, 2], I: [3, 2], M: [1, 2] };

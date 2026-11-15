// Turns a tune (chords + melody skeleton) into playable banjo arrangements:
//
//  * melody  — the melody as single picked notes (beginner).
//  * scruggs — melody notes placed on the thumb accents of forward rolls (the 3+3+2
//              syncopation that makes Scruggs style sound like Scruggs), the other roll
//              notes filled in from the chord shape. A small dynamic program chooses each
//              roll note's string and finger so no finger and no string repeats back to
//              back, and rolls flow T→I→M where possible.
//  * backup  — vamping: closed chord shapes chopped on the off-beats (2 and 4).

import { defaultFinger, OPEN, positionsFor, RightHand, StringNum } from './banjo';
import { CHORD_BY_ID, Frets } from './library';
import { NOTE_NAMES } from './notes';
import { fretOn, rollShape, shapeFingers, Tab, TabEvent, TabNote, voicingNotes } from './tab';

export interface TuneBar {
  chord: string;
  /** Melody pitches (MIDI) in this bar, in order; null = no new melody note in that slot. */
  melody: (number | null)[];
}

export interface TunePart {
  name: string;
  bars: TuneBar[];
}

export type ArrangementKind = 'melody' | 'scruggs' | 'backup';
export const ARRANGEMENTS: ArrangementKind[] = ['melody', 'scruggs', 'backup'];
export const ARRANGEMENT_LABELS: Record<ArrangementKind, string> = {
  melody: 'Melody',
  scruggs: 'Scruggs rolls',
  backup: 'Backup (vamp)',
};

// ---------------------------------------------------------------------------------------
// Notation: "G: B3 D4 B3 | C: C4 - E4 | D7: | G: G3"
//   chord, a colon, then up to 4 melody notes (scientific pitch: B3, F#4, Bb3) or "-".

const NOTE_RE = /^([A-Ga-g])([#b]?)(\d)$/;

export function parseNote(tok: string): number {
  const m = NOTE_RE.exec(tok);
  if (!m) throw new Error(`Bad note "${tok}"`);
  const base: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const pcv = base[m[1].toUpperCase()] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return 12 * (Number(m[3]) + 1) + pcv;
}

export function parseBars(text: string): TuneBar[] {
  return text
    .split('|')
    .map((b) => b.trim())
    .filter(Boolean)
    .map((b) => {
      const [chordPart, melodyPart = ''] = b.split(':');
      const chord = chordPart.trim();
      if (!CHORD_BY_ID[chord]) throw new Error(`Unknown chord "${chord}" in "${b}"`);
      const melody = melodyPart
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((t) => (t === '-' ? null : parseNote(t)));
      if (melody.length > 4) throw new Error(`Too many melody notes in "${b}"`);
      return { chord, melody };
    });
}

export const noteLabel = (midi: number) => `${NOTE_NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

// ---------------------------------------------------------------------------------------

/** Eighth-note slots where the bar's melody notes land, by meter and note count. */
export function melodySlots(beatsPerBar: number, count: number): number[] {
  if (beatsPerBar === 3) return [[], [0], [0, 4], [0, 2, 4], [0, 2, 4, 5]][count];
  // 4/4: one note = beat 1; two = beats 1 and 3; three = the Scruggs 3+3+2 accents.
  return [[], [0], [0, 4], [0, 3, 6], [0, 2, 4, 6]][count];
}

interface Pos {
  string: StringNum;
  fret: number;
}

/**
 * Where to play a melody note: prefer the chord shape's own fret, then open strings, then
 * low frets near the previous melody note. First position (frets 0–5; 1st string up to 7).
 */
export function placeMelody(midi: number, shape: Frets, prev?: Pos): Pos {
  const cands = positionsFor(midi, 7).filter((p) => p.string === 5 || p.fret <= (p.string === 1 ? 7 : 5));
  if (!cands.length) throw new Error(`Melody note ${noteLabel(midi)} is out of first-position range`);
  const cost = (p: Pos) => {
    let c = 0;
    if (p.string === 5) c += 0.2;
    else if (p.fret === fretOn(shape, p.string)) c += 0;
    else if (p.fret === 0) c += 0.3;
    else c += 0.6 + p.fret * 0.12;
    if (p.fret > 5) c += 1.5;
    if (prev && prev.fret > 0 && p.fret > 0) c += Math.abs(p.fret - prev.fret) * 0.1;
    return c;
  };
  return cands.reduce((a, b) => (cost(b) < cost(a) ? b : a));
}

const RH_FOR_MELODY: Record<StringNum, RightHand> = { 1: 'M', 2: 'I', 3: 'T', 4: 'T', 5: 'T' };

function lhFor(p: Pos, shape: Frets): TabNote['lh'] {
  if (p.fret === 0 || p.string === 5) return undefined;
  if (p.fret === fretOn(shape, p.string)) return shapeFingers(shape)[4 - p.string];
  return defaultFinger(p.fret);
}

// ---------------------------------------------------------------------------------------
// Melody arrangement

export function arrangeMelody(parts: TunePart[], beatsPerBar: number): Tab {
  const events: TabEvent[] = [];
  let prev: Pos | undefined;
  let bar = 0;
  const slotsPerBar = beatsPerBar * 2;
  for (const part of parts)
    for (const b of part.bars) {
      const shape = rollShape(b.chord);
      const slots = melodySlots(beatsPerBar, b.melody.length);
      b.melody.forEach((m, i) => {
        if (m === null) return;
        const p = placeMelody(m, shape, prev);
        prev = p;
        const next = b.melody.slice(i + 1).findIndex((x) => x !== null);
        const endSlot = next >= 0 ? slots[i + 1 + next] : slotsPerBar;
        events.push({
          beat: bar * beatsPerBar + slots[i] / 2,
          dur: (endSlot - slots[i]) / 2,
          kind: 'pick',
          notes: [{ ...p, rh: RH_FOR_MELODY[p.string], lh: lhFor(p, shape), melody: true }],
        });
      });
      bar++;
    }
  return finish(parts, beatsPerBar, events);
}

// ---------------------------------------------------------------------------------------
// Scruggs arrangement

interface Option {
  string: StringNum;
  fret: number;
  rh: RightHand;
  melody: boolean;
  cost: number;
}

const FILL_STRING_COST: Record<StringNum, number> = { 5: 0, 1: 0.1, 2: 0.2, 3: 0.5, 4: 1.2 };
const FINGERS_ON: Record<StringNum, RightHand[]> = { 5: ['T'], 4: ['T'], 3: ['T', 'I'], 2: ['I', 'T', 'M'], 1: ['M', 'I'] };
const FINGER_ON_COST = (s: StringNum, f: RightHand) =>
  (s === 2 && f === 'T') || (s === 2 && f === 'M') ? 0.5 : s === 1 && f === 'I' ? 0.5 : s === 3 && f === 'I' ? 0.2 : 0;
// Scruggs style leads the melody with the thumb (strings 2–5); the middle finger takes the 1st string.
const MELODY_FINGER_COST = (s: StringNum, f: RightHand) =>
  s === 1 ? (f === 'M' ? 0 : 0.5) : s === 2 ? (f === 'T' ? 0 : f === 'I' ? 0.2 : 0.6) : f === 'T' ? 0 : 0.8;
const NEXT: Record<RightHand, RightHand> = { T: 'I', I: 'M', M: 'T' };
const BACK: Record<RightHand, RightHand> = { M: 'I', I: 'T', T: 'M' };

function transition(a: Option, b: Option): number {
  if (a.rh === b.rh || a.string === b.string) return Infinity;
  if (NEXT[a.rh] === b.rh) return 0; // forward roll: T I M
  if (BACK[a.rh] === b.rh) return 0.25; // backward roll: M I T
  return 0.5;
}

export function arrangeScruggs(parts: TunePart[], beatsPerBar: number): Tab {
  const slotsPerBar = beatsPerBar * 2;
  const slotOptions: Option[][] = [];
  const slotChord: Frets[] = [];
  let prevMel: Pos | undefined;

  const allBars = parts.flatMap((p) => p.bars);
  allBars.forEach((b, barIdx) => {
    const shape = rollShape(b.chord);
    const slots = melodySlots(beatsPerBar, b.melody.length);
    const melodyAt = new Map<number, Pos>();
    b.melody.forEach((m, i) => {
      if (m === null) return;
      const p = placeMelody(m, shape, prevMel);
      prevMel = p;
      melodyAt.set(slots[i], p);
    });
    // Strings the melody frets differently from the chord shape this bar: fills prefer
    // other strings (the fretting finger would have to come off and back on).
    const busy = new Set([...melodyAt.values()].filter((p) => p.string !== 5 && p.fret !== fretOn(shape, p.string)).map((p) => p.string));
    const last = barIdx === allBars.length - 1;
    for (let s = 0; s < slotsPerBar; s++) {
      slotChord.push(shape);
      const mel = melodyAt.get(s);
      if (mel) {
        slotOptions.push(FINGERS_ON[mel.string].map((rh) => ({ ...mel, rh, melody: true, cost: MELODY_FINGER_COST(mel.string, rh) })));
      } else if (last && s > 0) {
        slotOptions.push([]); // the final bar rings out after its first note
      } else {
        const opts: Option[] = [];
        for (const str of [5, 1, 2, 3, 4] as StringNum[])
          for (const rh of FINGERS_ON[str])
            opts.push({ string: str, fret: fretOn(shape, str), rh, melody: false, cost: FILL_STRING_COST[str] + FINGER_ON_COST(str, rh) + (busy.has(str) ? 0.6 : 0) });
        slotOptions.push(opts);
      }
    }
  });

  // Viterbi over every slot of the tune. Empty slots (final bar) are skipped.
  const idx = slotOptions.map((o, i) => (o.length ? i : -1)).filter((i) => i >= 0);
  const cost: number[][] = [];
  const back: number[][] = [];
  idx.forEach((slot, k) => {
    const opts = slotOptions[slot];
    cost[k] = opts.map((o) => o.cost);
    back[k] = opts.map(() => -1);
    if (k === 0) return;
    const prevOpts = slotOptions[idx[k - 1]];
    opts.forEach((o, j) => {
      let best = Infinity;
      let arg = -1;
      prevOpts.forEach((p, i) => {
        const c = cost[k - 1][i] + transition(p, o);
        if (c < best) [best, arg] = [c, i];
      });
      cost[k][j] += best;
      back[k][j] = arg;
    });
  });
  const lastK = idx.length - 1;
  let j = cost[lastK].reduce((bi, c, i, arr) => (c < arr[bi] ? i : bi), 0);
  if (!Number.isFinite(cost[lastK][j])) throw new Error('No playable roll fingering');
  const chosen: Option[] = [];
  for (let k = lastK; k >= 0; k--) {
    chosen[k] = slotOptions[idx[k]][j];
    j = back[k][j];
  }

  const events: TabEvent[] = idx.map((slot, k) => {
    const o = chosen[k];
    const shape = slotChord[slot];
    const nextSlot = k + 1 < idx.length ? idx[k + 1] : allBars.length * slotsPerBar;
    return {
      beat: slot / 2,
      dur: (nextSlot - slot) / 2,
      kind: 'pick' as const,
      notes: [{ string: o.string, fret: o.fret, rh: o.rh, lh: lhFor(o, shape), melody: o.melody || undefined }],
    };
  });
  // End on a pinch: the last melody note together with the 5th string (or the 1st).
  const lastEv = events[events.length - 1];
  const n0 = lastEv.notes[0];
  // Thumb on the melody → middle finger on the 1st string; index/middle on it → thumb on the 5th.
  const endShape = rollShape(allBars[allBars.length - 1].chord);
  const partner: TabNote =
    n0.rh === 'T' ? { string: 1, fret: fretOn(endShape, 1), rh: 'M', lh: lhFor({ string: 1, fret: fretOn(endShape, 1) }, endShape) } : { string: 5, fret: 0, rh: 'T' };
  if (partner.string !== n0.string) lastEv.notes.push(partner);
  return finish(parts, beatsPerBar, events);
}

// ---------------------------------------------------------------------------------------
// Backup (vamp) arrangement

/** Closed shapes usable for vamping (no open strings), frets 2–12. */
export function vampVoicings(chord: string) {
  return CHORD_BY_ID[chord].voicings.filter((v) => !v.hasOpen && v.minFret >= 2 && v.maxFret <= 12);
}

/** Pick a closed voicing near the previous one (and near frets 5–7, where vamping lives). */
export function chooseVamp(chord: string, prevAnchor: number | null): Frets {
  const vs = vampVoicings(chord);
  if (!vs.length) return CHORD_BY_ID[chord].voicings.find((v) => !v.hasOpen)?.frets ?? rollShape(chord);
  const cost = (a: number) => (prevAnchor === null ? 0 : Math.abs(a - prevAnchor)) + 0.3 * Math.abs(a - 6);
  return vs.reduce((x, y) => (cost(y.anchor) < cost(x.anchor) ? y : x)).frets;
}

/** Off-beat chops: beats 2 and 4 (4/4), beats 2 and 3 (3/4). */
export const chopBeats = (beatsPerBar: number) => (beatsPerBar === 3 ? [1, 2] : [1, 3]);

export function arrangeBackup(parts: TunePart[], beatsPerBar: number): Tab {
  const events: TabEvent[] = [];
  let anchor: number | null = null;
  parts
    .flatMap((p) => p.bars)
    .forEach((b, bar) => {
      const frets = chooseVamp(b.chord, anchor);
      anchor = Math.min(...frets.filter((f) => f > 0));
      for (const beat of chopBeats(beatsPerBar))
        events.push({ beat: bar * beatsPerBar + beat, dur: 0.5, kind: 'chord', chord: b.chord, frets, notes: voicingNotes(frets), style: 'chop' });
    });
  return finish(parts, beatsPerBar, events);
}

// ---------------------------------------------------------------------------------------

function finish(parts: TunePart[], beatsPerBar: number, events: TabEvent[]): Tab {
  const tabParts: Tab['parts'] = [];
  let bar = 0;
  for (const p of parts) {
    tabParts.push({ name: p.name, startBar: bar, bars: p.bars.length });
    bar += p.bars.length;
  }
  events.sort((a, b) => a.beat - b.beat);
  return { beatsPerBar, bars: bar, chords: parts.flatMap((p) => p.bars.map((b) => b.chord)), events, parts: tabParts };
}

export function arrange(kind: ArrangementKind, parts: TunePart[], beatsPerBar: number): Tab {
  if (kind === 'melody') return arrangeMelody(parts, beatsPerBar);
  if (kind === 'scruggs') return arrangeScruggs(parts, beatsPerBar);
  return arrangeBackup(parts, beatsPerBar);
}

/** Does any picked note need the left hand? */
export const usesFrets = (tab: Tab) => tab.events.some((e) => e.kind === 'pick' && e.notes.some((n) => n.fret > 0));

export { OPEN };

// Spoken narration for lesson steps. The clips are pre-generated with a neural voice
// (scripts/voice/generate.py) and named by a hash of their text, so editing a step's text
// means regenerating just that clip (`npm run voice`).

import { ALL_LESSONS, Step } from './lessons';

/** Narration for the guided tuner step (the screen text lives in LessonScreen). */
export const TUNER_GUIDED =
  "We'll go string by string: the fourth, the third, the second, the first, and then the short fifth string. Pick the string, let it ring, and turn its peg until the needle sits in the green.";
export const TUNER_FREE = 'Tune each string to G, D, G, B, D, from the fifth string to the first.';

const FINGER: Record<string, string> = { T: 'thumb', I: 'index', M: 'middle' };

/**
 * Turn text written for reading into text that sounds right spoken: finger letters,
 * tab shorthand (2s3, 0h2, 2p0), string-number lists, symbols.
 */
export function speechText(s: string): string {
  return (
    s
      // the tuning
      .replace(/\bg ?D ?G ?B ?D\b/g, 'G, D, G, B, D')
      // tab shorthand for techniques
      .replace(/\b(\d+)s(\d+)\b/g, '$1, slide to $2')
      .replace(/\b(\d+)h(\d+)\b/g, (_, a, b) => `${a === '0' ? 'open' : a}, hammer on to ${b}`)
      .replace(/\b(\d+)p(\d+)\b/g, (_, a, b) => `${a}, pull off to ${b === '0' ? 'open' : b}`)
      // "(T)", "(I)", "(M)" after the finger's name; "T thumb" → "T for thumb"
      .replace(/ \((T|I|M)\)/g, '')
      .replace(/\b([TIM]) (thumb|index|middle)\b/g, '$1 for $2')
      // tab letters in quotes: "s" → the letter S
      .replace(/"([shp])"/g, (_, l: string) => `the letter ${l.toUpperCase()}`)
      .replace(/3\+3\+2/g, 'three, three, two')
      // runs of finger letters: "T I M T" → "thumb, index, middle, thumb"
      .replace(/\b([TIM])((?:[ ,–-]+[TIM])+)\b/g, (m) => m.split(/[ ,–-]+/).map((x) => FINGER[x]).join(', '))
      // runs of string numbers: "Strings 3 2 1 5" → "3, 2, 1, 5"
      .replace(/\b(\d)((?: \d)+)\b/g, (m) => m.split(' ').join(', '))
      // ranges and arrows; fret 0 is "open"
      .replace(/(\d)\s*[–-]\s*(\d)/g, '$1 to $2')
      .replace(/\s*→\s*/g, ' to ')
      .replace(/\b0 to (\d)/g, 'open to $1')
      .replace(/(\d) to 0\b/g, '$1 to open')
      .replace(/ – /g, ', ')
      .replace(/(fret)\s*=\s*/g, '$1 sounds the same as ')
      .replace(/\s*=\s*/g, ' means ')
      .replace(/\bbpm\b/g, 'beats per minute')
      .replace(/\bvs\.?/g, 'versus')
      .replace(/\s+/g, ' ')
      .trim()
      // sentence starts upper-case (a title like "T – I – M" becomes "thumb, index, middle")
      .replace(/(^|[.!?] )([a-z])/g, (_, a: string, c: string) => a + c.toUpperCase())
  );
}

/** A title as a spoken sentence (no doubled punctuation). */
const sentence = (t: string) => (/[.!?]$/.test(t) ? t : `${t}.`);

/** The spoken text for a lesson step (null = nothing to say). */
export function narrationFor(step: Step): string | null {
  let text: string;
  switch (step.kind) {
    case 'info':
      text = [sentence(step.title), ...step.body].join(' ');
      break;
    case 'tuner':
      text = `${sentence(step.title)} ${step.guided ? TUNER_GUIDED : TUNER_FREE}`;
      break;
    case 'play':
      text = `${sentence(step.title)} ${step.prompt}${step.mode === 'wait' ? '' : ' Press start when you are ready, and the band will count you in.'}`;
      break;
    case 'trade':
      text = `${sentence(step.title)} ${step.prompt}`;
      break;
  }
  return speechText(text);
}

/** Stable short id for a clip's text (cyrb53 hash, hex). Same in the app and the generator export. */
export function narrationId(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

/** Every clip the app can play: id → text. */
export function allNarration(): Map<string, string> {
  const out = new Map<string, string>();
  for (const l of ALL_LESSONS)
    for (const s of l.steps) {
      const t = narrationFor(s);
      if (t) out.set(narrationId(t), t);
    }
  return out;
}

// The tune catalogue. Every tune here is traditional or published before 1929 (public
// domain in the US). Tunes from the minstrel-show repertoire were left out on purpose.
//
// Each tune is a melody skeleton: per bar, the chord and up to 4 melody notes (see
// arranger.ts for the notation). The arranger builds the Melody, Scruggs and Backup
// arrangements from it, so adding a tune is adding one entry — the catalogue can grow to
// thousands without code changes.
//
// NOTE: these melodies were written from memory as simplified skeletons, in first
// position in G. Have a banjo teacher review them before launch.

import { arrange, ArrangementKind, parseBars, TunePart } from '../music/arranger';
import { Tab } from '../music/tab';

export type Unlock = { lesson: string } | { stars: number };

export interface TuneDef {
  id: string;
  title: string;
  /** Beats per bar. */
  meter: 3 | 4;
  /** Full-speed tempo (quarter notes per minute). */
  bpm: number;
  origin: string;
  /** Short line shown in the library. */
  blurb: string;
  parts: { name: string; bars: string }[];
  unlock: Unlock;
  level: 1 | 2 | 3;
}

export interface Tune extends Omit<TuneDef, 'parts'> {
  parts: TunePart[];
}

const DEFS: TuneDef[] = [
  {
    id: 'boil-cabbage',
    title: 'Boil Them Cabbage Down',
    meter: 4, bpm: 90, level: 1,
    origin: 'Traditional (Appalachian), public domain',
    blurb: 'The first tune every banjo player learns. Three chords, one part.',
    unlock: { lesson: 'first-tune' },
    parts: [{ name: 'A', bars: 'G: B3 B3 B3 | C: C4 C4 C4 | G: B3 B3 G3 | D: A3 A3 - | G: B3 B3 B3 | C: C4 C4 C4 | D: B3 A3 A3 | G: G3' }],
  },
  {
    id: 'cripple-creek',
    title: 'Cripple Creek',
    meter: 4, bpm: 100, level: 1,
    origin: 'Traditional (Virginia), public domain',
    blurb: 'A rolling G tune that sits right under the fingers.',
    unlock: { lesson: 'tune-cripple-creek' },
    parts: [
      { name: 'A', bars: 'G: B3 A3 G3 | G: B3 A3 G3 | G: B3 D4 B3 | D: A3 G3 - | G: B3 A3 G3 | G: B3 A3 G3 | D: A3 B3 A3 | G: G3 G3 -' },
      { name: 'B', bars: 'G: D4 E4 D4 | G: B3 G3 - | G: D4 E4 D4 | D: A3 G3 - | G: D4 E4 D4 | G: B3 G3 - | D: A3 B3 A3 | G: G3' },
    ],
  },
  {
    id: 'cumberland-gap',
    title: 'Cumberland Gap',
    meter: 4, bpm: 100, level: 1,
    origin: 'Traditional (Kentucky/Tennessee), public domain',
    blurb: 'Named for the mountain pass. Driving and simple.',
    unlock: { lesson: 'tune-cumberland-gap' },
    parts: [
      { name: 'A', bars: 'G: B3 B3 A3 | G: G3 A3 B3 | G: B3 B3 A3 | D: A3 - - | G: B3 B3 A3 | G: G3 A3 B3 | D: A3 B3 A3 | G: G3' },
      { name: 'B', bars: 'G: D4 D4 E4 | G: D4 B3 G3 | G: D4 D4 E4 | D: D4 A3 - | G: D4 D4 E4 | G: D4 B3 G3 | D: A3 B3 A3 | G: G3' },
    ],
  },
  {
    id: 'old-joe-clark',
    title: 'Old Joe Clark',
    meter: 4, bpm: 105, level: 2,
    origin: 'Traditional (Kentucky), public domain',
    blurb: 'The F chord gives it that old mountain (mixolydian) sound.',
    unlock: { lesson: 'tune-old-joe-clark' },
    parts: [
      { name: 'A', bars: 'G: D4 D4 D4 | G: E4 D4 B3 | G: D4 D4 D4 | D: A3 A3 - | G: D4 D4 D4 | G: E4 D4 B3 | F: F4 C4 A3 | G: G3' },
      { name: 'B', bars: 'G: G4 G4 G4 | F: F4 F4 F4 | G: G4 E4 D4 | D: A3 A3 - | G: G4 G4 G4 | F: F4 F4 F4 | G: E4 D4 B3 | G: G3' },
    ],
  },
  {
    id: 'skip-to-my-lou',
    title: 'Skip to My Lou',
    meter: 4, bpm: 95, level: 1,
    origin: 'Traditional (American play-party song), public domain',
    blurb: 'Two chords, lots of bounce.',
    unlock: { stars: 6 },
    parts: [{ name: 'A', bars: 'G: B3 B3 G3 | G: B3 B3 D4 | D: A3 A3 F#3 | D: A3 A3 C4 | G: B3 B3 G3 | G: B3 B3 D4 | D: A3 B3 A3 | G: G3' }],
  },
  {
    id: 'bury-me-willow',
    title: 'Bury Me Beneath the Willow',
    meter: 4, bpm: 100, level: 1,
    origin: 'Traditional (Appalachian ballad), public domain',
    blurb: 'A lonesome old ballad, perfect for trading breaks.',
    unlock: { stars: 10 },
    parts: [
      {
        name: 'A',
        bars: 'G: B3 B3 B3 | G: D4 B3 G3 | C: C4 C4 E4 | G: D4 - - | G: B3 B3 B3 | G: D4 B3 - | D: A3 - B3 | D: A3 - - | G: B3 B3 B3 | G: D4 B3 G3 | C: C4 C4 E4 | G: D4 - - | G: B3 A3 G3 | D: A3 - - | D: A3 B3 A3 | G: G3',
      },
    ],
  },
  {
    id: 'sally-ann',
    title: 'Sally Ann',
    meter: 4, bpm: 105, level: 2,
    origin: 'Traditional (fiddle tune), public domain',
    blurb: 'A jam favourite with a high B part.',
    unlock: { stars: 14 },
    parts: [
      { name: 'A', bars: 'G: D4 B3 D4 | G: E4 D4 B3 | G: D4 B3 G3 | D: A3 - - | G: D4 B3 D4 | G: E4 D4 B3 | D: A3 B3 A3 | G: G3' },
      { name: 'B', bars: 'G: G4 G4 E4 | G: D4 B3 - | G: G4 G4 E4 | D: D4 A3 - | G: G4 G4 E4 | G: D4 B3 G3 | D: A3 B3 A3 | G: G3' },
    ],
  },
  {
    id: 'circle-unbroken',
    title: 'Will the Circle Be Unbroken',
    meter: 4, bpm: 95, level: 1,
    origin: 'Hymn by Ada Habershon & Charles Gabriel (1907), public domain',
    blurb: 'The gospel song every jam ends with.',
    unlock: { lesson: 'tune-circle' },
    parts: [
      {
        name: 'A',
        bars: 'G: B3 B3 A3 | G: G3 - - | C: C4 C4 E4 | G: D4 - B3 | G: B3 D4 D4 | G: B3 A3 G3 | D: A3 - - | D: A3 B3 A3 | G: B3 B3 A3 | G: G3 - - | C: C4 C4 E4 | G: D4 - B3 | G: D4 B3 G3 | D: A3 A3 B3 | G: G3 | G: G3',
      },
    ],
  },
  {
    id: 'amazing-grace',
    title: 'Amazing Grace',
    meter: 3, bpm: 84, level: 1,
    origin: 'Hymn by John Newton (1779), tune "New Britain" (1829), public domain',
    blurb: 'Your first waltz: rolls in 3/4 time.',
    unlock: { stars: 3 },
    parts: [
      {
        name: 'A',
        bars: 'G: D3 | G: G3 - B3 | G: B3 A3 | C: G3 E3 | G: D3 D3 | G: G3 - B3 | G: B3 A3 | D: D4 | D: A3 | G: B3 - D4 | G: B3 A3 | C: G3 E3 | G: D3 D3 | G: G3 - B3 | D: B3 A3 | G: G3',
      },
    ],
  },
  {
    id: 'down-in-valley',
    title: 'Down in the Valley',
    meter: 3, bpm: 90, level: 1,
    origin: 'Traditional (Kentucky), public domain',
    blurb: 'A slow waltz with long, ringing notes.',
    unlock: { stars: 18 },
    parts: [
      {
        name: 'A',
        bars: 'G: D3 G3 | G: B3 | G: B3 A3 | D: A3 | D: D3 F#3 | D: A3 | D: C4 B3 | G: B3 | G: D3 G3 | G: B3 | G: B3 A3 | D: A3 | D: C4 B3 | D: A3 F#3 | G: G3 | G: G3',
      },
    ],
  },
  {
    id: 'red-river-valley',
    title: 'Red River Valley',
    meter: 4, bpm: 95, level: 1,
    origin: 'Traditional (cowboy song, 1870s), public domain',
    blurb: 'A gentle cowboy tune with long notes to roll through.',
    unlock: { stars: 22 },
    parts: [
      {
        name: 'A',
        bars: 'G: D3 G3 B3 | G: B3 B3 A3 | G: B3 A3 G3 | G: G3 | G: D3 G3 B3 | G: G3 B3 D4 | D: C4 B3 A3 | D: A3 | D: D4 C4 B3 | D: B3 A3 F#3 | G: G3 A3 B3 | C: E4 D4 B3 | D: A3 - - | D: A3 B3 A3 | G: G3 | G: G3',
      },
    ],
  },
  {
    id: 'coming-round-mountain',
    title: "She'll Be Coming 'Round the Mountain",
    meter: 4, bpm: 105, level: 2,
    origin: 'Traditional (from the spiritual "When the Chariot Comes"), public domain',
    blurb: 'A singalong that climbs to the high G.',
    unlock: { stars: 26 },
    parts: [
      {
        name: 'A',
        bars: 'G: D4 D4 D4 | G: B3 G3 B3 | G: D4 - - | G: D4 | D: D4 D4 D4 | D: C4 A3 C4 | D: D4 - - | D: A3 | G: G4 G4 G4 | G: E4 D4 B3 | C: C4 E4 - | C: E4 | G: D4 B3 G3 | D: A3 B3 A3 | G: G3 | G: G3',
      },
    ],
  },
  {
    id: 'worried-man',
    title: 'Worried Man Blues',
    meter: 4, bpm: 100, level: 1,
    origin: 'Traditional, public domain',
    blurb: 'A three-chord blues that loves a good roll.',
    unlock: { stars: 30 },
    parts: [
      {
        name: 'A',
        bars: 'G: G3 G3 B3 | G: D4 B3 G3 | G: G3 G3 B3 | G: D4 - - | C: E4 E4 C4 | C: E4 - - | G: D4 B3 G3 | G: G3 | G: G3 G3 B3 | G: D4 B3 G3 | D: A3 - B3 | D: A3 - - | G: G3 B3 A3 | D: A3 B3 A3 | G: G3 | G: G3',
      },
    ],
  },
  {
    id: 'jesse-james',
    title: 'Jesse James',
    meter: 4, bpm: 100, level: 2,
    origin: 'Traditional (ballad, 1880s), public domain',
    blurb: 'An old outlaw ballad with a big chorus.',
    unlock: { stars: 34 },
    parts: [
      {
        name: 'A',
        bars: 'G: D4 D4 D4 | G: B3 D4 - | C: E4 E4 E4 | G: D4 - - | G: D4 D4 B3 | G: G3 B3 - | D: A3 B3 A3 | D: A3 | G: D4 D4 D4 | G: B3 D4 - | C: E4 E4 E4 | G: D4 - - | G: B3 D4 B3 | D: A3 - G3 | D: A3 B3 A3 | G: G3',
      },
    ],
  },
  {
    id: 'little-maggie',
    title: 'Little Maggie',
    meter: 4, bpm: 110, level: 2,
    origin: 'Traditional (Appalachian), public domain',
    blurb: 'G to F and back: a classic mountain sound.',
    unlock: { stars: 38 },
    parts: [{ name: 'A', bars: 'G: D4 D4 B3 | G: D4 - - | F: C4 C4 A3 | F: C4 - - | G: B3 D4 B3 | G: G3 - - | D: A3 B3 A3 | G: G3' }],
  },
  {
    id: 'arkansas-traveler',
    title: 'Arkansas Traveler',
    meter: 4, bpm: 105, level: 2,
    origin: 'Traditional (fiddle tune, 1840s), public domain',
    blurb: 'A fiddle tune that walks all over the first position.',
    unlock: { stars: 42 },
    parts: [
      { name: 'A', bars: 'G: B3 A3 G3 | G: B3 D4 B3 | D: A3 B3 A3 | D: F#3 A3 - | G: B3 A3 G3 | G: B3 D4 G4 | D: E4 D4 A3 | G: G3' },
      { name: 'B', bars: 'G: D4 D4 E4 | G: D4 B3 G3 | C: E4 E4 G4 | C: E4 C4 - | G: D4 D4 E4 | G: D4 B3 G3 | D: A3 B3 A3 | G: G3' },
    ],
  },
  {
    id: 'soldiers-joy',
    title: "Soldier's Joy",
    meter: 4, bpm: 105, level: 2,
    origin: 'Traditional (fiddle tune, 1700s), public domain',
    blurb: 'One of the oldest fiddle tunes still played at jams.',
    unlock: { lesson: 'tune-soldiers-joy' },
    parts: [
      { name: 'A', bars: 'G: D3 G3 B3 | G: B3 A3 G3 | G: D4 B3 G3 | D: A3 F#3 D3 | G: D3 G3 B3 | G: B3 A3 G3 | D: A3 B3 A3 | G: G3' },
      { name: 'B', bars: 'G: B3 D4 E4 | G: D4 B3 G3 | C: E4 C4 E4 | G: D4 B3 - | G: B3 D4 E4 | G: D4 B3 G3 | D: A3 B3 A3 | G: G3' },
    ],
  },
  {
    id: 'red-haired-boy',
    title: 'Red Haired Boy',
    meter: 4, bpm: 105, level: 3,
    origin: 'Traditional (Irish/Scottish fiddle tune), public domain',
    blurb: 'A jam-session staple with the G–F mountain sound.',
    unlock: { stars: 46 },
    parts: [
      { name: 'A', bars: 'G: D3 G3 A3 | G: B3 G3 B3 | F: A3 F3 A3 | F: C4 A3 - | G: D3 G3 A3 | G: B3 A3 G3 | D: A3 F#3 A3 | G: G3' },
      { name: 'B', bars: 'F: C4 F4 F4 | F: E4 D4 C4 | G: B3 D4 D4 | G: D4 B3 G3 | G: D3 G3 A3 | G: B3 A3 G3 | D: A3 F#3 A3 | G: G3' },
    ],
  },
  {
    id: 'banks-of-ohio',
    title: 'Banks of the Ohio',
    meter: 4, bpm: 95, level: 1,
    origin: 'Traditional (murder ballad, 1800s), public domain',
    blurb: 'A dark old ballad with a pretty, simple melody.',
    unlock: { stars: 50 },
    parts: [
      {
        name: 'A',
        bars: 'G: G3 A3 B3 | G: B3 - - | D: A3 G3 A3 | D: A3 - - | D: A3 B3 C4 | D: D4 - - | G: B3 A3 G3 | G: G3 | G: G3 A3 B3 | G: B3 D4 B3 | C: C4 E4 C4 | G: B3 - - | D: A3 B3 A3 | D: F#3 A3 - | G: G3 | G: G3',
      },
    ],
  },
  {
    id: 'liza-jane',
    title: 'Li\'l Liza Jane',
    meter: 4, bpm: 105, level: 1,
    origin: 'Countess Ada de Lachau (1916), public domain',
    blurb: 'A New Orleans favourite that grew up in string bands.',
    unlock: { stars: 54 },
    parts: [
      { name: 'A', bars: 'G: B3 D4 E4 | G: D4 - B3 | G: B3 D4 B3 | D: A3 - - | G: B3 D4 E4 | G: D4 - B3 | D: A3 B3 A3 | G: G3' },
      { name: 'B', bars: 'C: E4 - E4 | G: D4 - - | D: A3 - B3 | G: G3 - - | C: E4 - E4 | G: D4 - B3 | D: A3 B3 A3 | G: G3' },
    ],
  },
  {
    id: 'wildwood-flower',
    title: 'Wildwood Flower',
    meter: 4, bpm: 100, level: 2,
    origin: 'From "I\'ll Twine \'Mid the Ringlets" (1860), public domain',
    blurb: 'The old parlour song that became a picking standard.',
    unlock: { stars: 58 },
    parts: [
      { name: 'A', bars: 'G: G3 A3 B3 | G: D4 C4 B3 | D: A3 - - | D: C4 B3 A3 | G: G3 A3 B3 | G: D4 C4 B3 | D: A3 B3 A3 | G: G3' },
      { name: 'B', bars: 'C: E4 - E4 | G: D4 - B3 | D: A3 C4 B3 | G: G3 - - | C: E4 - E4 | G: D4 - B3 | D: A3 B3 A3 | G: G3' },
    ],
  },
  {
    id: 'goin-down-road',
    title: "Goin' Down the Road Feelin' Bad",
    meter: 4, bpm: 105, level: 1,
    origin: 'Traditional ("Lonesome Road Blues"), public domain',
    blurb: 'A road song with a big C chord in the middle.',
    unlock: { stars: 62 },
    parts: [{ name: 'A', bars: 'G: B3 B3 B3 | G: A3 G3 - | C: E4 E4 E4 | C: D4 C4 - | G: B3 B3 B3 | G: A3 G3 - | D: A3 B3 A3 | G: G3' }],
  },
  {
    id: 'john-henry',
    title: 'John Henry',
    meter: 4, bpm: 105, level: 2,
    origin: 'Traditional (ballad, 1870s), public domain',
    blurb: 'The steel-driving man, in a 12-bar form.',
    unlock: { stars: 66 },
    parts: [
      { name: 'A', bars: 'G: G3 G3 B3 | G: D4 - D4 | G: D4 B3 G3 | G: G3 | C: E4 E4 E4 | C: D4 C4 - | G: B3 A3 G3 | G: G3 | G: B3 D4 B3 | D: A3 - G3 | D: A3 B3 A3 | G: G3' },
    ],
  },
  {
    id: 'home-sweet-home',
    title: 'Home! Sweet Home!',
    meter: 4, bpm: 90, level: 1,
    origin: 'Henry Bishop & John Howard Payne (1823), public domain',
    blurb: 'Earl Scruggs made this old parlour song a banjo classic.',
    unlock: { stars: 70 },
    parts: [
      {
        name: 'A',
        bars: 'G: G3 A3 B3 | G: B3 - C4 | D: A3 - - | D: A3 | G: B3 C4 D4 | G: D4 E4 D4 | D: B3 - A3 | D: A3 | G: D4 - B3 | C: C4 E4 C4 | G: B3 G3 - | D: A3 - - | G: G3 A3 B3 | C: C4 B3 A3 | D: A3 - B3 | G: G3',
      },
    ],
  },
  {
    id: 'cindy',
    title: 'Cindy',
    meter: 4, bpm: 110, level: 2,
    origin: 'Traditional (Appalachian), public domain',
    blurb: '"Get along home, Cindy" — a fast, happy finale.',
    unlock: { stars: 75 },
    parts: [
      { name: 'A', bars: 'G: B3 B3 B3 | G: G3 B3 D4 | C: E4 - E4 | G: D4 - - | G: B3 B3 B3 | G: G3 B3 D4 | D: A3 B3 A3 | G: G3' },
      { name: 'B', bars: 'G: G4 G4 E4 | G: D4 - B3 | C: C4 E4 C4 | G: B3 - - | G: G4 G4 E4 | G: D4 - B3 | D: A3 B3 A3 | G: G3' },
    ],
  },
];

export const TUNES: Tune[] = DEFS.map((d) => ({ ...d, parts: d.parts.map((p) => ({ name: p.name, bars: parseBars(p.bars) })) }));
export const TUNE_BY_ID: Record<string, Tune> = Object.fromEntries(TUNES.map((t) => [t.id, t]));

const tabCache = new Map<string, Tab>();
export function tuneTab(t: Tune, kind: ArrangementKind): Tab {
  const key = `${t.id}:${kind}`;
  let tab = tabCache.get(key);
  if (!tab) {
    tab = arrange(kind, t.parts, t.meter);
    tabCache.set(key, tab);
  }
  return tab;
}

/** Lessons that unlock each arrangement style (in addition to unlocking the tune). */
export const ARRANGEMENT_UNLOCK: Record<ArrangementKind, string | null> = {
  melody: null,
  scruggs: 'roll-changes',
  backup: 'vamp-progression',
};

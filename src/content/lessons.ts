// The learning path: courses → lessons → steps. From never having held a banjo, through
// the picking hand, rolls, the left hand and chords, to backup (vamping) and trading
// breaks on real tunes.

import { ArrangementKind } from '../music/arranger';
import { TabNote, Tab, voicingNotes } from '../music/tab';
import { chordTab, notesTab, openGRamble, ROLLS, rollTab, VAMP, vampTab } from './exercises';

export type Figure =
  | { type: 'banjo-parts' }
  | { type: 'tab-explainer' }
  | { type: 'picking-hand' }
  | { type: 'fretboard'; notes: TabNote[]; caption?: string };

export interface TuneSource {
  tune: string;
  arrangement: ArrangementKind;
  part?: string;
}

export type Step =
  | { kind: 'info'; title: string; body: string[]; figure?: Figure }
  | { kind: 'tuner'; title: string }
  | {
      kind: 'play';
      title: string;
      prompt: string;
      source: Tab | TuneSource;
      /** wait = the music waits for each note; tempo = play along in time. */
      mode: 'wait' | 'tempo';
      bpm?: number;
      /** Play the band along (tempo mode). */
      backing?: boolean;
    }
  | {
      kind: 'trade';
      title: string;
      prompt: string;
      tune: string;
      /** What you play when you take the lead. */
      lead: ArrangementKind;
      bpm?: number;
    };

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  steps: Step[];
}

export interface Course {
  id: string;
  title: string;
  subtitle: string;
  lessons: Lesson[];
}

const isTab = (s: Tab | TuneSource): s is Tab => 'events' in s;
export { isTab };

const G = ['G', 'G'];

function tuneLesson(id: string, tune: string, title: string, intro: string[], bpm: number, hasB = true): Lesson {
  const steps: Step[] = [
    { kind: 'info', title, body: intro },
    { kind: 'play', title: 'Learn the A part', prompt: 'Take it slow — the music waits for each note.', source: { tune, arrangement: 'scruggs', part: 'A' }, mode: 'wait' },
  ];
  if (hasB)
    steps.push({ kind: 'play', title: 'Learn the B part', prompt: 'Same idea, new notes.', source: { tune, arrangement: 'scruggs', part: 'B' }, mode: 'wait' });
  steps.push(
    { kind: 'play', title: 'Play it with the band', prompt: 'The whole tune, in time. Keep the roll going even if you miss a note.', source: { tune, arrangement: 'scruggs' }, mode: 'tempo', bpm, backing: true },
    {
      kind: 'trade',
      title: 'Trade breaks',
      prompt: 'You take the first break while the band backs you up. Then the banjo player takes a break — you vamp behind them.',
      tune,
      lead: 'scruggs',
      bpm,
    },
  );
  return { id, title, summary: intro[0], steps };
}

export const COURSES: Course[] = [
  {
    id: 'first-steps',
    title: 'First Steps',
    subtitle: 'Meet your banjo and play your first notes — no left hand yet.',
    lessons: [
      {
        id: 'meet-banjo',
        title: 'Meet your banjo',
        summary: 'Parts of the banjo, the five strings, and tuning.',
        steps: [
          {
            kind: 'info',
            title: 'The 5-string banjo',
            body: [
              'The round body is a drum: a head stretched over a rim. That drum is what gives the banjo its bright, punchy sound.',
              'The long neck has metal frets. You press strings behind the frets with your left hand and pick them over the head with your right.',
              'The fifth string is the short one that starts halfway up the neck. It\'s the banjo\'s secret weapon: a high drone note you\'ll pick with your thumb.',
            ],
            figure: { type: 'banjo-parts' },
          },
          {
            kind: 'info',
            title: 'String numbers',
            body: [
              'Strings are numbered from the floor up when you hold the banjo: the 1st string is the thin one nearest the floor, the 4th is the thickest, and the 5th is the short drone string.',
              'We play in open G tuning: from 5th to 1st the strings are g D G B D. Strum them all without touching the neck and you get a G chord.',
            ],
            figure: { type: 'fretboard', notes: [5, 4, 3, 2, 1].map((s) => ({ string: s as 1, fret: 0 })), caption: 'Open strings, gDGBD' },
          },
          { kind: 'tuner', title: 'Tune up' },
          {
            kind: 'info',
            title: 'Reading tab',
            body: [
              'Banjo music is written as tab: five lines, one per string, with the 1st string on top. A number on a line is the fret to press — 0 means open.',
              'In this app the tab scrolls toward the gold line. Play each note as it reaches the line. The letter under a note says which finger picks it: T thumb, I index, M middle.',
            ],
            figure: { type: 'tab-explainer' },
          },
          {
            kind: 'play',
            title: 'Pick each open string',
            prompt: 'Pick each string as it reaches the line. We\'ll wait for you.',
            source: notesTab([
              { s: 5, rh: 'T' },
              { s: 4, rh: 'T' },
              { s: 3, rh: 'T' },
              { s: 2, rh: 'I' },
              { s: 1, rh: 'M' },
            ]),
            mode: 'wait',
          },
        ],
      },
      {
        id: 'picking-hand',
        title: 'Thumb, index, middle',
        summary: 'Which finger picks which string.',
        steps: [
          {
            kind: 'info',
            title: 'Your picking hand',
            body: [
              'Bluegrass banjo is played with three fingers: thumb (T), index (I) and middle (M), usually with a plastic thumb pick and two metal finger picks.',
              'Rest your ring and pinky fingers lightly on the head, near the bridge. That anchor keeps your hand steady.',
              'The thumb covers strings 5, 4 and 3; the index usually plays the 2nd; the middle plays the 1st.',
            ],
            figure: { type: 'picking-hand' },
          },
          {
            kind: 'play',
            title: 'Each finger on its string',
            prompt: 'Thumb on the 3rd, index on the 2nd, middle on the 1st, thumb on the 5th.',
            source: notesTab([
              { s: 3, rh: 'T' }, { s: 3, rh: 'T' },
              { s: 2, rh: 'I' }, { s: 2, rh: 'I' },
              { s: 1, rh: 'M' }, { s: 1, rh: 'M' },
              { s: 5, rh: 'T' }, { s: 5, rh: 'T' },
            ]),
            mode: 'wait',
          },
          { kind: 'play', title: 'T – I – M', prompt: 'Thumb, index, middle, then the thumb on the 5th. Let every string ring.', source: rollTab(ROLLS.forward.slice(0, 4), G, 1), mode: 'wait' },
          { kind: 'play', title: 'Now in time', prompt: 'Same pattern with a beat. Steady beats more than speed.', source: rollTab(ROLLS.forward.slice(0, 4), ['G', 'G', 'G', 'G'], 1), mode: 'tempo', bpm: 70, backing: true },
        ],
      },
      {
        id: 'pinch',
        title: 'The pinch',
        summary: 'Two strings at once: thumb and middle.',
        steps: [
          {
            kind: 'info',
            title: 'Pinch',
            body: [
              'A pinch is the thumb and middle finger picking at the same moment, as if you were pinching the strings together. Usually it\'s the 5th string and the 1st.',
              'Pinches mark the ends of phrases and endings of tunes.',
            ],
            figure: { type: 'fretboard', notes: [{ string: 5, fret: 0, rh: 'T' }, { string: 1, fret: 0, rh: 'M' }], caption: 'Pinch: 5th + 1st' },
          },
          { kind: 'play', title: 'Pinch', prompt: 'Thumb on the 5th and middle on the 1st, together.', source: notesTab(Array(4).fill({ s: 5, rh: 'T', with: { s: 1, rh: 'M' } })), mode: 'wait' },
          { kind: 'play', title: 'Thumb, then pinch', prompt: 'Low note with the thumb, then a pinch. Boom – chick.', source: rollTab(ROLLS.bumPinch, G, 1), mode: 'wait' },
          { kind: 'play', title: 'Thumb, then pinch, in time', prompt: 'Keep it steady.', source: rollTab(ROLLS.bumPinch, ['G', 'G', 'G', 'G'], 1), mode: 'tempo', bpm: 75, backing: true },
        ],
      },
      {
        id: 'open-tune',
        title: 'Your first piece',
        summary: '"Open G Ramble" — a whole piece on open strings.',
        steps: [
          { kind: 'info', title: 'Open G Ramble', body: ['Everything you\'ve learned, in one short piece: single notes, the T–I–M pattern and pinches. No left hand needed.'] },
          { kind: 'play', title: 'Learn it', prompt: 'At your own speed.', source: openGRamble(), mode: 'wait' },
          { kind: 'play', title: 'Play it with the band', prompt: 'Here comes the band. Keep going even if you miss one.', source: openGRamble(), mode: 'tempo', bpm: 80, backing: true },
        ],
      },
    ],
  },
  {
    id: 'rolls',
    title: 'Rolls',
    subtitle: 'The right-hand patterns that make bluegrass banjo sound like bluegrass banjo.',
    lessons: [
      {
        id: 'alt-thumb',
        title: 'Alternating thumb roll',
        summary: 'T I T M — thumb between every finger.',
        steps: [
          { kind: 'info', title: 'Rolls', body: ['A roll is a right-hand pattern of eight quick notes, repeated. Scruggs-style banjo is built from a handful of rolls.', 'The alternating thumb roll puts the thumb between every finger note: T I T M, T I T M.'] },
          { kind: 'play', title: 'Slowly', prompt: 'T I T M — strings 3, 2, 5, 1, then 4, 2, 5, 1.', source: rollTab(ROLLS.alternatingThumb, G), mode: 'wait' },
          { kind: 'play', title: 'In time', prompt: 'Eight even notes per bar.', source: rollTab(ROLLS.alternatingThumb, ['G', 'G', 'G', 'G']), mode: 'tempo', bpm: 70, backing: true },
        ],
      },
      {
        id: 'forward-roll',
        title: 'Forward roll',
        summary: 'T I M T I M T M — the Scruggs workhorse.',
        steps: [
          { kind: 'info', title: 'Forward roll', body: ['The forward roll moves thumb → index → middle, over and over: T I M T I M T M.', 'Listen for the accents: they fall on notes 1, 4 and 7 — that 3+3+2 lilt is the sound of Scruggs banjo.'] },
          { kind: 'play', title: 'Slowly', prompt: 'Strings 3 2 1 5 2 1 5 1.', source: rollTab(ROLLS.forward, G), mode: 'wait' },
          { kind: 'play', title: 'In time', prompt: 'Let it roll.', source: rollTab(ROLLS.forward, ['G', 'G', 'G', 'G']), mode: 'tempo', bpm: 70, backing: true },
          { kind: 'play', title: 'A bit faster', prompt: 'Relax your hand — speed comes from staying loose.', source: rollTab(ROLLS.forward, ['G', 'G', 'G', 'G']), mode: 'tempo', bpm: 90, backing: true },
        ],
      },
      {
        id: 'backward-roll',
        title: 'Backward roll',
        summary: 'M I T M I T M I.',
        steps: [
          { kind: 'info', title: 'Backward roll', body: ['The same idea, the other direction: middle → index → thumb. Strings 1 2 5 1 2 5 1 2.'] },
          { kind: 'play', title: 'Slowly', prompt: 'Start with the middle finger.', source: rollTab(ROLLS.backward, G), mode: 'wait' },
          { kind: 'play', title: 'In time', prompt: 'Keep it even.', source: rollTab(ROLLS.backward, ['G', 'G', 'G', 'G']), mode: 'tempo', bpm: 75, backing: true },
        ],
      },
      {
        id: 'forward-reverse',
        title: 'Forward-reverse roll',
        summary: 'Out and back: T I M T M I T M.',
        steps: [
          { kind: 'info', title: 'Forward-reverse roll', body: ['Go forward, then come back: T I M T, then M I T M. Strings 3 2 1 5 1 2 3 1.'] },
          { kind: 'play', title: 'Slowly', prompt: 'Forward, then back.', source: rollTab(ROLLS.forwardReverse, G), mode: 'wait' },
          { kind: 'play', title: 'In time', prompt: 'Smooth turnaround in the middle.', source: rollTab(ROLLS.forwardReverse, ['G', 'G', 'G', 'G']), mode: 'tempo', bpm: 75, backing: true },
        ],
      },
      {
        id: 'roll-medley',
        title: 'Rolling in G',
        summary: 'Switch between rolls without stopping.',
        steps: [
          { kind: 'info', title: 'Roll medley', body: ['Real playing mixes rolls. This one switches every two bars: forward, alternating thumb, backward, forward-reverse.'] },
          {
            kind: 'play',
            title: 'Rolling in G',
            prompt: 'Watch for the switch every two bars.',
            source: (() => {
              const parts = [ROLLS.forward, ROLLS.alternatingThumb, ROLLS.backward, ROLLS.forwardReverse].map((r) => rollTab(r, G));
              const events = parts.flatMap((p, i) => p.events.map((e) => ({ ...e, beat: e.beat + i * 8 })));
              return { beatsPerBar: 4, bars: 8, chords: Array(8).fill('G'), events, parts: [{ name: 'A', startBar: 0, bars: 8 }] } as Tab;
            })(),
            mode: 'tempo',
            bpm: 80,
            backing: true,
          },
        ],
      },
    ],
  },
  {
    id: 'left-hand',
    title: 'Left Hand',
    subtitle: 'Fretted notes, your first chords, and changing chords mid-roll.',
    lessons: [
      {
        id: 'fretting',
        title: 'Fretting notes',
        summary: 'Press just behind the fret.',
        steps: [
          {
            kind: 'info',
            title: 'Fretting',
            body: [
              'Left-hand fingers are numbered 1 (index) to 4 (pinky). The fretboard shows the finger number in each dot.',
              'Press with your fingertip just behind the fret — not on top of it. Firm, but don\'t squeeze the life out of it.',
            ],
            figure: { type: 'fretboard', notes: [{ string: 3, fret: 2, lh: 2 }], caption: '3rd string, 2nd fret, middle finger' },
          },
          {
            kind: 'play',
            title: 'Fretted notes',
            prompt: 'Follow the dots on the fretboard.',
            source: notesTab([
              { s: 3, f: 2, rh: 'T', lh: 2 },
              { s: 2, f: 1, rh: 'I', lh: 1 },
              { s: 1, f: 2, rh: 'M', lh: 2 },
              { s: 4, f: 2, rh: 'T', lh: 2 },
              { s: 2, f: 3, rh: 'I', lh: 3 },
              { s: 1, f: 4, rh: 'M', lh: 4 },
            ]),
            mode: 'wait',
          },
        ],
      },
      {
        id: 'chords-gcd',
        title: 'G, C and D7',
        summary: 'Three chords play a thousand songs.',
        steps: [
          { kind: 'info', title: 'Your first chords', body: ['G is free: all open strings. C and D7 each need three fingers — the fretboard shows where.', 'Strum down across the strings with the back of your index finger, or roll through them with T I M.'] },
          { kind: 'play', title: 'Strum G, C, D7', prompt: 'Make the shape, then strum it. We\'ll wait until it sounds right.', source: chordTab([{ chord: 'G' }, { chord: 'C' }, { chord: 'D7' }, { chord: 'G' }], 'strum'), mode: 'wait' },
          { kind: 'play', title: 'Roll over C', prompt: 'Hold the C shape and play a forward roll.', source: rollTab(ROLLS.forward, ['C']), mode: 'wait' },
          { kind: 'play', title: 'Roll over D7', prompt: 'Hold D7 and roll.', source: rollTab(ROLLS.forward, ['D7']), mode: 'wait' },
        ],
      },
      {
        id: 'roll-changes',
        title: 'Changing chords',
        summary: 'Keep rolling while the left hand moves.',
        steps: [
          { kind: 'info', title: 'Change on the beat', body: ['The trick: the right hand never stops. Move the left hand during the last note of the bar so the new chord is ready on beat 1.'] },
          { kind: 'play', title: 'G – C – G – D7', prompt: 'Forward roll through the changes.', source: rollTab(ROLLS.forward, ['G', 'C', 'G', 'D7']), mode: 'wait' },
          { kind: 'play', title: 'With the band', prompt: 'Eight bars, in time.', source: rollTab(ROLLS.forward, ['G', 'G', 'C', 'C', 'G', 'G', 'D7', 'G']), mode: 'tempo', bpm: 75, backing: true },
        ],
      },
      {
        id: 'slides-hammers',
        title: 'Slides and hammer-ons',
        summary: 'Notes the left hand plays by itself.',
        steps: [
          {
            kind: 'info',
            title: 'Left-hand techniques',
            body: [
              'Slide (s): pick the note, then slide the same finger up to the next fret while it rings.',
              'Hammer-on (h): pick an open string, then bring a finger down hard on a fret so it sounds without picking again.',
              'We listen for the picked note; the slide or hammer note is yours to make sound good.',
            ],
          },
          {
            kind: 'play',
            title: 'Slide 2 to 3',
            prompt: '3rd string: pick at the 2nd fret, slide to the 3rd.',
            source: notesTab([
              { s: 3, f: 2, rh: 'T', lh: 2 },
              { s: 3, f: 3, rh: 'T', lh: 2, tech: 's' },
              { s: 2, rh: 'I' },
              { s: 1, rh: 'M' },
            ]),
            mode: 'wait',
          },
          {
            kind: 'play',
            title: 'Hammer-on',
            prompt: '3rd string: pick it open, then hammer the 2nd fret.',
            source: notesTab([
              { s: 3, rh: 'T' },
              { s: 3, f: 2, rh: 'T', lh: 2, tech: 'h' },
              { s: 2, rh: 'I' },
              { s: 1, rh: 'M' },
            ]),
            mode: 'wait',
          },
        ],
      },
      {
        id: 'first-tune',
        title: 'Boil Them Cabbage Down',
        summary: 'Your first real tune — melody, then rolls.',
        steps: [
          { kind: 'info', title: 'Boil Them Cabbage Down', body: ['Every banjo player\'s first tune. First learn the melody as single notes, then hide the melody inside forward rolls — that\'s Scruggs style.'] },
          { kind: 'play', title: 'The melody', prompt: 'Just the tune, one note at a time.', source: { tune: 'boil-cabbage', arrangement: 'melody' }, mode: 'wait' },
          { kind: 'play', title: 'Melody with the band', prompt: 'In time now.', source: { tune: 'boil-cabbage', arrangement: 'melody' }, mode: 'tempo', bpm: 75, backing: true },
          { kind: 'play', title: 'Melody inside rolls', prompt: 'Melody notes are the big ones; the rolls fill in around them.', source: { tune: 'boil-cabbage', arrangement: 'scruggs' }, mode: 'wait' },
          { kind: 'play', title: 'Scruggs style, with the band', prompt: 'Keep the roll going.', source: { tune: 'boil-cabbage', arrangement: 'scruggs' }, mode: 'tempo', bpm: 75, backing: true },
        ],
      },
    ],
  },
  {
    id: 'backup',
    title: 'Backup',
    subtitle: 'Vamping: the off-beat chop that drives a bluegrass band.',
    lessons: [
      {
        id: 'vamp-shapes',
        title: 'Closed chord shapes',
        summary: 'Chords with no open strings, so you can mute them.',
        steps: [
          {
            kind: 'info',
            title: 'Why closed shapes?',
            body: [
              'When someone else takes the lead, the banjo plays backup. The classic backup is the vamp: a short, muted chord on the off-beats, like a snare drum.',
              'To mute a chord you need every string fretted, so vamping uses closed shapes up the neck. Here are G, C and D around the 5th fret.',
            ],
            figure: { type: 'fretboard', notes: voicingNotes(VAMP.G), caption: 'G, closed shape (frets 3–5)' },
          },
          { kind: 'play', title: 'G, C, D shapes', prompt: 'Make each shape and strum it.', source: chordTab([{ chord: 'G', frets: VAMP.G }, { chord: 'C', frets: VAMP.C }, { chord: 'D', frets: VAMP.D }, { chord: 'G', frets: VAMP.G }], 'strum'), mode: 'wait' },
          {
            kind: 'info',
            title: 'The chop',
            body: ['Squeeze the shape, strum, and immediately relax your left hand (keep touching the strings). The chord becomes a short "chuck".'],
          },
          { kind: 'play', title: 'Chop G', prompt: 'Short and sharp.', source: chordTab(Array(4).fill({ chord: 'G', frets: VAMP.G }), 'chop', 2), mode: 'wait' },
        ],
      },
      {
        id: 'vamp-offbeat',
        title: 'Chop on 2 and 4',
        summary: 'The bass plays 1 and 3, you play 2 and 4.',
        steps: [
          { kind: 'info', title: 'Off-beats', body: ['Count 1 2 3 4. The bass plays on 1 and 3 — boom. You chop on 2 and 4 — chuck. Boom-chuck, boom-chuck.'] },
          { kind: 'play', title: 'Vamp in G', prompt: 'Chop on 2 and 4.', source: vampTab(Array(4).fill({ chord: 'G', frets: VAMP.G })), mode: 'tempo', bpm: 80, backing: true },
          { kind: 'play', title: 'G and C', prompt: 'Slide between shapes on beat 1 — the bass covers you.', source: vampTab(['G', 'G', 'C', 'C', 'G', 'G', 'C', 'G'].map((c) => ({ chord: c, frets: VAMP[c as 'G'] }))), mode: 'tempo', bpm: 80, backing: true },
        ],
      },
      {
        id: 'vamp-progression',
        title: 'Vamp a whole tune',
        summary: 'Backup for Boil Them Cabbage Down.',
        steps: [
          { kind: 'info', title: 'Backup for a tune', body: ['Here\'s the backup part for Boil Them Cabbage Down: G, C and D shapes, chopped on 2 and 4.'] },
          { kind: 'play', title: 'Slowly', prompt: 'Learn the changes.', source: { tune: 'boil-cabbage', arrangement: 'backup' }, mode: 'wait' },
          { kind: 'play', title: 'With the band', prompt: 'Boom-chuck.', source: { tune: 'boil-cabbage', arrangement: 'backup' }, mode: 'tempo', bpm: 85, backing: true },
        ],
      },
      {
        id: 'first-trade',
        title: 'Trading breaks',
        summary: 'Lead, then backup — like a real jam.',
        steps: [
          {
            kind: 'info',
            title: 'How a jam works',
            body: [
              'In a bluegrass jam, players take turns playing the melody — a "break" — while everyone else plays backup.',
              'First you take the break while the band backs you up. Then the app\'s banjo takes a break and you vamp behind it.',
              'Headphones help here: the app\'s banjo is loud, and we need to hear yours.',
            ],
          },
          { kind: 'trade', title: 'Boil Them Cabbage Down', prompt: 'Your break first, then backup.', tune: 'boil-cabbage', lead: 'scruggs', bpm: 80 },
        ],
      },
    ],
  },
  {
    id: 'tunes',
    title: 'Tunes & Trading',
    subtitle: 'Jam standards, each learned part by part, then traded.',
    lessons: [
      tuneLesson('tune-cripple-creek', 'cripple-creek', 'Cripple Creek', ['A rolling tune with a high B part — a favourite first tune at jams.'], 85),
      tuneLesson('tune-cumberland-gap', 'cumberland-gap', 'Cumberland Gap', ['A driving tune named for the mountain pass.'], 85),
      tuneLesson('tune-circle', 'circle-unbroken', 'Will the Circle Be Unbroken', ['The gospel song that closes every jam. One long part.'], 85, false),
      tuneLesson('tune-old-joe-clark', 'old-joe-clark', 'Old Joe Clark', ['A mountain tune with an F chord — that\'s the old "modal" sound.', 'The F shape: index on the 2nd string 1st fret, middle on the 3rd string 2nd fret, ring on the 4th string 3rd fret, pinky on the 1st string 3rd fret. The fretboard will show you.'], 90),
      tuneLesson('tune-soldiers-joy', 'soldiers-joy', "Soldier's Joy", ['One of the oldest fiddle tunes still played. The A part starts low on the 4th string.'], 90),
    ],
  },
];

export const ALL_LESSONS: Lesson[] = COURSES.flatMap((c) => c.lessons);
export const LESSON_BY_ID: Record<string, Lesson> = Object.fromEntries(ALL_LESSONS.map((l) => [l.id, l]));
export const COURSE_OF: Record<string, Course> = Object.fromEntries(COURSES.flatMap((c) => c.lessons.map((l) => [l.id, c])));

/** Where a new player starts, by experience. */
export const PLACEMENT: Record<'new' | 'some' | 'rolls', string> = {
  new: 'meet-banjo',
  some: 'alt-thumb',
  rolls: 'fretting',
};

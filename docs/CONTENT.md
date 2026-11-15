# Adding tunes and lessons

## Tunes (`src/content/songs.ts`)

A tune is a melody skeleton; the arranger builds all three arrangements from it.

```ts
{
  id: 'sally-goodin',
  title: 'Sally Goodin',
  meter: 4, bpm: 110, level: 2,
  origin: 'Traditional (fiddle tune), public domain',
  blurb: 'One line for the library card.',
  unlock: { stars: 80 },           // or { lesson: 'some-lesson-id' }
  parts: [
    { name: 'A', bars: 'G: B3 A3 G3 | C: E4 - C4 | D: A3 | G: G3' },
    { name: 'B', bars: '...' },
  ],
}
```

Each bar is `chord: notes`. Notes are scientific pitch (`G3`, `F#4`, `Bb3`) or `-` for "no new
melody note here". In 4/4, 1 note lands on beat 1, 2 notes on beats 1 and 3, 3 notes on the
Scruggs accents (eighth notes 1, 4, 7), 4 notes on every beat. Keep melodies in first position:
D3 (open 4th) up to A4 (1st string, 7th fret); G4 can be the open 5th string. Chords must exist
in the chord library (`G C D D7 Em Am A A7 E E7 F G7 …`).

`npm test` checks every tune: playable frets, melody notes present, roll fingering valid.

Only add tunes that are public domain (traditional, or published before 1929 in the US).

## Lessons (`src/content/lessons.ts`)

Lessons are lists of steps: `info` (text + figure), `tuner`, `play` (a tab or a tune
arrangement, in `wait` or `tempo` mode) and `trade`. Exercise tabs are built with the helpers in
`src/content/exercises.ts` (`rollTab`, `notesTab`, `chordTab`, `vampTab`).

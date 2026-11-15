# Banjo Made Simple — architecture

## Platform decision: web app (PWA) + Firebase, no custom server

* Everything that listens runs **in the browser** (Web Audio + mic). No audio leaves the device.
  This is the same proven pipeline as `banjo-flash-cards`.
* **Google sign-in and saved progress** use Firebase Auth + Firestore (one document per user).
  Firebase is a hosted service — there is no server of our own to run. If Firebase isn't
  configured, the app runs in guest mode with progress saved on the device only.
* Hosted as static files (GitHub Pages workflow included). Installable as a PWA, works offline
  after the first visit (sign-in sync resumes when online).
* Native apps would only be needed if phone mic latency proves too poor for fast rolls; the
  latency calibration screen (ported from flash-cards) compensates for a constant delay.

## Two listening paths (both always running)

```
mic ─► AnalyserNode (16384 samples) ─ every 10 ms ─┬─► ListenerCore  ─► StrumEvent  (vamping, chords)
                                                   └─► PickCore      ─► PickEvent   (single notes, rolls, pinches)
```

### Vamping / chords — `audio/listener.ts`, `audio/analyzer.ts`, `audio/matcher.ts` (ported)
Onset → re-analyse the ringing chord every 60 ms → cosine match against every voicing
template → verdict (`correct`, `wrongChord`, `wrongPosition`, `partial`, `unclear`).
New: `firstEval` is configurable. Vamp chops are muted ~0.1–0.15 s after the strike, so the
vamp screens ask for the first check at 0.14 s instead of 0.2 s.

### Single-note picking — `audio/picker.ts` (new)
A banjo rings: when you pick the 2nd string, the 3rd and 5th you picked a moment ago are still
sounding, so "what pitches are in the spectrum" isn't "what did you just play". For each onset:

1. **Before** window: ~0.11 s of audio ending just before the onset. **After** window: the 0.09 s
   right after it. Both → semitone peak spectrum (C3..C7), amplitude-normalised.
2. **Delta** = after − before (positive part): only what got *louder* — the new note(s).
3. **Harmonic salience** of each candidate pitch on the fretboard (D3..A5) = weighted sum of the
   delta at its harmonics. The top candidate is the note you played; a second candidate that is
   strong and not an overtone of the first is a pinch partner.
4. A low note (below A3) may have a near-silent fundamental on a phone mic, so it can be
   recognised by its 2nd/3rd harmonics.
5. The judge asks "is the expected note among the heard notes?" — so playing the open 4th string
   (D3) when the 1st (D4) was asked is *wrong*, even though D3's overtone is D4.

Hammer-ons / pull-offs / slides have no pick attack. In wait (Learn) mode they're judged by
following the pitch: after the starting note is picked, the tuner's pitch estimate (120 ms
window) is polled until it reaches the target fret; a hammer or pull-off strong enough to fire
an onset on the target pitch also counts. If it doesn't arrive within 2.5 s, that's a wrong
try and the cursor goes back to the starting note. In tempo mode they're shown only.

### What you touched (feedback)
* Pick: the heard pitch is mapped to the fretboard position nearest the expected one (same
  string if possible) and drawn as a ghost dot on the neck with its note name.
* Chord: the best-matching voicing's frets are drawn as ghost dots.

### Backing audio vs. the mic
The backing band would leak into the mic. Two backing modes:
* **Speaker**: a pure-sine bass kept at or below B2 (≤ 123 Hz, under the detectors' C3 floor —
  sub-90 Hz would be inaudible on phone speakers), with a soft attack so it doesn't look like a
  pick, plus a brushed "chuck" high-passed above 7.5 kHz. The pick detector also ignores any
  onset whose in-range tonal energy is a small share of the overall level (tested: bass alone
  produces no notes; rolls over the bass are read correctly).
* **Headphones**: adds a strummed guitar and normal-octave bass.
  Trading rounds where the app plays banjo while you vamp ask for headphones; without them the
  vamp round is judged on timing only, and the app says so.

### Robustness rules learned while testing
* Picking onsets use a max-of-last-5-frames reference ("SuperFlux") over 80 Hz–6 kHz, so beating
  between ringing strings isn't an onset but a repeated note's pick click is. The app's own
  ticks and chucks therefore stay above 8 kHz.
* A pick event needs either fresh energy (≥ 12 % new) or a strong attack; a weak false onset
  just before a real pick is replaced by it.
* Wait mode ignores echoes: the note/chord just played right, heard again within 2 s, and the
  same wrong sound repeating within 1.5 s, count once.

## Content model — `music/tab.ts`, `music/arranger.ts`, `content/*`

* `Tab` = list of events `{ beat, notes: [{ string 1–5, fret, rh: 'T'|'I'|'M', lh?: 1–4, tech? }] }` plus
  chord per measure and part boundaries. A `Tab` drives the highway, fretboard, scoring and the
  synthesized reference banjo.
* A **Tune** is authored compactly: key, meter, tempo, parts of measures `chord + melody notes`.
  The **arranger** generates three arrangements:
  * `melody` — the melody as single picked notes (beginner),
  * `scruggs` — melody notes on the thumb accents of forward rolls (3+3+2 syncopation), the other
    roll notes filled from the chord shape; a small dynamic program chooses strings/fingers so no
    finger or string repeats back-to-back,
  * `backup` — vamp chops on beats 2 and 4 with closed chord shapes near fret 5–10.
* 25 public-domain tunes + a few original exercise pieces. The catalogue is data, so thousands
  of tunes is a content task (and a future importer), not a code change.

> The tune melodies were written from memory as simplified skeletons and arranged automatically;
> they should be reviewed by a banjo teacher before launch.

## Learning model — `content/lessons.ts`

Courses → lessons → steps. Step kinds:
`info` (explain + animated fretboard), `tune` (tuner), `pick` (single notes, wait mode),
`chord` (form/strum a chord, wait mode), `pattern` (a roll/exercise tab, wait then tempo),
`vamp` (chop on 2 & 4 over a progression with backing), `play` (a tune arrangement in tempo with
backing), `trade` (you lead + app backs; then app leads + you vamp).

## Game model — `game/performance.ts` (pure, unit tested)

A `Performance` is the timeline of expected events (time, pitches or chord, kind). Input events
(PickEvent / StrumEvent with latency correction) are matched to the nearest unjudged expected
event within a tempo-dependent window. Wait mode: the clock stops at the next event until it is
played. Output: per-event `hit | wrong | miss` (+ what was heard) and accuracy → stars.

## Progress, awards, auth — `state/*`

* `Progress` (stars per lesson/arrangement, completed steps, streak days, minutes per day,
  awards, settings) — pure reducer functions, unit tested.
* Persistence: always localStorage; when signed in, Firestore `users/{uid}` with merge-by-max on
  login (so playing offline as a guest and then signing in loses nothing).
* Awards are predicates over `Progress`, checked after every update.

## UI — `ui/*`

Home (course path) · Lesson runner · Song library · Song player (tab highway + fretboard,
wait/tempo, part select, arrangement select) · Awards · Profile (sign-in, streak, settings,
calibration, tuner).

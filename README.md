# Banjo Made Simple

Learn 5-string banjo the way the Simply apps teach piano and guitar: play your real banjo,
the app listens through the microphone, tells you if you're right, and shows you where your
fingers go. A web app (installable PWA) for phones, tablets and computers.

- **Learning path** — 6 courses, 29 lessons: from never having held a banjo → tuning (guided,
  string by string, plus tuning by ear) → the picking hand → every roll pattern in its own
  lesson (alternating thumb, forward, backward, forward-reverse, index-leading,
  middle-leading) → the left hand and chords → left-hand techniques (slides 2–3, 2–4, 2–5;
  hammer-ons; pull-offs; licks) → backup (vamping) → tunes and trading breaks.
- **It listens** — two detectors run at once:
  - *single-note picking* (rolls, melody, pinches), new in this app;
  - *multi-string vamping/strumming* (chords), from banjo-flash-cards.
- **Shows your fingers** — fretting-hand finger numbers on the neck, picking finger (T/I/M)
  per string, and when you miss, a ghost marker of what it heard you play.
- **Learn mode** (the music waits for each note) and **Play along** (in time, with a
  synthesized band; 60/80/100 % tempo; A part / B part / whole tune).
- **Trading breaks** — after the vamping lessons, tune lessons have you take the lead while the
  band backs you, then the app's banjo takes a break while you vamp behind it.
- **25 public-domain tunes to earn** (from lessons and star totals), each with Melody,
  Scruggs-roll and Backup arrangements generated from a melody skeleton.
- **A voice walks you through every lesson step** (pre-generated with the open-source Kokoro
  neural voice, Apache 2.0; replay and on/off in the lesson bar; it stops when you start
  playing so the mic doesn't hear it).
- **Stars, awards, streaks, daily goal, daily workout.**
- **Google sign-in** (Firebase) keeps progress across devices; without it, guest mode saves on
  the device. Guest progress is merged into the account on first sign-in.

Everything you play is analysed in the browser; no audio leaves the device.

## Develop

```sh
npm install
npm test            # detectors on synthesized banjo audio, arranger, game rules, progress
npm run dev         # http://localhost:5173
npm run dev:https   # https://<LAN-IP>:5173 — phones only allow the mic over https
npm run build
```

### Narration

Lesson narration clips live in `public/voice/` (one MP3 per step, named by a hash of its text).
After editing lesson text, regenerate — only changed clips are rebuilt, and `npm test` fails if
a clip is missing:

```sh
pip install kokoro-onnx soundfile   # once; also needs ffmpeg
npm run voice                       # downloads the voice model (~350 MB) on first run
```

How text is turned into speech (finger letters, tab shorthand like 2s3) is in
`src/content/narration.ts`.

### Google sign-in (optional)

1. Create a Firebase project → add a **Web app** → copy its config.
2. **Authentication → Sign-in method → Google**: enable. Under **Settings → Authorized domains**
   add your site's domain (e.g. `<you>.github.io`).
3. **Firestore Database**: create it, then publish the rules in [`firestore.rules`](firestore.rules).
4. Locally: copy `.env.example` to `.env.local` and fill it in. For GitHub Pages: add the same
   four values as repository *variables* (they're public web config, not secrets).

### Deploy

Pushing to `main` runs `.github/workflows/deploy.yml` (test → build → GitHub Pages at
`https://<owner>.github.io/banjo-made-simple/`). One-time: **Settings → Pages → Source: GitHub
Actions**. Set `BASE_PATH` to deploy elsewhere.

## How it's built

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and the research notes on the Simply apps'
mechanics in [docs/RESEARCH.md](docs/RESEARCH.md). Adding tunes: [docs/CONTENT.md](docs/CONTENT.md).

### Testing in a real browser with a fake microphone

`test/e2e/make-tune-wav.ts` renders a synthesized performance of any tune arrangement to a WAV;
Chromium can use it as the microphone:

```sh
npx vite-node test/e2e/make-tune-wav.ts /tmp/boil.wav boil-cabbage scruggs 90 3.07
chromium --use-fake-ui-for-media-stream --use-fake-device-for-media-stream \
  --use-file-for-fake-audio-capture=/tmp/boil.wav%noloop http://localhost:5173/#/song/boil-cabbage
```

(3.07 s = the app's 0.4 s start delay + a 4-beat count-in at 90 bpm.)

## Status and known limits

- Detection is verified on synthesized banjo audio (unit tests + full runs in Chromium:
  open strings, chord drills, a melody, Scruggs rolls at full tempo and a vamp part all scored
  100 %; wrong playing and silence score ~0 %). **It still needs tuning on real banjos and phone
  mics** — turn on *Me → Show what the detectors hear* and record what it reports.
- The mic hears pitch, not fingers: the same note on another string (e.g. B on the open 2nd vs.
  the 3rd string 4th fret) can't be told apart, so the app shows the most likely place.
- Hammer-ons, pull-offs and slides are judged in Learn mode (the app follows the pitch of the
  ringing string after you pick the starting note). Playing along in time, they're shown but
  not scored — a quick slide inside a roll is too short to check reliably yet.
- Through a speaker the band is deliberately light (soft bass under the mic's range, a high
  brushed rhythm); headphones give the full band and are needed to check chords while the
  app's banjo plays.
- Tune melodies were written from memory as simplified skeletons: have a banjo teacher review
  them before launch.

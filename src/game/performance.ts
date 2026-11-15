// Judging a performance of a Tab against what the mic heard. Pure (no audio, no DOM), so
// the rules are unit tested.
//
// Two modes, like the Simply apps:
//  * wait  — the music stops at each note until it's played right. Wrong attempts are
//            recorded (with what was heard) so the fretboard can show what you touched.
//  * tempo — notes come in time. Each target has a timing window; a pick or strum in the
//            window is matched to it. Extra notes are never penalised (a strum also looks
//            like picks; the band can leak into the mic) — only expected notes are judged.
//
// Picked notes come from the pick detector (PickEvent.heard = pitches); chord targets from
// the strum detector (matcher verdict). Technique notes (hammer-on, slide…) aren't judged.

import type { Verdict } from '../audio/matcher';
import { Frets } from '../music/library';
import { judgedPitches, pitchOf, Tab, TabEvent, Tech } from '../music/tab';

export type Outcome = 'pending' | 'hit' | 'partial' | 'wrong' | 'miss' | 'skip';

export interface Target {
  index: number;
  beat: number;
  /** Seconds from the start, at the performance tempo. */
  time: number;
  kind: 'pick' | 'chord';
  event: TabEvent;
  /** Pitches that must be heard (pick targets). */
  pitches: number[];
  chord?: string;
  frets?: Frets;
  judged: boolean;
  outcome: Outcome;
  /** Wrong attempts so far (wait mode) — or 1 if a wrong note landed in the window (tempo). */
  attempts: number;
  /** What was heard on the last wrong attempt. */
  heard?: number[];
  heardChord?: string | null;
  /** Timing error of the hit, seconds (positive = late). */
  offset?: number;
  /** Tempo mode: some but not all pitches of a pinch were heard. */
  partialSeen?: boolean;
  /** A hammer-on / pull-off / slide target (judged in wait mode by following the pitch). */
  tech?: Tech;
  /** For a technique target: the picked note it starts from. */
  base?: number;
}

export interface PerfOptions {
  mode: 'wait' | 'tempo';
  secPerBeat: number;
  /** Max timing window either side of a note (s). Shrinks for fast passages. */
  window?: number;
  /**
   * Judge chords on timing only (any strum in the window is a hit). Used when the app's
   * own banjo plays through a speaker while you vamp: chord recognition would be unreliable.
   */
  chordTimingOnly?: boolean;
}

export interface Feedback {
  target: Target | null;
  result: 'hit' | 'partial' | 'wrong' | 'stray' | 'ignored';
}

/** How long after a target's window to wait for a late-arriving verdict before calling it. */
const PICK_SETTLE = 0.2; // pick events arrive PICK_DELAY (0.14 s) after the onset
const CHORD_SETTLE = 0.45; // strum checks continue for a while; vamp chops are judged early

/** Wait mode: the same wrong sound again within this long is one try (a ringing chord re-triggers). */
const SAME_TRY = 1.5;
/** Wait mode: the note/chord just played right, heard again this soon, is its own echo. */
const ECHO = 2;
/**
 * Wait mode: after the starting note of a slide / hammer-on / pull-off is picked, how long
 * the pitch has to reach the target before we ask for another go.
 */
export const TECH_WINDOW = 2.5;

export class Performance {
  readonly targets: Target[];
  private cursor = 0;
  private lastWrong: { key: string; time: number; index: number } | null = null;
  /** Wait mode: what was just played right — it keeps ringing and can re-trigger. */
  private lastHit: { key: string; time: number } | null = null;

  /** When the current technique target's starting note was picked. */
  private techSince = 0;

  private echo(key: string, time: number) {
    return !!this.lastHit && this.lastHit.key === key && time - this.lastHit.time < ECHO;
  }
  constructor(tab: Tab, readonly opts: PerfOptions) {
    let lastPicked: number | undefined;
    this.targets = tab.events.map((e, i) => {
      // A technique note (all of its notes sounded by the left hand) is judged in wait mode
      // by following the pitch of the ringing string; in tempo mode it's shown only.
      const tech = e.kind === 'pick' && e.notes.length > 0 && e.notes.every((n) => n.tech) ? e.notes[0].tech : undefined;
      const pitches = e.kind === 'pick' ? (tech ? e.notes.map(pitchOf) : judgedPitches(e)) : [];
      const base = tech ? lastPicked : undefined;
      if (e.kind === 'pick' && !tech) lastPicked = i;
      return {
        tech,
        base,
        index: i,
        beat: e.beat,
        time: e.beat * opts.secPerBeat,
        kind: e.kind,
        event: e,
        pitches,
        chord: e.chord,
        frets: e.frets,
        judged: e.kind === 'chord' || (tech ? opts.mode === 'wait' && base !== undefined : pitches.length > 0),
        outcome: 'pending' as Outcome,
        attempts: 0,
      };
    });
    if (opts.mode === 'wait') this.skipUnjudged();
  }

  /** Wait mode: the target being waited for. */
  get current(): Target | null {
    return this.targets[this.cursor] ?? null;
  }

  get done(): boolean {
    return this.targets.every((t) => t.outcome !== 'pending');
  }

  /** Timing window for a target: the max, but under half the gap to its neighbours. */
  windowFor(t: Target): number {
    const max = this.opts.window ?? (t.kind === 'chord' ? 0.18 : 0.15);
    const prev = this.targets[t.index - 1];
    const next = this.targets[t.index + 1];
    const gaps = [prev ? t.time - prev.time : Infinity, next ? next.time - t.time : Infinity];
    return Math.max(0.05, Math.min(max, 0.45 * Math.min(...gaps)));
  }

  private skipUnjudged() {
    while (this.current && !this.current.judged) {
      this.current.outcome = 'skip';
      this.cursor++;
    }
  }

  /** Count a wrong try in wait mode, unless it's the same wrong sound repeating. */
  private wrongTry(t: Target, key: string, time: number) {
    const l = this.lastWrong;
    if (!(l && l.index === t.index && l.key === key && time - l.time < SAME_TRY)) t.attempts++;
    this.lastWrong = { key, time, index: t.index };
  }

  /** Wait mode: move on to the next target. */
  private next(time: number) {
    this.cursor++;
    this.skipUnjudged();
    if (this.current?.tech) this.techSince = time;
  }

  private hit(t: Target, time: number | null) {
    t.outcome = 'hit';
    if (time !== null) t.offset = time - t.time;
  }

  /** A picked note (or pinch) was heard. `time` = onset, seconds from start, latency-corrected. */
  pick(time: number, heard: number[]): Feedback {
    if (this.opts.mode === 'wait') {
      const t = this.current;
      if (!t || t.kind !== 'pick') return { target: t, result: 'ignored' };
      const got = t.pitches.filter((p) => heard.includes(p)).length;
      const key = [...heard].sort().join('+');
      if (t.tech) {
        // A hard hammer-on or a pull-off "plucks" the string: that onset lands on the target.
        if (got === t.pitches.length) return this.techHit(t, time);
        // Picking the starting note again: a fresh go at the slide.
        const base = this.targets[t.base!];
        if (base.pitches.every((p) => heard.includes(p))) {
          this.techSince = time;
          return { target: t, result: 'ignored' };
        }
      }
      if (got === t.pitches.length) {
        this.lastHit = { key, time };
        this.hit(t, null);
        this.next(time);
        return { target: t, result: 'hit' };
      }
      if (this.echo(key, time)) return { target: t, result: 'ignored' };
      this.wrongTry(t, key, time);
      t.heard = heard;
      return { target: t, result: got > 0 ? 'partial' : 'wrong' };
    }

    const cands = this.targets.filter((t) => t.kind === 'pick' && t.judged && t.outcome === 'pending' && Math.abs(t.time - time) <= this.windowFor(t));
    if (!cands.length) return { target: null, result: 'stray' };
    const byDist = (a: Target, b: Target) => Math.abs(a.time - time) - Math.abs(b.time - time);
    const full = cands.filter((t) => t.pitches.every((p) => heard.includes(p))).sort(byDist)[0];
    if (full) {
      this.hit(full, time);
      return { target: full, result: 'hit' };
    }
    const part = cands.filter((t) => t.pitches.some((p) => heard.includes(p))).sort(byDist)[0];
    if (part) {
      part.partialSeen = true;
      return { target: part, result: 'partial' };
    }
    const near = cands.sort(byDist)[0];
    near.attempts = 1;
    near.heard = heard;
    return { target: near, result: 'wrong' };
  }

  private techHit(t: Target, time: number): Feedback {
    this.lastHit = { key: t.pitches.join('+'), time };
    this.hit(t, null);
    this.next(time);
    return { target: t, result: 'hit' };
  }

  /**
   * Wait mode: the pitch of what's ringing right now (null = nothing clear), polled while a
   * slide / hammer-on / pull-off is expected. Reaching the target pitch completes it. If it
   * doesn't arrive in time, that's a wrong try and we go back to the starting note.
   */
  pitch(time: number, midi: number | null): Feedback {
    const t = this.current;
    if (this.opts.mode !== 'wait' || !t?.tech) return { target: t, result: 'ignored' };
    if (midi !== null && t.pitches.includes(midi)) return this.techHit(t, time);
    if (time - this.techSince < TECH_WINDOW) return { target: t, result: 'ignored' };
    t.attempts++;
    t.heard = midi === null ? [] : [midi];
    const base = this.targets[t.base!];
    base.outcome = 'pending';
    this.cursor = base.index;
    this.lastHit = null;
    return { target: t, result: 'wrong' };
  }

  /**
   * A strum/chop check. The strum detector re-checks a ringing chord several times;
   * accept the first correct one, and only call it wrong on the `final` check.
   */
  strum(time: number, verdict: Verdict, heardChord: string | null, final: boolean): Feedback {
    const correct = verdict === 'correct';
    if (this.opts.mode === 'wait') {
      const t = this.current;
      if (!t || t.kind !== 'chord') return { target: t, result: 'ignored' };
      if (correct) {
        this.lastHit = { key: `chord:${t.chord}`, time };
        this.hit(t, null);
        this.next(time);
        return { target: t, result: 'hit' };
      }
      if (!final || this.echo(`chord:${heardChord}`, time)) return { target: t, result: 'ignored' };
      this.wrongTry(t, `chord:${heardChord}`, time);
      t.heardChord = heardChord;
      return { target: t, result: 'wrong' };
    }

    const cands = this.targets
      .filter((t) => t.kind === 'chord' && t.outcome === 'pending' && Math.abs(t.time - time) <= this.windowFor(t))
      .sort((a, b) => Math.abs(a.time - time) - Math.abs(b.time - time));
    const t = cands[0];
    if (!t) return { target: null, result: 'stray' };
    if (correct || this.opts.chordTimingOnly) {
      this.hit(t, time);
      return { target: t, result: 'hit' };
    }
    if (!final) return { target: t, result: 'ignored' };
    t.attempts = 1;
    t.heardChord = heardChord;
    if (verdict === 'partial') {
      t.partialSeen = true;
      return { target: t, result: 'partial' };
    }
    return { target: t, result: 'wrong' };
  }

  /**
   * Tempo mode: close every target whose window (plus time for a late verdict) has passed.
   * Returns the targets closed now.
   */
  advance(now: number): Target[] {
    if (this.opts.mode === 'wait') return [];
    const closed: Target[] = [];
    for (const t of this.targets) {
      if (t.outcome !== 'pending') continue;
      if (!t.judged) {
        if (now >= t.time) {
          t.outcome = 'skip';
          closed.push(t);
        }
        continue;
      }
      const settle = t.kind === 'chord' ? CHORD_SETTLE : PICK_SETTLE;
      if (now < t.time + this.windowFor(t) + settle) continue;
      t.outcome = t.partialSeen ? 'partial' : t.attempts ? 'wrong' : 'miss';
      closed.push(t);
    }
    return closed;
  }

  /** End now (e.g. the song finished): anything still pending is a miss. */
  finish(): void {
    for (const t of this.targets) if (t.outcome === 'pending') t.outcome = t.judged ? (t.partialSeen ? 'partial' : t.attempts ? 'wrong' : 'miss') : 'skip';
  }

  summary() {
    const judged = this.targets.filter((t) => t.judged);
    const count = (o: Outcome) => judged.filter((t) => t.outcome === o).length;
    const hits = count('hit');
    const partials = count('partial');
    const offsets = judged.filter((t) => t.offset !== undefined).map((t) => Math.abs(t.offset!));
    let accuracy: number;
    if (this.opts.mode === 'wait') {
      // First-try rate: every wrong attempt counts against you.
      const attempts = judged.reduce((s, t) => s + t.attempts, 0);
      accuracy = judged.length ? hits / (hits + attempts) : 1;
    } else accuracy = judged.length ? (hits + 0.5 * partials) / judged.length : 1;
    return {
      judged: judged.length,
      hits,
      partials,
      wrong: count('wrong'),
      /** Wrong tries (wait mode: every wrong attempt, even on notes later played right). */
      wrongTries: judged.reduce((s, t) => s + t.attempts, 0),
      misses: count('miss'),
      accuracy,
      /** Mean absolute timing error of hits (s), tempo mode. */
      timing: offsets.length ? offsets.reduce((a, b) => a + b, 0) / offsets.length : null,
      pickHits: judged.filter((t) => t.kind === 'pick' && t.outcome === 'hit').length,
      chordHits: judged.filter((t) => t.kind === 'chord' && t.outcome === 'hit').length,
    };
  }
}

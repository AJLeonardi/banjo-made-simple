// The backing band and the app's banjo, scheduled ahead on the AudioContext clock.
//
// Backing modes (Settings → "How do you hear the app?"):
//  * speaker ("mic-safe"): sub-bass under 90 Hz + a high brushed chuck above 7.5 kHz. Both
//    sit outside what the detectors listen to, so the band can't be mistaken for you.
//  * headphones ("full"): bass, a strummed guitar boom-chuck, and the same chuck.
// The app's banjo (Listen, demo, and its breaks when trading) is always audible — that's
// why trading asks for headphones.

import { pitchOf, Tab, TabEvent } from '../music/tab';
import { CHORD_BY_ID } from '../music/library';
import { banjoBuffer, bassNote, chuck, guitarBuffer, playBuffer, tick } from './voices';

export type BackingMode = 'speaker' | 'headphones';

export interface BandPlan {
  tab: Tab;
  secPerBeat: number;
  /** AudioContext time of beat 0 of the tab. */
  start: number;
  /** Count-in ticks before `start` (beats). */
  countIn: number;
  /** Play the bass/chuck/guitar. */
  backing: boolean;
  /** Banjo events the app plays itself (Listen, or its break when trading). */
  banjo?: TabEvent[];
  /** Banjo chops the app plays (its backup while you lead, headphones only). */
  banjoChops?: TabEvent[];
}

const LOOKAHEAD = 0.25;

/**
 * Bass pitch for a chord. Speaker mode keeps the bass between E1 and B2 (≤ 123 Hz), under
 * the detectors' C3 floor, and walks down to the fifth rather than up into banjo range.
 * Headphones mode uses the normal E2–D#3 octave and the fifth above.
 */
function bassMidi(chord: string, micSafe: boolean, fifth: boolean): number {
  const root = CHORD_BY_ID[chord]?.root ?? 7;
  let m = 40 + ((root - 4 + 12) % 12); // E2..D#3
  if (!micSafe) return fifth ? m + 7 : m;
  if (m > 47) m -= 12; // keep ≤ B2
  return fifth ? m - 5 : m;
}

/** Guitar strum voicing: root position triad around G3–G4. */
function guitarChord(chord: string): number[] {
  const c = CHORD_BY_ID[chord];
  if (!c) return [];
  const pcs = c.pcKey.split(',').map(Number);
  const root = 52 + ((c.root - 4 + 12) % 12); // E3..D#4
  const out = [root - 12];
  for (const p of pcs) {
    let m = root;
    while (m % 12 !== p) m++;
    out.push(m);
  }
  return out.sort((a, b) => a - b);
}

export class Band {
  private master: GainNode;
  private timer = 0;
  private items: { time: number; play: () => void }[] = [];
  private next = 0;

  constructor(private ctx: AudioContext, private mode: BackingMode, volume = 0.8) {
    this.master = ctx.createGain();
    this.master.gain.value = volume;
    this.master.connect(ctx.destination);
  }

  /** Schedule everything in the plan; audio is queued in small batches just ahead of time. */
  start(plan: BandPlan) {
    this.stop();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.8;
    this.master.connect(this.ctx.destination);
    const { ctx } = this;
    const dest = this.master;
    const spb = plan.secPerBeat;
    const bpb = plan.tab.beatsPerBar;
    const micSafe = this.mode === 'speaker';
    const items: { time: number; play: () => void }[] = [];

    for (let b = 0; b < plan.countIn; b++) {
      const t = plan.start - (plan.countIn - b) * spb;
      items.push({ time: t, play: () => tick(ctx, dest, t, b % bpb === 0, 1) });
    }

    if (plan.backing) {
      plan.tab.chords.forEach((chord, bar) => {
        for (let beat = 0; beat < bpb; beat++) {
          const t = plan.start + (bar * bpb + beat) * spb;
          const onBass = bpb === 3 ? beat === 0 : beat % 2 === 0;
          if (onBass) {
            const m = bassMidi(chord, micSafe, bpb === 4 && beat === 2);
            items.push({ time: t, play: () => bassNote(ctx, dest, m, t, spb * (bpb === 3 ? 1.5 : 1.6), micSafe ? 0.7 : 0.5, micSafe) });
          } else {
            items.push({ time: t, play: () => chuck(ctx, dest, t, micSafe ? 0.35 : 0.2) });
            if (!micSafe) {
              const notes = guitarChord(chord);
              items.push({
                time: t,
                play: () => notes.forEach((m, i) => playBuffer(ctx, dest, guitarBuffer(ctx, m), t + i * 0.012, 0.16, spb * 0.45)),
              });
            }
          }
        }
      });
    }

    for (const e of plan.banjo ?? []) {
      const t = plan.start + e.beat * spb;
      items.push({ time: t, play: () => playEvent(ctx, dest, e, t, spb) });
    }
    for (const e of plan.banjoChops ?? []) {
      const t = plan.start + e.beat * spb;
      items.push({ time: t, play: () => playEvent(ctx, dest, { ...e, style: 'chop' }, t, spb, 0.5) });
    }

    this.items = items.sort((a, b) => a.time - b.time);
    this.next = 0;
    const pump = () => {
      const until = ctx.currentTime + LOOKAHEAD;
      while (this.next < this.items.length && this.items[this.next].time < until) {
        const it = this.items[this.next++];
        if (it.time >= ctx.currentTime - 0.02) it.play();
      }
      if (this.next >= this.items.length) clearInterval(this.timer);
    };
    pump();
    this.timer = window.setInterval(pump, 50);
  }

  stop() {
    clearInterval(this.timer);
    this.items = [];
    try {
      // Cut whatever is already queued.
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(0, this.ctx.currentTime, 0.02);
      const m = this.master;
      setTimeout(() => m.disconnect(), 200);
    } catch {
      /* already disconnected */
    }
  }
}

/** Sound one tab event on the app's banjo (a pick, pinch, strum or chop). */
export function playEvent(ctx: BaseAudioContext, dest: AudioNode, e: TabEvent, when: number, secPerBeat: number, gain = 0.45) {
  if (e.kind === 'chord') {
    const notes = [...e.notes].sort((a, b) => b.string - a.string); // strum 4th → 1st
    const cut = e.style === 'chop' ? 0.12 : undefined;
    notes.forEach((n, i) => playBuffer(ctx, dest, banjoBuffer(ctx, pitchOf(n)), when + i * 0.01, gain * 0.7, cut));
    return;
  }
  const dur = Math.max(0.15, e.dur * secPerBeat * 2.5);
  for (const n of e.notes) playBuffer(ctx, dest, banjoBuffer(ctx, pitchOf(n)), when, n.melody ? gain * 1.15 : gain, dur);
}

/** Play an event right now (the "hear it" button in wait mode). */
export function previewEvent(ctx: AudioContext, e: TabEvent) {
  playEvent(ctx, ctx.destination, e, ctx.currentTime + 0.02, 0.5, 0.5);
}

// Synthesized instruments for the backing band and the app's own banjo (Web Audio).
// Plucked strings are Karplus-Strong rendered into AudioBuffers once per pitch and cached.

import { midiToFreq } from '../music/notes';

const cache = new Map<string, AudioBuffer>();

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32 - 0.5;
  };
}

/**
 * Karplus-Strong pluck. `bright` 0..1 shapes the excitation (banjo ~0.9, guitar ~0.4);
 * `decay` per-period loss; `seconds` length of the buffer.
 */
function renderPluck(ctx: BaseAudioContext, midi: number, opts: { bright: number; decay: number; seconds: number; click: number }, seed: number): AudioBuffer {
  const sr = ctx.sampleRate;
  const n = Math.round(sr * opts.seconds);
  const buf = ctx.createBuffer(1, n, sr);
  const y = buf.getChannelData(0);
  const period = sr / midiToFreq(midi);
  const L = Math.floor(period - 0.5);
  const frac = period - 0.5 - L;
  const r = rng(seed);
  const peak = Math.max(1, Math.round(0.18 * L));
  for (let t = 0; t < L + 2 && t < n; t++) {
    const tri = t <= peak ? t / peak : Math.max(0, (L - t) / (L - peak));
    y[t] = (1 - opts.bright) * tri * 1.6 + opts.bright * (tri + 0.6 * r());
  }
  let mean = 0;
  for (let t = 0; t < L + 2; t++) mean += y[t] / (L + 2);
  for (let t = 0; t < L + 2 && t < n; t++) y[t] -= mean;
  for (let t = L + 2; t < n; t++) {
    const a = y[t - L], b = y[t - L - 1], c = y[t - L - 2];
    y[t] = opts.decay * 0.5 * ((1 - frac) * (a + b) + frac * (b + c));
  }
  // Pick attack and a short fade at the end.
  const click = Math.round(sr * 0.004);
  for (let t = 0; t < click && t < n; t++) y[t] += r() * opts.click * (1 - t / click);
  const fade = Math.round(sr * 0.05);
  for (let t = Math.max(0, n - fade); t < n; t++) y[t] *= (n - t) / fade;
  return buf;
}

export function banjoBuffer(ctx: BaseAudioContext, midi: number): AudioBuffer {
  const key = `banjo:${midi}:${ctx.sampleRate}`;
  let b = cache.get(key);
  if (!b) cache.set(key, (b = renderPluck(ctx, midi, { bright: 0.85, decay: 0.995, seconds: 1.6, click: 0.5 }, midi * 7 + 1)));
  return b;
}

export function guitarBuffer(ctx: BaseAudioContext, midi: number): AudioBuffer {
  const key = `guitar:${midi}:${ctx.sampleRate}`;
  let b = cache.get(key);
  if (!b) cache.set(key, (b = renderPluck(ctx, midi, { bright: 0.35, decay: 0.997, seconds: 1.4, click: 0.1 }, midi * 13 + 5)));
  return b;
}

let noise: AudioBuffer | null = null;
function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  if (noise && noise.sampleRate === ctx.sampleRate) return noise;
  const n = Math.round(ctx.sampleRate * 0.2);
  noise = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = noise.getChannelData(0);
  const r = rng(99);
  for (let i = 0; i < n; i++) d[i] = r() * 2;
  return noise;
}

/** Play a buffer at `when` with gain, optionally cut short (a muted chop). */
export function playBuffer(ctx: BaseAudioContext, dest: AudioNode, buf: AudioBuffer, when: number, gain: number, cutAfter?: number) {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, when);
  if (cutAfter !== undefined) {
    g.gain.setValueAtTime(gain, when + cutAfter);
    g.gain.exponentialRampToValueAtTime(0.0001, when + cutAfter + 0.04);
  }
  src.connect(g).connect(dest);
  src.start(when);
  src.stop(when + (cutAfter !== undefined ? cutAfter + 0.06 : buf.duration));
}

/**
 * Bass note. `micSafe` (speaker mode): a pure sine (no overtones landing on banjo notes),
 * low-passed at 140 Hz, with a soft 30 ms attack so it doesn't look like a pick onset.
 */
export function bassNote(ctx: BaseAudioContext, dest: AudioNode, midi: number, when: number, dur: number, gain: number, micSafe: boolean) {
  const osc = ctx.createOscillator();
  osc.type = micSafe ? 'sine' : 'triangle';
  osc.frequency.value = midiToFreq(midi);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(gain, when + (micSafe ? 0.03 : 0.01));
  g.gain.exponentialRampToValueAtTime(gain * 0.3, when + dur * 0.8);
  g.gain.linearRampToValueAtTime(0, when + dur);
  let node: AudioNode = osc.connect(g);
  if (micSafe) {
    for (let i = 0; i < 2; i++) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 140;
      lp.Q.value = 0.7;
      node = node.connect(lp);
    }
  }
  node.connect(dest);
  osc.start(when);
  osc.stop(when + dur + 0.02);
}

/** Brushed "chuck" above 7.5 kHz: a rhythm the detectors (≤ 6 kHz) don't hear. */
export function chuck(ctx: BaseAudioContext, dest: AudioNode, when: number, gain: number) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  let node: AudioNode = src;
  for (let i = 0; i < 2; i++) {
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7500;
    hp.Q.value = 0.7;
    node = node.connect(hp);
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(gain, when + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.09);
  node.connect(g).connect(dest);
  src.start(when);
  src.stop(when + 0.1);
}

/** Count-in tick, above 8 kHz like the metronome. */
export function tick(ctx: BaseAudioContext, dest: AudioNode, when: number, accent: boolean, gain: number) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.frequency.value = accent ? 9400 : 8800;
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(gain * (accent ? 0.6 : 0.4), when + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.05);
  osc.connect(g).connect(dest);
  osc.start(when);
  osc.stop(when + 0.06);
}

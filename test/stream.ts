// Feeds a whole buffer through a streaming core the way AudioEngine does: every 10 ms,
// the most recent 16384 samples (the AnalyserNode's fftSize).
import { SR } from './synth';

export function stream<E>(buf: Float32Array, feed: (samples: Float32Array, now: number) => E | null, step = 0.01): E[] {
  const out: E[] = [];
  const win = 16384;
  const padded = new Float32Array(win + buf.length);
  padded.set(buf, win); // leading silence, like a mic that was already open
  for (let now = step; now * SR <= buf.length; now += step) {
    const end = win + Math.round(now * SR);
    const ev = feed(padded.subarray(end - win, end), now);
    if (ev) out.push(ev);
  }
  return out;
}

/** First-order high-pass: models a phone mic that barely hears low fundamentals. */
export function highpass(buf: Float32Array, hz: number): Float32Array {
  const rc = 1 / (2 * Math.PI * hz);
  const a = rc / (rc + 1 / SR);
  const out = new Float32Array(buf.length);
  for (let i = 1; i < buf.length; i++) out[i] = a * (out[i - 1] + buf[i] - buf[i - 1]);
  return out;
}

/** Deterministic noise. */
export function addNoise(buf: Float32Array, amount: number, seed = 5) {
  for (let i = 0; i < buf.length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    buf[i] += (seed / 2 ** 32 - 0.5) * amount;
  }
}

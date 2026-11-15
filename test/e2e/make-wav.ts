// Renders a synthesized banjo performance to a 16-bit WAV, for use as Chromium's fake mic.
// Usage: npx vite-node test/e2e/make-wav.ts <out.wav> <spec>
//   spec: comma list of "time:midi[+midi][>midi@time]" e.g. "2.0:62,3.0:57>58@3.4"
//   (">58@3.4" = slide/hammer/pull to 58 at 3.4 s, without a new pick)
import { writeFileSync } from 'node:fs';
import { N, render } from '../render';
import { SR } from '../synth';

const [out, spec] = process.argv.slice(2);
const notes: N[] = spec.split(',').map((x) => {
  const [t, rest] = x.split(':');
  const [m, bend] = rest.split('>');
  const n: N = { t: Number(t), midi: m.split('+').map(Number) };
  if (bend) {
    const [to, at] = bend.split('@');
    n.bend = { midi: Number(to), at: Number(at) };
  }
  return n;
});
const dur = Math.max(...notes.map((n) => n.t)) + 2;
const buf = render(notes, dur, { seed: 4 });
const data = Buffer.alloc(44 + buf.length * 2);
data.write('RIFF', 0); data.writeUInt32LE(36 + buf.length * 2, 4); data.write('WAVE', 8);
data.write('fmt ', 12); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
data.writeUInt32LE(SR, 24); data.writeUInt32LE(SR * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
data.write('data', 36); data.writeUInt32LE(buf.length * 2, 40);
for (let i = 0; i < buf.length; i++) data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(buf[i] * 2.5 * 32767))), 44 + i * 2);
writeFileSync(out, data);
console.log(`wrote ${out}: ${notes.length} notes, ${dur.toFixed(1)} s`);

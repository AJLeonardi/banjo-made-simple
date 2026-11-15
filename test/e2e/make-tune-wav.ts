// Renders a synthesized performance of a tune arrangement (what a player would play),
// to feed Chromium's fake mic. Usage:
//   npx vite-node test/e2e/make-tune-wav.ts <out.wav> <tuneId> <arrangement> <bpm> <leadIn s>
import { writeFileSync } from 'node:fs';
import { TUNE_BY_ID, tuneTab } from '../../src/content/songs';
import { pitchOf } from '../../src/music/tab';
import type { ArrangementKind } from '../../src/music/arranger';
import { N, render } from '../render';
import { SR } from '../synth';

const [out, id, arr, bpmS, leadS] = process.argv.slice(2);
const tab = tuneTab(TUNE_BY_ID[id], arr as ArrangementKind);
const spb = 60 / Number(bpmS);
const lead = Number(leadS);
const notes: N[] = tab.events.map((e) => ({ t: lead + e.beat * spb, midi: e.notes.map(pitchOf), strings: e.notes.map((n) => n.string) }));
const dur = lead + tab.bars * tab.beatsPerBar * spb + 2;
const buf = render(notes, dur, { seed: 6 });
const data = Buffer.alloc(44 + buf.length * 2);
data.write('RIFF', 0); data.writeUInt32LE(36 + buf.length * 2, 4); data.write('WAVE', 8);
data.write('fmt ', 12); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(1, 22);
data.writeUInt32LE(SR, 24); data.writeUInt32LE(SR * 2, 28); data.writeUInt16LE(2, 32); data.writeUInt16LE(16, 34);
data.write('data', 36); data.writeUInt32LE(buf.length * 2, 40);
for (let i = 0; i < buf.length; i++) data.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(buf[i] * 2.5 * 32767))), 44 + i * 2);
writeFileSync(out, data);
console.log(`wrote ${out}: ${notes.length} events, ${dur.toFixed(1)} s`);

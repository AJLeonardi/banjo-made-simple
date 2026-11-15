import { describe, expect, it } from 'vitest';
import { ARRANGEMENTS, melodySlots, parseBars, parseNote } from '../src/music/arranger';
import { OPEN } from '../src/music/banjo';
import { CHORD_BY_ID } from '../src/music/library';
import { pitchOf } from '../src/music/tab';
import { TUNES, tuneTab } from '../src/content/songs';

describe('notation', () => {
  it('parses notes and bars', () => {
    expect(parseNote('G3')).toBe(55);
    expect(parseNote('F#4')).toBe(66);
    expect(parseNote('Bb3')).toBe(58);
    expect(parseBars('G: B3 - D4 | D7:')).toEqual([
      { chord: 'G', melody: [59, null, 62] },
      { chord: 'D7', melody: [] },
    ]);
    expect(() => parseBars('H: B3')).toThrow();
  });
});

describe('arrangements of every tune', () => {
  it('has 25 tunes with unique ids', () => {
    expect(TUNES.length).toBe(25);
    expect(new Set(TUNES.map((t) => t.id)).size).toBe(25);
  });

  for (const t of TUNES)
    it(`${t.title}: all three arrangements are playable`, () => {
      const bars = t.parts.flatMap((p) => p.bars);
      for (const kind of ARRANGEMENTS) {
        const tab = tuneTab(t, kind);
        expect(tab.bars).toBe(bars.length);
        expect(tab.chords.every((c) => CHORD_BY_ID[c])).toBe(true);
        // sorted, inside the tab, sensible frets
        tab.events.forEach((e, i) => {
          if (i) expect(e.beat).toBeGreaterThanOrEqual(tab.events[i - 1].beat);
          expect(e.beat).toBeLessThan(tab.bars * tab.beatsPerBar);
          for (const n of e.notes) {
            if (n.string === 5) expect(n.fret).toBe(0);
            else expect(n.fret).toBeLessThanOrEqual(kind === 'backup' ? 12 : 7);
          }
        });
        if (kind === 'backup') {
          expect(tab.events.every((e) => e.kind === 'chord' && e.frets!.every((f) => f > 0))).toBe(true);
          continue;
        }
        // Every melody note sounds at its slot with the right pitch.
        let bar = 0;
        for (const b of bars) {
          const slots = melodySlots(t.meter, b.melody.length);
          b.melody.forEach((m, i) => {
            if (m === null) return;
            const beat = bar * t.meter + slots[i] / 2;
            const ev = tab.events.find((e) => e.beat === beat);
            expect(ev, `${kind} bar ${bar + 1} slot ${slots[i]}`).toBeTruthy();
            expect(ev!.notes.map(pitchOf)).toContain(m);
          });
          bar++;
        }
        if (kind === 'scruggs') {
          // Rolls: no finger and no string twice in a row.
          for (let i = 1; i < tab.events.length; i++) {
            const a = tab.events[i - 1].notes[0], b = tab.events[i].notes[0];
            expect(a.rh, `${t.id} event ${i}`).not.toBe(b.rh);
            expect(a.string, `${t.id} event ${i}`).not.toBe(b.string);
          }
          // Roll notes are 8ths: every slot but the final bar's is filled.
          expect(tab.events.length).toBeGreaterThanOrEqual((tab.bars - 1) * t.meter * 2);
          // Right hand: thumb on 2–5, index on 2–3, middle on 1–2.
          for (const e of tab.events)
            for (const n of e.notes) {
              if (n.rh === 'I') expect([1, 2, 3]).toContain(n.string);
              if (n.rh === 'M') expect([1, 2]).toContain(n.string);
            }
        }
      }
    });

  it('shows readable Scruggs bars', () => {
    for (const id of ['cripple-creek', 'boil-cabbage', 'amazing-grace', 'old-joe-clark']) {
      const t = TUNES.find((x) => x.id === id)!;
      const tab = tuneTab(t, 'scruggs');
      const bars = [0, 1, 2, 3].map((b) =>
        tab.events
          .filter((e) => e.beat >= b * t.meter && e.beat < (b + 1) * t.meter)
          .map((e) => e.notes.map((n) => `${n.rh}${n.string}:${n.fret}${n.melody ? '*' : ''}`).join('+'))
          .join(' '),
      );
      console.log(`${id} [${tab.chords.slice(0, 4)}]\n  ` + bars.join('\n  '));
    }
    const cc = tuneTab(TUNES.find((t) => t.id === 'cripple-creek')!, 'scruggs');
    expect(cc.events.filter((e) => e.beat < 4).length).toBe(8);
    expect(OPEN[5]).toBe(67);
  });
});

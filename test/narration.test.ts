import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { allNarration, narrationId, speechText } from '../src/content/narration';

describe('narration', () => {
  it('speaks tab shorthand, finger letters and string lists naturally', () => {
    expect(speechText('T I M T, strings 3 2 1 5')).toBe('Thumb, index, middle, thumb, strings 3, 2, 1, 5');
    expect(speechText('A slide (2s3 = 2nd fret to 3rd)')).toBe('A slide (2, slide to 3 means 2nd fret to 3rd)');
    expect(speechText('Hammer 0–2, pull 2–0')).toBe('Hammer open to 2, pull 2 to open');
    expect(speechText('the 4th string at the 5th fret = open 3rd')).toBe('The 4th string at the 5th fret sounds the same as open 3rd');
    expect(speechText('open G: g D G B D')).toBe('Open G: G, D, G, B, D');
  });

  it('ids are stable and distinct', () => {
    expect(narrationId('hello')).toBe(narrationId('hello'));
    expect(narrationId('hello')).not.toBe(narrationId('hello.'));
  });

  it('every lesson step has its generated clip (run `npm run voice` after editing lesson text)', () => {
    const dir = new URL('../public/voice/', import.meta.url);
    const manifest = JSON.parse(readFileSync(new URL('manifest.json', dir), 'utf8')) as Record<string, number>;
    const missing = [...allNarration()].filter(([id]) => !manifest[id] || !existsSync(new URL(`${id}.mp3`, dir))).map(([, t]) => t.slice(0, 60));
    expect(missing).toEqual([]);
  });
});

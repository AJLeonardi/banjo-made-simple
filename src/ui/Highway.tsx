// The scrolling tab: five lines (1st string on top), notes travel right-to-left into the
// gold "now" line. Each note shows its fret; its ring is the picking finger's colour;
// its fill turns green/red/amber as it's judged.

import { useEffect, useRef } from 'react';
import type { Target } from '../game/performance';
import { Tab } from '../music/tab';

interface Props {
  tab: Tab;
  /** Judgement per event (same order as tab.events), if playing. */
  targets?: Target[];
  /** Current position in beats (called every frame). */
  position: () => number;
  /** Wait mode: the note being waited for. */
  currentIndex?: number | null;
  pxPerBeat?: number;
}

type Colors = Record<string, string>;
const VARS = ['surface', 'surface-2', 'ink', 'ink-soft', 'line', 'brass', 'good', 'bad', 'warn', 'locked', 'rh-t', 'rh-i', 'rh-m', 'wood', 'accent'];

function readColors(): Colors {
  const cs = getComputedStyle(document.documentElement);
  return Object.fromEntries(VARS.map((v) => [v, cs.getPropertyValue(`--${v}`).trim() || '#888']));
}

export function Highway({ tab, targets, position, currentIndex = null, pxPerBeat = 80 }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const props = useRef({ tab, targets, position, currentIndex, pxPerBeat });
  props.current = { tab, targets, position, currentIndex, pxPerBeat };

  useEffect(() => {
    const c = canvas.current!;
    const g = c.getContext('2d')!;
    let colors = readColors();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onTheme = () => (colors = readColors());
    mq.addEventListener('change', onTheme);
    let raf = 0;

    const draw = () => {
      raf = requestAnimationFrame(draw);
      const dpr = window.devicePixelRatio || 1;
      const w = c.clientWidth;
      const h = c.clientHeight;
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      const { tab, targets, position, currentIndex, pxPerBeat } = props.current;
      const pos = position();
      const ppb = Math.max(48, Math.min(pxPerBeat, w / 6));
      const x0 = Math.round(w * 0.22);
      const top = 46;
      const gap = (h - top - 30) / 4;
      const ys = (s: number) => top + (s - 1) * gap;
      const xb = (beat: number) => x0 + (beat - pos) * ppb;
      const r = Math.min(13, gap * 0.45);

      g.fillStyle = colors.surface;
      g.fillRect(0, 0, w, h);

      // bars, chord names, part labels
      const bpb = tab.beatsPerBar;
      for (let bar = 0; bar <= tab.bars; bar++) {
        const x = xb(bar * bpb);
        if (x < -120 || x > w + 10) continue;
        g.strokeStyle = colors.line;
        g.lineWidth = bar === tab.bars ? 4 : 1.5;
        g.beginPath();
        g.moveTo(x, top - 4);
        g.lineTo(x, ys(5) + 4);
        g.stroke();
        if (bar < tab.bars) {
          g.fillStyle = colors['ink-soft'];
          g.font = '800 15px Nunito, system-ui, sans-serif';
          g.textAlign = 'left';
          g.fillText(tab.chords[bar], x + 6, 20);
          const part = tab.parts.find((p) => p.startBar === bar);
          if (part && tab.parts.length > 1) {
            g.fillStyle = colors.wood;
            g.beginPath();
            g.arc(x + 6 + g.measureText(tab.chords[bar]).width + 16, 15, 10, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = colors.surface;
            g.textAlign = 'center';
            g.font = '900 12px Nunito, system-ui, sans-serif';
            g.fillText(part.name, x + 6 + g.measureText(tab.chords[bar]).width + 22, 19);
          }
        }
      }

      // strings
      for (let s = 1; s <= 5; s++) {
        g.strokeStyle = colors.line;
        g.lineWidth = s === 4 ? 2.4 : s === 3 ? 2 : 1.4;
        g.beginPath();
        g.moveTo(0, ys(s));
        g.lineTo(w, ys(s));
        g.stroke();
      }

      // events
      const fill = (i: number) => {
        const o = targets?.[i]?.outcome;
        if (o === 'hit') return [colors.good, '#fff'];
        if (o === 'wrong') return [colors.bad, '#fff'];
        if (o === 'partial') return [colors.warn, '#fff'];
        if (o === 'miss') return [colors.locked, colors.surface];
        return [colors['surface-2'], colors.ink];
      };
      tab.events.forEach((e, i) => {
        const x = xb(e.beat);
        if (x < -40 || x > w + 40) return;
        const [bg, fg] = fill(i);
        const isCurrent = currentIndex === i;
        if (e.kind === 'chord') {
          const y1 = ys(1) - r;
          const y2 = ys(4) + r;
          if (isCurrent) glow(g, x - 16, y1 - 4, 32, y2 - y1 + 8, colors.brass);
          g.fillStyle = bg;
          g.strokeStyle = colors.wood;
          g.lineWidth = 2;
          roundRect(g, x - 12, y1, 24, y2 - y1, 8);
          g.fill();
          g.stroke();
          g.fillStyle = fg;
          g.font = '800 12px Nunito, system-ui, sans-serif';
          g.textAlign = 'center';
          e.notes.forEach((n) => g.fillText(String(n.fret), x, ys(n.string) + 4));
          g.fillStyle = colors.ink;
          g.font = '900 13px Nunito, system-ui, sans-serif';
          g.fillText(e.style === 'chop' ? `${e.chord}✕` : e.chord ?? '', x, ys(5) + 4);
          return;
        }
        for (const n of e.notes) {
          const y = ys(n.string);
          const rr = n.melody ? r + 1.5 : r;
          if (isCurrent) glowCircle(g, x, y, rr + 6, colors.brass);
          g.beginPath();
          g.arc(x, y, rr, 0, Math.PI * 2);
          g.fillStyle = n.tech ? colors.surface : bg;
          g.fill();
          g.lineWidth = n.melody ? 3.5 : 2.5;
          g.strokeStyle = n.rh ? colors[`rh-${n.rh.toLowerCase()}`] : colors.wood;
          g.stroke();
          g.fillStyle = n.tech ? colors.ink : fg;
          g.font = `900 ${Math.round(rr * 1.05)}px Nunito, system-ui, sans-serif`;
          g.textAlign = 'center';
          g.fillText(String(n.fret), x, y + rr * 0.38);
          if (n.tech) {
            g.fillStyle = colors.accent;
            g.font = '900 12px Nunito, system-ui, sans-serif';
            g.fillText(n.tech, x - ppb * 0.25, y - rr - 3);
          }
        }
        // picking finger letters under the lowest note
        const low = Math.max(...e.notes.map((n) => n.string));
        const letters = e.notes.filter((n) => n.rh && !n.tech).map((n) => n.rh!);
        if (letters.length) {
          g.font = '900 12px Nunito, system-ui, sans-serif';
          g.textAlign = 'center';
          letters.forEach((l, k) => {
            g.fillStyle = colors[`rh-${l.toLowerCase()}`];
            g.fillText(l, x + (k - (letters.length - 1) / 2) * 12, Math.min(h - 6, ys(low) + r + 14));
          });
        }
      });

      // now line
      g.fillStyle = colors.brass;
      g.fillRect(x0 - 2, top - 14, 4, ys(5) - top + 28);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      mq.removeEventListener('change', onTheme);
    };
  }, []);

  return <canvas ref={canvas} aria-label="Scrolling tab" role="img" />;
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function glow(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  g.save();
  g.globalAlpha = 0.35;
  g.fillStyle = color;
  roundRect(g, x, y, w, h, 10);
  g.fill();
  g.restore();
}

function glowCircle(g: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  g.save();
  g.globalAlpha = 0.35;
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

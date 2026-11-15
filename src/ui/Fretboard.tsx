// The neck, seen from the front with the nut on the left and the 1st string on top (same
// order as the tab). Shows where to put your fingers: fretting-hand finger numbers in the
// dots, open strings as rings at the nut, and the picking finger (T/I/M) at the right.
// "Ghost" marks show what the mic heard you play.

import { RightHand, StringNum } from '../music/banjo';
import { LeftFinger } from '../music/tab';

export interface Mark {
  string: StringNum;
  fret: number;
  lh?: LeftFinger;
  rh?: RightHand;
}

export interface Ghost {
  string: StringNum;
  fret: number;
  label: string;
  ok?: boolean;
}

const W = 600;
const NUT_X = 52;
const END_X = 560;
const TOP = 36;
const GAP = 26;
const H = TOP + GAP * 4 + 40;
const INLAYS = [3, 5, 7, 10, 12];
export const RH_COLOR: Record<RightHand, string> = { T: 'var(--rh-t)', I: 'var(--rh-i)', M: 'var(--rh-m)' };

const yOf = (s: StringNum) => TOP + (s - 1) * GAP;

export function Fretboard({ targets, ghosts = [], caption, minFrets = 7 }: { targets: Mark[]; ghosts?: Ghost[]; caption?: string; minFrets?: number }) {
  const used = [...targets, ...ghosts].map((m) => m.fret);
  const frets = Math.min(12, Math.max(minFrets, ...used.map((f) => f + 1)));
  const fw = (END_X - NUT_X) / frets;
  const xLine = (f: number) => NUT_X + f * fw;
  // The open 5th string sounds from its own peg at the 5th fret: mark it just past the peg.
  const xNote = (s: StringNum, f: number) => (f === 0 ? (s === 5 ? xLine(5) + 16 : NUT_X - 20) : xLine(f) - fw / 2);
  const rhByString = new Map<StringNum, RightHand>();
  targets.forEach((t) => t.rh && rhByString.set(t.string, t.rh));

  return (
    <div className="fretboard">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={describe(targets)}>
        {/* neck */}
        <rect x={NUT_X} y={TOP - 14} width={END_X - NUT_X} height={GAP * 4 + 28} rx="4" style={{ fill: 'var(--rosewood)' }} />
        {INLAYS.filter((f) => f <= frets).map((f) =>
          f === 12 ? (
            [0.3, 0.7].map((k) => <circle key={`${f}${k}`} cx={xLine(f) - fw / 2} cy={TOP + GAP * 4 * k} r="5" style={{ fill: 'var(--inlay)' }} opacity="0.55" />)
          ) : (
            <circle key={f} cx={xLine(f) - fw / 2} cy={TOP + GAP * 2} r="5" style={{ fill: 'var(--inlay)' }} opacity="0.55" />
          ),
        )}
        {/* nut and frets */}
        <rect x={NUT_X - 5} y={TOP - 14} width="7" height={GAP * 4 + 28} rx="2" style={{ fill: 'var(--inlay)' }} />
        {Array.from({ length: frets }, (_, i) => (
          <line key={i} x1={xLine(i + 1)} x2={xLine(i + 1)} y1={TOP - 14} y2={TOP + GAP * 4 + 14} strokeWidth="3" style={{ stroke: 'var(--fret)' }} />
        ))}
        {/* strings (the 5th starts at the 5th fret) */}
        {([1, 2, 3, 4, 5] as StringNum[]).map((s) => (
          <g key={s}>
            <line x1={s === 5 ? xLine(5) : NUT_X} x2={END_X} y1={yOf(s)} y2={yOf(s)} strokeWidth={0.8 + (s === 4 ? 1.4 : s === 3 ? 1 : 0.5)} style={{ stroke: 'var(--string)' }} />
            <text x="2" y={yOf(s) + 5} fontSize="14" fontWeight="800" style={{ fill: 'var(--ink-soft)' }}>
              {s}
            </text>
          </g>
        ))}
        {frets >= 5 && <circle cx={xLine(5)} cy={yOf(5)} r="4" style={{ fill: 'var(--inlay)' }} />}
        {/* fret numbers */}
        {INLAYS.filter((f) => f <= frets).map((f) => (
          <text key={f} x={xLine(f) - fw / 2} y={H - 6} fontSize="13" textAnchor="middle" fontWeight="700" style={{ fill: 'var(--ink-soft)' }}>
            {f}
          </text>
        ))}

        {/* what the mic heard */}
        {ghosts.map((g, i) => (
          <g key={`g${i}`}>
            <circle cx={xNote(g.string, g.fret)} cy={yOf(g.string)} r="14" fill="none" strokeWidth="3" strokeDasharray={g.ok ? undefined : '5 4'} style={{ stroke: g.ok ? 'var(--good)' : 'var(--bad)' }} />
            <text x={xNote(g.string, g.fret)} y={yOf(g.string) - 18} fontSize="13" fontWeight="800" textAnchor="middle" style={{ fill: g.ok ? 'var(--good)' : 'var(--bad)' }}>
              {g.label}
            </text>
          </g>
        ))}

        {/* where to put your fingers */}
        {targets.map((t, i) =>
          t.fret === 0 ? (
            <circle key={i} cx={xNote(t.string, 0)} cy={yOf(t.string)} r="10" fill="none" strokeWidth="4" style={{ stroke: 'var(--brass)' }} />
          ) : (
            <g key={i}>
              <circle cx={xNote(t.string, t.fret)} cy={yOf(t.string)} r="12" strokeWidth="2" style={{ fill: 'var(--brass)', stroke: 'var(--surface)' }} />
              {t.lh && (
                <text x={xNote(t.string, t.fret)} y={yOf(t.string) + 5} fontSize="15" fontWeight="900" textAnchor="middle" style={{ fill: '#2b1a0e' }}>
                  {t.lh}
                </text>
              )}
            </g>
          ),
        )}
        {/* picking finger per string */}
        {[...rhByString].map(([s, rh]) => (
          <g key={`rh${s}`}>
            <circle cx={END_X + 20} cy={yOf(s)} r="11" style={{ fill: RH_COLOR[rh] }} />
            <text x={END_X + 20} y={yOf(s) + 5} fontSize="13" fontWeight="900" textAnchor="middle" fill="#fff">
              {rh}
            </text>
          </g>
        ))}
      </svg>
      {caption && <div className="fretboard-caption">{caption}</div>}
    </div>
  );
}

const FINGER = ['', 'index', 'middle', 'ring', 'pinky'];
const RH_WORD: Record<RightHand, string> = { T: 'thumb', I: 'index', M: 'middle' };

function describe(targets: Mark[]): string {
  if (!targets.length) return 'Banjo fretboard';
  return targets
    .map((t) => `${ordinal(t.string)} string ${t.fret === 0 ? 'open' : `fret ${t.fret}${t.lh ? ` with your ${FINGER[t.lh]} finger` : ''}`}${t.rh ? `, picked with your ${RH_WORD[t.rh]}` : ''}`)
    .join('; ');
}

export const ordinal = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;

/** One-line instruction for a set of targets (the wait-mode hint). */
export function instruction(targets: Mark[]): string {
  return describe(targets).replace(/^./, (c) => c.toUpperCase()) + '.';
}

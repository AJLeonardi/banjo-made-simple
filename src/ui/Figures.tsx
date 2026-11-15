// Illustrations for lesson info steps.
import type { Figure as FigureSpec } from '../content/lessons';
import { Fretboard } from './Fretboard';

export function Figure({ spec }: { spec: FigureSpec }) {
  if (spec.type === 'fretboard') return <Fretboard targets={spec.notes} caption={spec.caption} />;
  if (spec.type === 'banjo-parts') return <BanjoParts />;
  if (spec.type === 'tab-explainer') return <TabExplainer />;
  return <PickingHand />;
}

const label = { fontSize: 15, fontWeight: 800 } as const;
const ink = { fill: 'var(--ink)' };
const leader = { stroke: 'var(--ink-soft)', strokeWidth: 1.5 };

function BanjoParts() {
  return (
    <div className="figure">
      <svg viewBox="0 0 520 260" role="img" aria-label="Banjo parts: head and rim (the drum), bridge, tailpiece, neck with frets, the short 5th string and its peg, and the tuning pegs on the headstock.">
        {/* neck */}
        <rect x="180" y="112" width="290" height="36" rx="6" style={{ fill: 'var(--rosewood)' }} />
        <path d="M470 106h40l-6 48h-34z" style={{ fill: 'var(--wood-dark)' }} />
        {[205, 232, 257, 280, 302, 322, 341, 359, 376, 392].map((x) => (
          <line key={x} x1={x} x2={x} y1="112" y2="148" strokeWidth="2.5" style={{ stroke: 'var(--fret)' }} />
        ))}
        {[118, 125, 132, 139].map((y) => (
          <line key={y} x1="40" x2="500" y1={y + 3} y2={y + 3} strokeWidth="1" style={{ stroke: 'var(--string)' }} />
        ))}
        <line x1="40" x2="322" y1="143" y2="143" strokeWidth="1" style={{ stroke: 'var(--string)' }} />
        <circle cx="322" cy="152" r="6" style={{ fill: 'var(--brass)' }} />
        {/* pot */}
        <circle cx="120" cy="130" r="108" style={{ fill: 'var(--brass)' }} />
        <circle cx="120" cy="130" r="96" style={{ fill: 'var(--surface)' }} />
        <rect x="88" y="124" width="34" height="8" rx="2" style={{ fill: 'var(--wood-dark)' }} />
        <path d="M10 112h34v36H10z" style={{ fill: 'var(--wood)' }} />
        {[488, 498].map((x, i) => (
          <circle key={x} cx={x} cy={i ? 160 : 100} r="7" style={{ fill: 'var(--fret)' }} />
        ))}
        {/* labels */}
        <g style={ink}>
          <text x="66" y="70" {...label}>Head</text>
          <line x1="96" y1="76" x2="110" y2="100" style={leader} />
          <text x="118" y="250" {...label} textAnchor="middle">Rim (the drum)</text>
          <text x="66" y="190" {...label}>Bridge</text>
          <line x1="100" y1="176" x2="104" y2="134" style={leader} />
          <text x="0" y="20" {...label}>Tailpiece</text>
          <line x1="30" y1="26" x2="26" y2="110" style={leader} />
          <text x="262" y="100" {...label}>Neck &amp; frets</text>
          <text x="270" y="190" {...label}>5th-string peg</text>
          <line x1="316" y1="176" x2="321" y2="160" style={leader} />
          <text x="420" y="92" {...label}>Tuning pegs</text>
        </g>
      </svg>
    </div>
  );
}

function TabExplainer() {
  const ys = [40, 64, 88, 112, 136];
  const notes = [
    { x: 150, s: 3, f: '0', rh: 'T' },
    { x: 220, s: 2, f: '1', rh: 'I' },
    { x: 290, s: 1, f: '2', rh: 'M' },
    { x: 360, s: 5, f: '0', rh: 'T' },
  ];
  const color: Record<string, string> = { T: 'var(--rh-t)', I: 'var(--rh-i)', M: 'var(--rh-m)' };
  return (
    <div className="figure">
      <svg viewBox="0 0 520 190" role="img" aria-label="Tab: five lines are the five strings, 1st string on top. Numbers are frets, 0 is open. Letters under notes are picking fingers: T thumb, I index, M middle.">
        <rect x="0" y="0" width="520" height="190" rx="14" style={{ fill: 'var(--surface)' }} />
        {ys.map((y, i) => (
          <g key={y}>
            <line x1="70" x2="500" y1={y} y2={y} strokeWidth={i === 3 ? 2.4 : 1.5} style={{ stroke: 'var(--line)' }} />
            <text x="16" y={y + 5} fontSize="13" fontWeight="800" style={{ fill: 'var(--ink-soft)' }}>{`${i + 1}${['st', 'nd', 'rd', 'th', 'th'][i]}`}</text>
          </g>
        ))}
        <rect x="104" y="22" width="4" height="130" style={{ fill: 'var(--brass)' }} />
        {notes.map((n) => (
          <g key={n.x}>
            <circle cx={n.x} cy={ys[n.s - 1]} r="13" strokeWidth="2.5" style={{ fill: 'var(--surface-2)', stroke: color[n.rh] }} />
            <text x={n.x} y={ys[n.s - 1] + 5} fontSize="14" fontWeight="900" textAnchor="middle" style={ink}>{n.f}</text>
            <text x={n.x} y="165" fontSize="13" fontWeight="900" textAnchor="middle" style={{ fill: color[n.rh] }}>{n.rh}</text>
          </g>
        ))}
        <text x="110" y="182" fontSize="12" fontWeight="700" style={{ fill: 'var(--ink-soft)' }}>← play when a note reaches the gold line</text>
      </svg>
    </div>
  );
}

function PickingHand() {
  const ys = [34, 58, 82, 106, 130];
  const fingers = [
    { rh: 'M', name: 'Middle', s: [1], color: 'var(--rh-m)' },
    { rh: 'I', name: 'Index', s: [2], color: 'var(--rh-i)' },
    { rh: 'T', name: 'Thumb', s: [3, 4, 5], color: 'var(--rh-t)' },
  ];
  return (
    <div className="figure">
      <svg viewBox="0 0 520 170" role="img" aria-label="Picking hand: middle finger plays the 1st string, index the 2nd, thumb the 3rd, 4th and 5th.">
        <rect x="0" y="0" width="520" height="170" rx="14" style={{ fill: 'var(--surface)' }} />
        {ys.map((y, i) => (
          <g key={y}>
            <line x1="60" x2="300" y1={y} y2={y} strokeWidth={i === 3 ? 2.4 : 1.6} style={{ stroke: 'var(--line)' }} />
            <text x="20" y={y + 5} fontSize="13" fontWeight="800" style={{ fill: 'var(--ink-soft)' }}>{i + 1}</text>
          </g>
        ))}
        {fingers.map((f, k) => (
          <g key={f.rh}>
            {f.s.map((s) => (
              <circle key={s} cx={180 + k * 10} cy={ys[s - 1]} r="9" style={{ fill: f.color }} />
            ))}
            <rect x="330" y={22 + k * 44} width="170" height="34" rx="17" style={{ fill: f.color }} />
            <text x="345" y={44 + k * 44} fontSize="15" fontWeight="900" fill="#fff">{`${f.rh} · ${f.name}`}</text>
            <text x="440" y={44 + k * 44} fontSize="13" fontWeight="700" fill="#fff">{f.s.length > 1 ? 'strings 3–5' : `string ${f.s[0]}`}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

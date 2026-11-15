// Small shared pieces: stars, progress ring, award medal.
import { Award } from '../content/awards';
import { AwardGlyph, StarIcon } from './Icons';

export function Stars({ n, of = 3, big = false, label }: { n: number; of?: number; big?: boolean; label?: string }) {
  return (
    <span className={`stars${big ? ' big' : ''}`} role="img" aria-label={label ?? `${n} of ${of} stars`}>
      {Array.from({ length: of }, (_, i) => (
        <StarIcon key={i} className={i < n ? 'on' : ''} filled={i < n} />
      ))}
    </span>
  );
}

export function Ring({ value, label, size = 56 }: { value: number; label: React.ReactNode; size?: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 52 52" aria-hidden>
        <circle cx="26" cy="26" r={r} fill="none" strokeWidth="6" style={{ stroke: 'var(--surface-2)' }} />
        <circle cx="26" cy="26" r={r} fill="none" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${c * v} ${c}`} style={{ stroke: v >= 1 ? 'var(--good)' : 'var(--accent)' }} />
      </svg>
      <div className="label">{label}</div>
    </div>
  );
}

export function Medal({ award, locked = false }: { award: Award; locked?: boolean }) {
  return (
    <div className={`medal ${award.tier}`} aria-hidden data-locked={locked || undefined}>
      <AwardGlyph icon={award.icon} />
    </div>
  );
}

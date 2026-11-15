// Inline SVG icons (emoji render inconsistently across phones).
import type { AwardIcon } from '../content/awards';

const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;
type P = { className?: string };

export const PathIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden>
    <circle cx="6" cy="19" r="2" />
    <circle cx="18" cy="5" r="2" />
    <path d="M8 19h7a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h7" />
  </svg>
);
export const NoteIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden>
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);
export const MedalIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden>
    <circle cx="12" cy="15" r="6" />
    <path d="M8.5 10 6 3h4l2 4 2-4h4l-2.5 7" />
    <path d="m12 12.5.9 1.8 2 .3-1.45 1.4.35 2-1.8-.95-1.8.95.35-2-1.45-1.4 2-.3z" fill="currentColor" stroke="none" />
  </svg>
);
export const UserIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);
export const StarIcon = ({ className, filled = true }: P & { filled?: boolean }) => (
  <svg {...base} className={className} aria-hidden>
    <path d="M12 2.8l2.8 5.7 6.3.9-4.55 4.45 1.07 6.25L12 17.15 6.38 20.1l1.07-6.25L2.9 9.4l6.3-.9z" fill={filled ? 'currentColor' : 'none'} />
  </svg>
);
export const FlameIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden>
    <path d="M12 22c4 0 7-2.7 7-6.8 0-3.6-2.4-6.1-4-8.2-.4 2-1.5 3.3-2.6 3.8C12.6 7.6 11.2 4.6 8.6 2.5 8.7 6.6 5 9.1 5 14.6 5 19 8 22 12 22z" fill="currentColor" stroke="none" />
  </svg>
);
export const LockIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden>
    <rect x="5" y="11" width="14" height="10" rx="2" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);
export const PlayIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden>
    <path d="M7 4.5v15l12-7.5z" fill="currentColor" />
  </svg>
);
export const StopIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden>
    <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
  </svg>
);
export const EarIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden>
    <path d="M6 8.5a6 6 0 1 1 12 0c0 3.5-3 4.5-3 7.5a3.5 3.5 0 0 1-6.5 1.8" />
    <path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-1.5 2-1.5 3.5" />
  </svg>
);
export const HeadphonesIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden>
    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
    <path d="M21 19a2 2 0 0 1-2 2h-1v-6h3zM3 19a2 2 0 0 0 2 2h1v-6H3z" />
  </svg>
);
export const SpeakerIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden>
    <path d="M11 5 6 9H2v6h4l5 4z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14" />
  </svg>
);
export const SpeakerOffIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden>
    <path d="M11 5 6 9H2v6h4l5 4z" />
    <path d="M22 9l-6 6M16 9l6 6" />
  </svg>
);
export const CloseIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
export const CheckIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);
export const BackIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden>
    <path d="M15 18l-6-6 6-6" />
  </svg>
);
export const MicIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden>
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" />
  </svg>
);
export const TunerIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden>
    <path d="M4 16a8 8 0 1 1 16 0" />
    <path d="M12 16l4-6" />
    <circle cx="12" cy="16" r="1.5" fill="currentColor" />
  </svg>
);
export const RepeatIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden>
    <path d="M17 2l3 3-3 3" />
    <path d="M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3" />
    <path d="M20 13v2a4 4 0 0 1-4 4H4" />
  </svg>
);
export const SunIcon = (p: P) => (
  <svg {...base} {...p} aria-hidden>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);

/** The app mark: a banjo pot and neck. */
export const BanjoMark = (p: P) => (
  <svg viewBox="0 0 64 64" {...p} aria-hidden>
    <rect x="29" y="2" width="6" height="34" rx="2" fill="#5b3820" />
    <rect x="27.5" y="2" width="9" height="8" rx="2" fill="#3b2416" />
    <circle cx="32" cy="44" r="18" fill="#c4952a" />
    <circle cx="32" cy="44" r="14.5" fill="#fbf4e6" />
    <rect x="29" y="44" width="6" height="2.5" rx="1" fill="#5b3820" />
    <path d="M30.5 10v34M33.5 10v34" stroke="#9b8e7a" strokeWidth="0.7" />
    <path d="M35 21l6 -3" stroke="#5b3820" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

/** Google "G" for the sign-in button. */
export const GoogleG = (p: P) => (
  <svg viewBox="0 0 48 48" {...p} aria-hidden>
    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
  </svg>
);

const AWARD_PATHS: Record<AwardIcon, JSX.Element> = {
  pick: <path d="M12 21c-3-3-7-8-7-12a7 7 0 0 1 14 0c0 4-4 9-7 12z" />,
  tuner: <><path d="M4 16a8 8 0 1 1 16 0" /><path d="M12 16l4-6" /></>,
  roll: <><path d="M3 12a9 9 0 1 0 3-6.7" /><path d="M3 4v4h4" /></>,
  pinch: <><path d="M7 4v8a5 5 0 0 0 10 0V4" /><path d="M7 4h0M17 4h0" /></>,
  star: <path d="M12 2.8l2.8 5.7 6.3.9-4.55 4.45 1.07 6.25L12 17.15 6.38 20.1l1.07-6.25L2.9 9.4l6.3-.9z" />,
  flame: <path d="M12 22c4 0 7-2.7 7-6.8 0-3.6-2.4-6.1-4-8.2-.4 2-1.5 3.3-2.6 3.8C12.6 7.6 11.2 4.6 8.6 2.5 8.7 6.6 5 9.1 5 14.6 5 19 8 22 12 22z" />,
  note: <><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></>,
  trade: <><path d="M4 8h13l-3-3M20 16H7l3 3" /></>,
  chop: <><path d="M4 20 14 10M14 10l4-6 2 2-6 4" /><path d="M6 14l4 4" /></>,
  course: <><path d="M3 7l9-4 9 4-9 4z" /><path d="M7 9v5c0 1.7 2.2 3 5 3s5-1.3 5-3V9" /></>,
  book: <><path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z" /><path d="M20 4h-6a3 3 0 0 0-3 3" /><path d="M20 4v14h-7" /></>,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></>,
};

export const AwardGlyph = ({ icon }: { icon: AwardIcon }) => (
  <svg {...base} aria-hidden>
    {AWARD_PATHS[icon]}
  </svg>
);

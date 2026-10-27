const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export const PlayIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M8 4.5v15l12-7.5z" />
  </svg>
);

export const StopIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <rect x="6" y="6" width="12" height="12" rx="1" />
  </svg>
);

export const BackIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" strokeWidth="2" {...stroke} aria-hidden="true">
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

export const ChevronIcon = ({ up = false }: { up?: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" strokeWidth="2.2" {...stroke} aria-hidden="true">
    <path d={up ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
  </svg>
);

export const ArrowOutIcon = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth="2.4" {...stroke} aria-hidden="true">
    <path d="M7 17L17 7M9 7h8v8" />
  </svg>
);

export const SwapIcon = () => (
  <svg width="28" height="12" viewBox="0 0 28 12" strokeWidth="2" {...stroke} aria-hidden="true">
    <path d="M2 6h24M6 2L2 6l4 4M22 2l4 4-4 4" />
  </svg>
);

export const HiHatIcon = () => (
  <svg width="56" height="44" viewBox="0 0 56 44" strokeWidth="2" {...stroke} aria-hidden="true">
    <ellipse cx="28" cy="11" rx="24" ry="4.5" />
    <ellipse cx="28" cy="16" rx="24" ry="4.5" />
    <path d="M28 3v36M28 30l-12 11M28 30l12 11" />
  </svg>
);

export const RideIcon = () => (
  <svg width="72" height="44" viewBox="0 0 72 44" strokeWidth="2" {...stroke} aria-hidden="true">
    <ellipse cx="36" cy="14" rx="33" ry="11" />
    <ellipse cx="36" cy="11" rx="10" ry="4" />
    <path d="M36 25v16" strokeWidth="4" />
  </svg>
);

export const CrashIcon = () => (
  <svg width="52" height="40" viewBox="0 0 52 40" strokeWidth="2" {...stroke} aria-hidden="true">
    <ellipse cx="26" cy="12" rx="23" ry="6" transform="rotate(-10 26 12)" />
    <path d="M26 12v26M18 38h16" />
  </svg>
);

export const DrumIcon = () => (
  <svg width="56" height="44" viewBox="0 0 56 44" strokeWidth="2" {...stroke} aria-hidden="true">
    <ellipse cx="28" cy="12" rx="22" ry="6" />
    <path d="M6 12v18c0 3.3 9.8 6 22 6s22-2.7 22-6V12" />
    <path d="M14 3l10 9M42 3l-10 9" />
  </svg>
);

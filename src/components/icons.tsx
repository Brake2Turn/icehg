// Solid control icons (inherit currentColor).
type P = { className?: string };
const base = (className = 'w-5 h-5') => ({ className, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true as const });

export const PlayIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z" />
  </svg>
);
export const PauseIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <rect x="5.5" y="4" width="4.5" height="16" rx="1.2" />
    <rect x="14" y="4" width="4.5" height="16" rx="1.2" />
  </svg>
);
/** Next event: play triangle against a bar. */
export const NextIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M4 5v14a1 1 0 0 0 1.55.83l10-7a1 1 0 0 0 0-1.66l-10-7A1 1 0 0 0 4 5z" />
    <rect x="16.5" y="4" width="3.5" height="16" rx="1" />
  </svg>
);
/** Skip to midnight: double triangle. */
export const SkipIcon = ({ className }: P) => (
  <svg {...base(className)}>
    <path d="M2 5.2v13.6a1 1 0 0 0 1.57.82L12 13.7v5.1a1 1 0 0 0 1.57.82l9-6.8a1 1 0 0 0 0-1.64l-9-6.8A1 1 0 0 0 12 5.2v5.1L3.57 4.38A1 1 0 0 0 2 5.2z" />
  </svg>
);

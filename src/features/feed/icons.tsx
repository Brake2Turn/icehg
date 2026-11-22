/** A small cannon: a fat barrel on a wheel. */
export function CannonIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-label="Cannon" role="img" fill="currentColor">
      <g transform="rotate(-28 12 12)">
        <rect x="2.5" y="8.6" width="16.5" height="6.8" rx="3.2" />
        <rect x="17.6" y="7.6" width="3.6" height="8.8" rx="1.2" />
      </g>
      <circle cx="8.6" cy="17.2" r="4.6" />
      <circle cx="8.6" cy="17.2" r="1.6" fill="#0b0d12" />
    </svg>
  );
}

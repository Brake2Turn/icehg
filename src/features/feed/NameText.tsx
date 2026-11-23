import { segments, type NameColour } from '../../../engine';

export const CHIP_CLASS: Record<NameColour, string> = {
  red: 'text-chip-red',
  purple: 'text-chip-purple',
  gold: 'text-chip-gold',
  orange: 'text-chip-orange',
  green: 'text-chip-green',
  white: 'text-chip-white',
};

/** Event text with names as coloured, bold, tappable chips (§8.1). */
export function NameText({
  text,
  colours,
  nameOf,
  onName,
}: {
  text: string;
  colours?: Record<string, NameColour>;
  nameOf: (id: string) => string;
  onName?: (id: string) => void;
}) {
  return (
    <>
      {segments(text).map((s, i) =>
        s.kind === 'text' ? (
          <span key={i}>{s.text}</span>
        ) : (
          <button
            key={i}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onName?.(s.id);
            }}
            className={`font-bold ${colours ? CHIP_CLASS[colours[s.id] ?? 'white'] : 'text-chip-white'} hover:underline underline-offset-2`}
          >
            {nameOf(s.id)}
          </button>
        ),
      )}
    </>
  );
}

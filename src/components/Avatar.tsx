/** Circular photo, or initials generated from the name (§5.2). */
export function Avatar({
  name,
  photo,
  size = 44,
  dead = false,
  ring,
}: {
  name: string;
  photo?: string;
  size?: number;
  dead?: boolean;
  /** Optional ring colour (relationships mode). */
  ring?: string;
}) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join('') || '?';
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  const border = ring ? `3px solid ${ring}` : '2px solid rgba(255,255,255,.15)';
  const common = { width: size, height: size, border, filter: dead ? 'grayscale(1)' : undefined } as const;
  if (photo) return <img src={photo} alt="" draggable={false} className="rounded-full object-cover shrink-0 select-none" style={common} />;
  return (
    <div
      className="rounded-full flex items-center justify-center font-display shrink-0 select-none"
      style={{
        ...common,
        fontSize: size * 0.4,
        background: dead ? '#2a2d36' : `linear-gradient(135deg, hsl(${h} 45% 38%), hsl(${(h + 40) % 360} 45% 24%))`,
      }}
    >
      {initials}
    </div>
  );
}

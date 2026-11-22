import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';

/** Standard page frame: sticky frosted header with a back button. */
export function Screen({ title, back = '/', right, children }: { title: string; back?: string | null; right?: ReactNode; children: ReactNode }) {
  const nav = useNavigate();
  return (
    <div className="min-h-full flex flex-col">
      <header className="glass sticky top-0 z-20 safe-top px-4 pb-3 flex items-center gap-3 border-x-0 border-t-0">
        {back !== null && (
          <button className="btn btn-ghost !px-3 !py-2" onClick={() => nav(back)} aria-label="Back">
            ←
          </button>
        )}
        <h1 className="font-display text-xl tracking-wide uppercase flex-1 truncate">{title}</h1>
        {right}
      </header>
      <main className="flex-1 w-full max-w-3xl mx-auto px-4 py-4 safe-bottom">{children}</main>
    </div>
  );
}

import type { ReactNode } from 'react';

/** Bottom sheet on phones, centred dialog on wider screens. */
export function Sheet({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 fade-in flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="bg-ink-2 border border-line w-full sm:max-w-lg max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-4 pt-4 pb-2">
          <div className="font-display text-xl uppercase tracking-wider flex-1 truncate">{title}</div>
          <button className="btn btn-ghost !py-1.5 !px-3" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="overflow-y-auto px-4 pb-4 flex-1">{children}</div>
        {footer && <div className="px-4 pt-2 border-t border-line safe-bottom">{footer}</div>}
      </div>
    </div>
  );
}

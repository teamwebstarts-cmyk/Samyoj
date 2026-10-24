import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function Drawer({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  fit,
}: {
  open: boolean;
  /** Plain string or a composite header node (e.g. preview glyph + label + language pills). */
  title: ReactNode;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Shrink-to-fit width (md+) instead of the fixed max-w-md column. */
  fit?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  // Portal to <body>: keeps the drawer above app chrome (header/sidebar z-layers)
  // and makes `fixed inset-0` cover the real viewport even if an ancestor gains a
  // transform/filter/container-type that would turn it into the containing block.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-end bg-slate-950/40 backdrop-blur-xs md:items-stretch">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        tabIndex={-1}
        className={`relative z-10 flex flex-col rounded-t-2xl bg-white shadow-2xl outline-none ring-1 ring-slate-900/10 h-[90vh] md:h-full md:rounded-l-2xl md:rounded-r-none transition-transform duration-200 ease-out ${
          fit ? 'w-full md:w-fit md:max-w-full' : 'w-full md:max-w-md'
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 bg-slate-50/70 px-5 py-4">
          <div className="min-w-0">
            <h2 id="drawer-title" className="text-base font-bold tracking-tight text-slate-900">
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-200/80 bg-slate-50/50 px-5 py-3.5 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

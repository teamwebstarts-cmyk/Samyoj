import { useEffect, type ReactNode } from 'react';
import { Button } from './AppButton';

export function Drawer({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-end bg-ink/30 md:items-stretch">
      <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        className="relative z-10 flex h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl md:h-full md:max-w-md md:rounded-none"
      >
        <div className="flex items-start justify-between gap-3 border-b border-dust px-5 py-4">
          <div>
            <h2 id="drawer-title" className="text-lg font-semibold">
              {title}
            </h2>
            {subtitle && <p className="mt-1 text-sm text-ink/55">{subtitle}</p>}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-dust px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

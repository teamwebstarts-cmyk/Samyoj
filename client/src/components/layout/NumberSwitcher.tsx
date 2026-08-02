import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Phone } from 'lucide-react';
import { useWhatsAppNumber } from '../../contexts/WhatsAppNumberContext';
import { formatPhoneDisplay } from '../../utils/formatPhone';

export default function NumberSwitcher() {
  const { numbers, activeNumber, hasMultiple, switchNumber, loading } = useWhatsAppNumber();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  if (loading || !activeNumber || !hasMultiple) return null;

  return (
    <div ref={rootRef} className="relative hidden sm:block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-[2.625rem] max-w-[200px] items-center gap-2 rounded-[0.875rem] border border-[#e5e7eb] bg-white px-2.5 text-left transition hover:border-[#d1d5db] hover:bg-[#fafafa] dark:border-theme-border dark:bg-theme-surface dark:hover:bg-theme-subtle lg:max-w-[220px]"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Switch WhatsApp business number"
        title="Switch business number"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#16a34a] text-white">
          <Phone className="h-3.5 w-3.5" strokeWidth={2.25} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
            Number
          </span>
          <span className="block truncate text-[12.5px] font-bold leading-tight text-neutral-900 dark:text-theme-fg">
            {formatPhoneDisplay(activeNumber.phoneNumber)}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-neutral-400 transition ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Choose business number"
          className="absolute right-0 top-[calc(100%+6px)] z-50 w-[min(320px,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-theme-border bg-theme-surface shadow-panel"
        >
          <div className="border-b border-theme-border px-4 py-3">
            <p className="text-[13px] font-bold text-theme-fg">Switch business number</p>
            <p className="mt-0.5 text-[12px] leading-snug text-theme-secondary">
              Each number has its own inbox, contacts, and reports — like a separate account.
            </p>
          </div>

          <ul className="max-h-[280px] overflow-y-auto p-2">
            {numbers.map((num) => {
              const selected = num.id === activeNumber.id;
              return (
                <li key={num.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      if (!selected) switchNumber(num.id);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                      selected
                        ? 'bg-whatsapp-50 ring-1 ring-whatsapp-200 dark:bg-whatsapp-500/10 dark:ring-whatsapp-500/30'
                        : 'hover:bg-theme-subtle'
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        selected
                          ? 'bg-whatsapp-500 text-white'
                          : 'bg-theme-subtle text-theme-secondary ring-1 ring-theme-border'
                      }`}
                    >
                      <Phone className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-bold text-theme-fg">
                        {formatPhoneDisplay(num.phoneNumber)}
                      </span>
                      <span className="block text-[12px] text-theme-muted">
                        {selected ? 'Currently viewing this number' : 'Tap to switch'}
                      </span>
                    </span>
                    {selected && (
                      <Check className="h-5 w-5 shrink-0 text-whatsapp-600 dark:text-whatsapp-400" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Compact switcher for mobile — shown in topbar on small screens */
export function NumberSwitcherMobile() {
  const { numbers, activeNumber, hasMultiple, switchNumber, loading } = useWhatsAppNumber();

  if (loading || !activeNumber || !hasMultiple) return null;

  return (
    <label className="relative flex sm:hidden">
      <span className="sr-only">Switch business number</span>
      <select
        value={activeNumber.id}
        onChange={(e) => switchNumber(e.target.value)}
        className="max-w-[140px] truncate rounded-lg border border-whatsapp-200/80 bg-whatsapp-50/90 py-1.5 pl-2 pr-7 text-[12px] font-bold text-theme-fg dark:border-whatsapp-500/25 dark:bg-whatsapp-500/10"
        aria-label="Switch business number"
      >
        {numbers.map((num) => (
          <option key={num.id} value={num.id}>
            {formatPhoneDisplay(num.phoneNumber)}
          </option>
        ))}
      </select>
    </label>
  );
}

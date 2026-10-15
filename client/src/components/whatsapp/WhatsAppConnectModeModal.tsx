import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Cloud, Info, Link2, Smartphone, X } from 'lucide-react';
import WhatsAppConnectModeCompare, {
  type ConnectModePreview,
} from './WhatsAppConnectModeCompare';

interface WhatsAppConnectModeModalProps {
  open: boolean;
  onClose: () => void;
  onConnectStandard: () => void;
  onConnectCoexistence: () => void;
  connecting?: boolean;
}

export default function WhatsAppConnectModeModal({
  open,
  onClose,
  onConnectStandard,
  onConnectCoexistence,
  connecting = false,
}: WhatsAppConnectModeModalProps) {
  const [preview, setPreview] = useState<ConnectModePreview>(null);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-neutral-900/35 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Close"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wa-connect-mode-title"
        className="relative w-full max-w-lg overflow-hidden rounded-t-[1.25rem] border border-neutral-200 bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
          <div>
            <h2 id="wa-connect-mode-title" className="text-lg font-extrabold text-neutral-900">
              Connect WhatsApp
            </h2>
            <p className="mt-0.5 text-[13px] text-neutral-500">
              Pick one. Facebook opens next — choose your existing business, not a new portfolio.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100"
            aria-label="Close dialog"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2.5 px-5 pb-4">
          <button
            type="button"
            disabled={connecting}
            onClick={onConnectStandard}
            onMouseEnter={() => setPreview('standard')}
            onMouseLeave={() => setPreview(null)}
            onFocus={() => setPreview('standard')}
            onBlur={() => setPreview(null)}
            className="group flex w-full items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3.5 text-left transition hover:border-whatsapp-400 hover:bg-whatsapp-50/30 hover:shadow-sm disabled:opacity-60"
          >
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-whatsapp-500 to-emerald-600 text-white shadow-sm"
              aria-hidden
            >
              <Cloud className="h-5 w-5" strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[13px] font-bold text-neutral-900 sm:text-[14px]">
                WhatsApp Cloud API
                <span className="font-semibold text-neutral-500">(standard)</span>
                <span
                  className="inline-flex"
                  title="Use this when the number is already on Cloud API and not on the WhatsApp Business phone app."
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                >
                  <Info className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
                </span>
              </span>
              <span className="mt-0.5 block text-[12px] text-neutral-500">
                Number not on the Business mobile app
              </span>
            </span>
            <span
              className="hidden shrink-0 rounded-full bg-whatsapp-100 px-2 py-0.5 text-[10px] font-semibold text-whatsapp-800 opacity-0 transition group-hover:opacity-100 sm:inline"
              aria-hidden
            >
              Continue
            </span>
          </button>

          <button
            type="button"
            disabled={connecting}
            onClick={onConnectCoexistence}
            onMouseEnter={() => setPreview('coexistence')}
            onMouseLeave={() => setPreview(null)}
            onFocus={() => setPreview('coexistence')}
            onBlur={() => setPreview(null)}
            className="group flex w-full items-center gap-3 rounded-xl border border-neutral-200 bg-white p-3.5 text-left transition hover:border-sky-400 hover:bg-sky-50/40 hover:shadow-sm disabled:opacity-60"
          >
            <span
              className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-sm"
              aria-hidden
            >
              <Smartphone className="h-5 w-5" strokeWidth={2} />
              <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-sky-800 text-white">
                <Link2 className="h-2.5 w-2.5" strokeWidth={2.5} />
              </span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[13px] font-bold text-neutral-900 sm:text-[14px]">
                Use my phone number
                <span className="font-semibold text-neutral-500">(coexistence)</span>
                <span
                  className="inline-flex"
                  title="Use this only when the number is already on the WhatsApp Business phone app, version 2.24.17 or newer. Connecting unlinks WhatsApp Web and desktop companions. A Cloud API-only number cannot use this."
                  onMouseDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                >
                  <Info className="h-3.5 w-3.5 text-neutral-400" aria-hidden />
                </span>
              </span>
              <span className="mt-0.5 block text-[12px] text-neutral-500">
                Business app 2.24.17 or newer. Web and desktop apps unlink.
              </span>
            </span>
            <span
              className="hidden shrink-0 rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-900 opacity-0 transition group-hover:opacity-100 sm:inline"
              aria-hidden
            >
              Continue
            </span>
          </button>

          <WhatsAppConnectModeCompare active={preview} />
        </div>
      </div>
    </div>,
    document.body
  );
}

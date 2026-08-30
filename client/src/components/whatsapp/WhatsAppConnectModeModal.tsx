import { createPortal } from 'react-dom';
import { Smartphone, X, Cloud, MessageCircle } from 'lucide-react';
import AppButton from '../ui/AppButton';
import MetaPolicyDeadlinesCard from './MetaPolicyDeadlinesCard';

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
        <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-whatsapp-700">
              Connect WhatsApp
            </p>
            <h2 id="wa-connect-mode-title" className="mt-0.5 text-[17px] font-extrabold text-neutral-900">
              How do you use WhatsApp today?
            </h2>
            <p className="mt-1 text-[13px] text-neutral-600">
              Choose your setup first — then Facebook sign-in will open.
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

        <div className="space-y-3 px-5 py-4">
          <button
            type="button"
            disabled={connecting}
            onClick={onConnectStandard}
            className="flex w-full items-start gap-3 rounded-xl border border-neutral-200 bg-gradient-to-r from-white to-emerald-50/40 p-4 text-left transition hover:border-whatsapp-300 hover:shadow-sm disabled:opacity-60"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-whatsapp-500 text-white">
              <Cloud className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-[14px] font-bold text-neutral-900">
                New Cloud API number (no Business app)
              </span>
              <span className="mt-0.5 block text-[12.5px] leading-relaxed text-neutral-600">
                Standard setup — a new business line, or a number that is not on the phone app.
              </span>
            </span>
          </button>

          <button
            type="button"
            disabled={connecting}
            onClick={onConnectCoexistence}
            className="flex w-full items-start gap-3 rounded-xl border border-sky-200 bg-gradient-to-r from-white to-sky-50/50 p-4 text-left transition hover:border-sky-300 hover:shadow-sm disabled:opacity-60"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-600 text-white">
              <Smartphone className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-[14px] font-bold text-neutral-900">
                WhatsApp Business app is already on the phone
              </span>
              <span className="mt-0.5 block text-[12.5px] leading-relaxed text-neutral-600">
                Coexistence — the phone app and Samyoj Cloud API run together. Older chats can sync.
              </span>
            </span>
          </button>

          <div className="flex items-start gap-2 rounded-lg bg-neutral-50 px-3 py-2.5 text-[12px] text-neutral-600">
            <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-400" />
            <p>
              After you connect, add a payment method in Meta Business Suite for templates and paid messages.
            </p>
          </div>
        </div>

        <div className="border-t border-neutral-100 px-5 py-3">
          <MetaPolicyDeadlinesCard compact />
        </div>

        <div className="flex justify-end gap-2 border-t border-neutral-100 px-5 py-3">
          <AppButton variant="secondary" size="sm" onClick={onClose} disabled={connecting}>
            Cancel
          </AppButton>
        </div>
      </div>
    </div>,
    document.body
  );
}

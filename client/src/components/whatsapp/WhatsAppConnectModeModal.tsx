import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, Cloud, Info, Lightbulb, ShieldCheck, Smartphone, X } from 'lucide-react';
import WhatsAppGlyph from '../dashboard/icons/WhatsAppGlyph';

interface WhatsAppConnectModeModalProps {
  open: boolean;
  onClose: () => void;
  onConnectStandard: () => void;
  onConnectCoexistence: () => void;
  connecting?: boolean;
}

function Feature({ children }: { children: string }) {
  return (
    <li className="flex items-start gap-1.5 text-[12px] font-medium leading-snug text-neutral-700 sm:gap-2 sm:text-[13px]">
      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#22c55e] sm:h-4 sm:w-4" strokeWidth={2.6} aria-hidden />
      <span>{children}</span>
    </li>
  );
}

function ModeIcon({
  tone,
  children,
}: {
  tone: 'green' | 'blue';
  children: ReactNode;
}) {
  const tile =
    tone === 'green'
      ? 'bg-[#e8f9ef] text-[#16a34a]'
      : 'bg-[#eef4ff] text-[#3b82f6]';
  return (
    <span className={`relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-12 sm:w-12 sm:rounded-2xl ${tile}`} aria-hidden>
      {children}
      <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#25D366] text-white ring-2 ring-white sm:h-5 sm:w-5">
        <WhatsAppGlyph className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
      </span>
    </span>
  );
}

function ModeBadge({
  tone,
  children,
}: {
  tone: 'green' | 'blue';
  children: string;
}) {
  const toneClass =
    tone === 'green'
      ? 'bg-[#e8f8ee] text-[#16a34a]'
      : 'bg-[#eef2ff] text-[#4f46e5]';
  const dot = tone === 'green' ? 'bg-[#22c55e]' : 'bg-[#6366f1]';
  return (
    <p className={`mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase leading-tight tracking-[0.04em] sm:mt-2 sm:py-1 sm:text-[10px] sm:tracking-[0.05em] ${toneClass}`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} aria-hidden />
      <span className="min-w-0 text-pretty">{children}</span>
    </p>
  );
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
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-2.5 sm:items-center sm:p-4">
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
        className="relative flex max-h-[calc(100dvh-1.25rem)] w-full max-w-[760px] flex-col overflow-hidden rounded-[1.15rem] border border-[#e6f4ec] bg-[#f7fbf8] shadow-2xl sm:max-h-[min(920px,calc(100dvh-2rem))] sm:rounded-[1.35rem]"
      >
        <div className="shrink-0 px-3 pb-0 pt-2.5 sm:px-6 sm:pb-1 sm:pt-5">
          <div className="flex items-start gap-2 sm:gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#25D366] text-white shadow-sm sm:h-11 sm:w-11 sm:rounded-2xl" aria-hidden>
              <WhatsAppGlyph className="h-[18px] w-[18px] sm:h-6 sm:w-6" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <h2 id="wa-connect-mode-title" className="text-[16px] font-extrabold leading-tight tracking-[-0.02em] text-neutral-950 sm:text-[22px]">
                Connect WhatsApp
              </h2>
              <p className="text-pretty text-[11.5px] font-medium leading-snug text-neutral-500 sm:mt-0.5 sm:text-[14px]">
                Choose how you want to connect your business number.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-neutral-400 hover:bg-white hover:text-neutral-700"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-1.5 inline-flex max-w-full items-center gap-1 rounded-full bg-[#e8f8ee] px-2 py-0.5 text-[10.5px] font-semibold text-[#15803d] sm:mt-3 sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-[12px]">
            <ShieldCheck className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" strokeWidth={2.4} aria-hidden />
            <span className="min-w-0">Secure setup powered by Meta.</span>
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(0.65rem,env(safe-area-inset-bottom))] pt-1.5 sm:px-6 sm:pb-5 sm:pt-3">
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-3">
            <section className="flex flex-col rounded-xl border border-[#b7ebc9] bg-[linear-gradient(180deg,#f3fbf6_0%,#ffffff_42%)] p-2.5 shadow-[0_1px_2px_rgba(22,163,74,0.04)] sm:rounded-2xl sm:p-4">
              <ModeIcon tone="green">
                <Cloud className="h-4 w-4 sm:h-6 sm:w-6" strokeWidth={1.8} />
              </ModeIcon>
              <h3 className="mt-1.5 text-[14px] font-extrabold tracking-[-0.02em] text-neutral-950 sm:mt-3 sm:text-[17px]">
                Connect a new number
              </h3>
              <ModeBadge tone="green">Cloud API</ModeBadge>
              <p className="mt-1 text-pretty text-[11.5px] font-medium leading-snug text-neutral-600 sm:mt-2 sm:text-[13px]">
                For a number dedicated to Samyoj that isn’t currently active in the WhatsApp Business app.
              </p>
              <ul className="mt-1.5 space-y-0.5 sm:mt-3 sm:space-y-1.5">
                <Feature>Manage messaging in Samyoj</Feature>
                <Feature>Designed for API-based workflows</Feature>
              </ul>
              <div className="mt-auto pt-2 sm:pt-4">
                <button
                  type="button"
                  disabled={connecting}
                  onClick={onConnectStandard}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#22c55e] px-3 py-1.5 text-[12.5px] font-bold text-white shadow-[0_6px_16px_rgba(34,197,94,0.28)] transition hover:bg-[#16a34a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#22c55e] focus-visible:ring-offset-2 disabled:opacity-60 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-[14px]"
                >
                  Use a new number
                  <span aria-hidden>→</span>
                </button>
                <p className="mt-3 hidden min-h-[2.6rem] sm:block" aria-hidden />
              </div>
            </section>

            <section className="flex flex-col rounded-xl border border-[#e6ebf2] bg-white p-2.5 sm:rounded-2xl sm:p-4">
              <ModeIcon tone="blue">
                <Smartphone className="h-4 w-4 sm:h-6 sm:w-6" strokeWidth={1.8} />
              </ModeIcon>
              <h3 className="mt-1.5 text-[14px] font-extrabold tracking-[-0.02em] text-neutral-950 sm:mt-3 sm:text-[17px]">
                Keep my current number
              </h3>
              <ModeBadge tone="blue">Existing WhatsApp Business app</ModeBadge>
              <p className="mt-1 text-pretty text-[11.5px] font-medium leading-snug text-neutral-600 sm:mt-2 sm:text-[13px]">
                Keep using your WhatsApp Business app while connecting the same number to Samyoj.
              </p>
              <ul className="mt-1.5 space-y-0.5 sm:mt-3 sm:space-y-1.5">
                <Feature>Continue using the app on your phone</Feature>
                <Feature>Messages can sync with Samyoj</Feature>
              </ul>
              <div className="mt-auto pt-2 sm:pt-4">
                <button
                  type="button"
                  disabled={connecting}
                  onClick={onConnectCoexistence}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#e5e7eb] bg-white px-3 py-1.5 text-[12.5px] font-bold text-neutral-900 transition hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 focus-visible:ring-offset-2 disabled:opacity-60 sm:rounded-xl sm:px-4 sm:py-2.5 sm:text-[14px]"
                >
                  Connect existing number
                  <span aria-hidden>→</span>
                </button>
                <p className="mt-1.5 flex items-start gap-1 text-[10px] font-medium leading-snug text-neutral-400 sm:mt-3 sm:gap-1.5 sm:text-[11px]">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>Available for eligible WhatsApp Business app numbers; Meta checks eligibility during setup.</span>
                </p>
              </div>
            </section>
          </div>

          <div className="mt-1.5 flex items-start gap-2 rounded-xl border border-[#e7eef6] bg-[#f4f7fb] px-2.5 py-1.5 sm:mt-3 sm:gap-3 sm:rounded-2xl sm:px-4 sm:py-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#fff4cc] text-[#ca8a04] sm:mt-0.5 sm:h-7 sm:w-7" aria-hidden>
              <Lightbulb className="h-3 w-3 sm:h-3.5 sm:w-3.5" strokeWidth={2.4} />
            </span>
            <p className="text-pretty text-[11px] font-medium leading-snug text-neutral-600 sm:text-[12.5px] sm:leading-relaxed">
              <span className="font-bold text-neutral-800">Not sure?</span> If you already chat with customers in the WhatsApp Business app, choose “Keep my current number”. If you’re starting fresh with a dedicated number, choose “Connect a new number”.
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

import { ExternalLink, ShieldCheck } from 'lucide-react';
import InfoTip from '../ui/InfoTip';

export default function MetaCostExplainerCard() {
  return (
    <div className="rounded-2xl border border-theme-border bg-theme-surface p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
              <ShieldCheck className="h-3 w-3" />
              Meta Transparency
            </span>
            <span className="text-[11px] font-medium text-theme-muted">
              Billed by Meta directly
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <h3 className="text-base font-extrabold tracking-tight text-theme-fg sm:text-lg">
              Message Costs — Meta & Samyoj
            </h3>
            <InfoTip content="Meta bills you for WhatsApp messages. Samyoj bills you separately for the software. Samyoj does not add any extra charge on top of Meta's rates." />
          </div>
        </div>

        <a
          href="https://business.facebook.com/billing_hub"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-theme-border bg-theme-subtle/50 px-3 py-1.5 text-xs font-bold text-theme-fg transition-colors hover:bg-theme-subtle"
        >
          <span>WhatsApp Billing Hub</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Marketing */}
        <div className="rounded-xl border border-theme-border bg-theme-subtle/30 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-theme-fg">Marketing</span>
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              ~INR 0.78 / msg
            </span>
          </div>
          <p className="mt-1 text-[11px] text-theme-muted">
            Ads, offers & campaigns.
          </p>
        </div>

        {/* Utility */}
        <div className="rounded-xl border border-theme-border bg-theme-subtle/30 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-theme-fg">Utility</span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              ~INR 0.30 / msg
            </span>
          </div>
          <p className="mt-1 text-[11px] text-theme-muted">
            Order updates & alerts.
          </p>
        </div>

        {/* Authentication */}
        <div className="rounded-xl border border-theme-border bg-theme-subtle/30 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-theme-fg">Authentication</span>
            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
              ~INR 0.30 / msg
            </span>
          </div>
          <p className="mt-1 text-[11px] text-theme-muted">
            OTP & login codes.
          </p>
        </div>

        {/* Service */}
        <div className="rounded-xl border border-theme-border bg-theme-subtle/30 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-theme-fg">Customer replies</span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              100% Free
            </span>
          </div>
          <p className="mt-1 text-[11px] text-theme-muted">
            Free when customer messages first.
          </p>
        </div>
      </div>
    </div>
  );
}

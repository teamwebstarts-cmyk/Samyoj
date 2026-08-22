import { ExternalLink, Info, ShieldCheck } from 'lucide-react';

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
              Official Tech Provider Model
            </span>
          </div>
          <h3 className="text-base font-extrabold tracking-tight text-theme-fg sm:text-lg">
            WhatsApp & Meta Billing (Two Ledgers)
          </h3>
          <p className="max-w-2xl text-xs text-theme-secondary">
            You pay Meta directly for messages. Samyoj charges only for its software on a separate bill.
          </p>
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
            Promotions & offers. Billed on delivery.
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
            Order confirmations & shipping updates. Volume tiers apply.
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
            OTP & account security codes.
          </p>
        </div>

        {/* Service */}
        <div className="rounded-xl border border-theme-border bg-theme-subtle/30 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-theme-fg">Support Replies</span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              100% Free
            </span>
          </div>
          <p className="mt-1 text-[11px] text-theme-muted">
            Customer replies within 24-hr service window are free.
          </p>
        </div>
      </div>

      <div className="mt-3.5 flex items-center gap-2 rounded-xl bg-theme-subtle/50 p-2.5 text-[11px] text-theme-secondary">
        <Info className="h-4 w-4 shrink-0 text-theme-muted" />
        <span>
          <strong>Zero Markup Promise:</strong> Rates above are official Meta Cloud API benchmarks. Samyoj never adds surcharges — you pay Meta the same price directly.
        </span>
      </div>
    </div>
  );
}

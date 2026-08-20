import { ExternalLink, Info, ShieldCheck } from 'lucide-react';

export default function MetaCostExplainerCard() {
  return (
    <div className="overflow-hidden rounded-2xl border border-sky-200/70 bg-[linear-gradient(135deg,#f8fafc_0%,#f0f9ff_50%,#ffffff_100%)] p-5 shadow-sm dark:border-sky-900/40 dark:bg-[linear-gradient(135deg,#0b1526_0%,#0f1d33_50%,#0b1424_100%)] sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-sky-700 ring-1 ring-sky-200/70 dark:bg-sky-950/50 dark:text-sky-300 dark:ring-sky-800/60">
              <ShieldCheck className="h-3 w-3" />
              Meta Transparency
            </span>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Official Tech Provider Model
            </span>
          </div>
          <h3 className="text-base font-extrabold tracking-tight text-neutral-900 dark:text-white sm:text-lg">
            Understanding WhatsApp & Meta Billing (Two Ledgers)
          </h3>
          <p className="max-w-2xl text-xs text-neutral-600 dark:text-slate-300">
            Samyoj charges for software tools, AI, and CRM seats. Meta Cloud API charges are billed directly to your WhatsApp Business Account payment card with zero hidden markups.
          </p>
        </div>

        <a
          href="https://business.facebook.com/billing_hub"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-sky-300/80 bg-white px-3 py-1.5 text-xs font-bold text-sky-700 shadow-sm transition-colors hover:bg-sky-50 dark:border-sky-800 dark:bg-slate-900 dark:text-sky-300 dark:hover:bg-slate-800"
        >
          <span>WhatsApp Billing Hub</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Marketing */}
        <div className="rounded-xl border border-neutral-200/80 bg-white/80 p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-800 dark:text-slate-200">Marketing</span>
            <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              ~₹0.86 / msg
            </span>
          </div>
          <p className="mt-1 text-[11px] text-neutral-500 dark:text-slate-400">
            Promotions, offers, broadcasts, cart abandonment reminders. Billed on delivery.
          </p>
        </div>

        {/* Utility */}
        <div className="rounded-xl border border-neutral-200/80 bg-white/80 p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-800 dark:text-slate-200">Utility</span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              ~₹0.115 / msg
            </span>
          </div>
          <p className="mt-1 text-[11px] text-neutral-500 dark:text-slate-400">
            Order confirmations, shipping updates, payment reminders. Volume tiers apply.
          </p>
        </div>

        {/* Authentication */}
        <div className="rounded-xl border border-neutral-200/80 bg-white/80 p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-800 dark:text-slate-200">Authentication</span>
            <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300">
              ~₹0.115 / msg
            </span>
          </div>
          <p className="mt-1 text-[11px] text-neutral-500 dark:text-slate-400">
            One-time passwords (OTP) and account security verification codes.
          </p>
        </div>

        {/* Service */}
        <div className="rounded-xl border border-neutral-200/80 bg-white/80 p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-800 dark:text-slate-200">Support Replies</span>
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              100% Free
            </span>
          </div>
          <p className="mt-1 text-[11px] text-neutral-500 dark:text-slate-400">
            Inbound customer messages & replies within the 24-hr service window are free.
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-xl bg-sky-50/60 p-3 text-[11px] text-sky-900 dark:bg-sky-950/30 dark:text-sky-200">
        <Info className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" />
        <span>
          <strong>Zero Markup Promise:</strong> Rates above are official Meta Cloud API India benchmarks (exclusive of Meta statutory taxes). Samyoj passes Meta fees through transparently without intermediary surcharges.
        </span>
      </div>
    </div>
  );
}

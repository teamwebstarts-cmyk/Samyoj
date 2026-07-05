import { Link } from 'react-router-dom';
import { ArrowRight, FormInput } from 'lucide-react';
import AppButton from '../ui/AppButton';

export default function WhatsAppFormsPromo() {
  return (
    <div className="dashboard-card relative mt-4 overflow-hidden border-teal-500/10 bg-gradient-to-r from-teal-500/[0.04] via-transparent to-violet-500/[0.02] p-4 sm:p-5">
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-teal-500/10 blur-2xl"
        aria-hidden
      />

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white shadow-sm">
            <FormInput className="h-4 w-4" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-extrabold text-theme-fg sm:text-[14px]">
              WhatsApp Forms
              <span className="ml-2 rounded-full bg-teal-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-teal-700 ring-1 ring-teal-500/15 dark:text-teal-300">
                Advanced
              </span>
            </p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-theme-secondary sm:text-[13px]">
              Meta-native forms for surveys, bookings, and lead capture — filled inside WhatsApp.
            </p>
          </div>
        </div>

        <Link to="/automations/flows/new" className="shrink-0 sm:ml-4">
          <AppButton variant="secondary" size="sm" icon={<ArrowRight size={14} />}>
            Open flow builder
          </AppButton>
        </Link>
      </div>
    </div>
  );
}

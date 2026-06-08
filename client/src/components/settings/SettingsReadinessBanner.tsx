import { AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import AppButton from '../ui/AppButton';

interface SettingsReadinessBannerProps {
  isReady: boolean;
  setupProgress: number;
  onGoToSetup: () => void;
  onConnect?: () => void;
  connecting?: boolean;
}

export default function SettingsReadinessBanner({
  isReady,
  setupProgress,
  onGoToSetup,
  onConnect,
  connecting,
}: SettingsReadinessBannerProps) {
  if (isReady) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200/70 bg-gradient-to-r from-emerald-50/90 via-white to-teal-50/50 px-4 py-3.5 dark:border-emerald-800/40 dark:from-emerald-950/25 dark:via-theme-surface dark:to-teal-950/15 sm:px-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-whatsapp-500 to-emerald-600 text-white shadow-[0_4px_12px_rgba(37,211,102,0.28)]">
          <CheckCircle2 className="h-4 w-4" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-extrabold text-emerald-900 dark:text-emerald-200">
            Workspace is live
          </p>
          <p className="text-[12px] font-medium text-emerald-800/80 dark:text-emerald-300/80">
            WhatsApp and webhooks are configured. You&apos;re ready to message customers.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-r from-amber-50/90 via-white to-orange-50/40 dark:border-amber-800/40 dark:from-amber-950/25 dark:via-theme-surface dark:to-orange-950/10">
      <div className="h-0.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-[0_4px_12px_rgba(245,158,11,0.28)]">
            <AlertCircle className="h-4 w-4" strokeWidth={2.25} />
          </div>
          <div>
            <p className="text-[13px] font-extrabold text-amber-900 dark:text-amber-200">
              Setup incomplete — {setupProgress}% ready
            </p>
            <p className="mt-0.5 text-[12px] font-medium text-amber-800/85 dark:text-amber-300/85">
              Connect WhatsApp and register webhooks to unlock inbox and campaigns.
            </p>
            <div className="mt-2.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-amber-200/60 dark:bg-amber-900/40">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-whatsapp-500 transition-all duration-500"
                style={{ width: `${setupProgress}%` }}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {onConnect && (
            <AppButton size="sm" onClick={onConnect} loading={connecting}>
              Connect WhatsApp
            </AppButton>
          )}
          <AppButton
            size="sm"
            variant="secondary"
            icon={<ArrowRight size={14} />}
            onClick={onGoToSetup}
          >
            Setup guide
          </AppButton>
        </div>
      </div>
    </div>
  );
}

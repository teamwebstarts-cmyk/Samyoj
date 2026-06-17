import { AlertCircle, ArrowRight, CheckCircle2, Circle } from 'lucide-react';
import { Link } from 'react-router-dom';
import AppButton from '../ui/AppButton';

export interface ReadinessCheck {
  id: string;
  label: string;
  completed: boolean;
  href?: string;
}

interface SettingsReadinessBannerProps {
  isReady: boolean;
  setupProgress: number;
  completedCount: number;
  totalChecks: number;
  checks?: ReadinessCheck[];
  onGoToSetup: () => void;
  onConnect?: () => void;
  connecting?: boolean;
}

export default function SettingsReadinessBanner({
  isReady,
  setupProgress,
  completedCount,
  totalChecks,
  checks = [],
  onGoToSetup,
  onConnect,
  connecting,
}: SettingsReadinessBannerProps) {
  if (isReady) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-200/70 bg-gradient-to-r from-emerald-50/90 via-white to-teal-50/50 px-4 py-3.5 dark:border-emerald-800/40 dark:from-emerald-950/25 dark:via-theme-surface dark:to-teal-950/15 sm:px-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-whatsapp-600 to-emerald-700 text-white shadow-[0_4px_12px_rgba(37,211,102,0.28)]">
          <CheckCircle2 className="h-4 w-4" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-extrabold text-emerald-900 dark:text-emerald-200">
            You&apos;re all set
          </p>
          <p className="text-[12px] font-medium text-emerald-800/80 dark:text-emerald-300/80">
            All {totalChecks} launch checks passed. You can message customers now.
          </p>
        </div>
      </div>
    );
  }

  const remaining = totalChecks - completedCount;

  return (
    <div className="overflow-hidden rounded-2xl border border-amber-200/70 bg-gradient-to-r from-amber-50/90 via-white to-orange-50/40 dark:border-amber-800/40 dark:from-amber-950/25 dark:via-theme-surface dark:to-orange-950/10">
      <div className="h-0.5 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between sm:px-5 sm:py-4">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-[0_4px_12px_rgba(245,158,11,0.28)]">
            <AlertCircle className="h-4 w-4" strokeWidth={2.25} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-extrabold text-amber-900 dark:text-amber-200">
              {remaining} of {totalChecks} launch steps remaining — {setupProgress}% done
            </p>
            <p className="mt-0.5 text-[12px] font-medium text-amber-800/85 dark:text-amber-300/85">
              Complete these checks before going live with paying customers.
            </p>
            <div className="mt-2.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-amber-200/60 dark:bg-amber-900/40">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-whatsapp-500 transition-all duration-500"
                style={{ width: `${setupProgress}%` }}
              />
            </div>
            {checks.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {checks.map((check) => (
                  <li key={check.id} className="flex items-center gap-2 text-[12px]">
                    {check.completed ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-whatsapp-600" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                    )}
                    {check.href && !check.completed ? (
                      <Link
                        to={check.href}
                        className="font-semibold text-amber-900 underline-offset-2 hover:underline dark:text-amber-200"
                      >
                        {check.label}
                      </Link>
                    ) : (
                      <span
                        className={
                          check.completed
                            ? 'font-medium text-theme-secondary line-through'
                            : 'font-semibold text-amber-900 dark:text-amber-200'
                        }
                      >
                        {check.label}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {onConnect && !checks.find((c) => c.id === 'whatsapp')?.completed && (
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

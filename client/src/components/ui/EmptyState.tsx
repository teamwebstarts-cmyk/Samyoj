import type { LucideIcon } from 'lucide-react';
import { ArrowRight, Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type EmptyStateVariant = 'default' | 'filter' | 'error';

export interface EmptyStateStep {
  label: string;
  description?: string;
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
}

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  illustration?: ReactNode;
  variant?: EmptyStateVariant;
  steps?: string[] | EmptyStateStep[];
  stepsLabel?: string;
  hint?: string;
  compact?: boolean;
  /** No card border, shadow, or decorative background */
  bare?: boolean;
  className?: string;
}

const variantStyles: Record<
  EmptyStateVariant,
  {
    orb: string;
    mesh: string;
    iconGradient: string;
    iconGlow: string;
    iconRing: string;
    iconColor: string;
    stepNum: string;
    stepBorder: string;
    stepHover: string;
    accentLine: string;
    badge: string;
  }
> = {
  default: {
    orb: 'from-whatsapp-500/16 via-emerald-400/10 to-violet-400/6',
    mesh: 'from-whatsapp-500/[0.04] via-transparent to-violet-400/[0.03]',
    iconGradient: 'from-whatsapp-500 via-emerald-500 to-teal-600',
    iconGlow: 'from-whatsapp-400/30 via-emerald-300/20 to-transparent',
    iconRing: 'ring-white/30 dark:ring-white/10',
    iconColor: 'text-white',
    stepNum: 'bg-gradient-to-br from-whatsapp-500 to-emerald-600 text-white shadow-sm',
    stepBorder: 'border-theme-border/60 bg-theme-surface/80',
    stepHover: 'hover:border-whatsapp-300/50 hover:shadow-md dark:hover:border-whatsapp-500/25',
    accentLine: 'from-whatsapp-500/40 via-emerald-400/30 to-violet-400/20',
    badge: 'bg-whatsapp-500/10 text-whatsapp-700 ring-whatsapp-500/20 dark:bg-whatsapp-500/15 dark:text-whatsapp-300',
  },
  filter: {
    orb: 'from-slate-400/10 via-neutral-300/6 to-transparent',
    mesh: 'from-slate-400/[0.03] via-transparent to-transparent',
    iconGradient: 'from-slate-100 via-white to-slate-50 dark:from-slate-700 dark:via-slate-800 dark:to-slate-900',
    iconGlow: 'from-slate-300/20 to-transparent dark:from-slate-500/15',
    iconRing: 'ring-theme-border',
    iconColor: 'text-theme-secondary',
    stepNum: 'bg-theme-subtle text-theme-secondary',
    stepBorder: 'border-theme-border/60 bg-theme-surface/70',
    stepHover: 'hover:border-theme-border hover:shadow-sm',
    accentLine: 'from-theme-border via-theme-border/50 to-transparent',
    badge: 'bg-theme-subtle text-theme-secondary ring-theme-border',
  },
  error: {
    orb: 'from-amber-400/14 via-orange-300/8 to-transparent',
    mesh: 'from-amber-400/[0.04] via-transparent to-transparent',
    iconGradient: 'from-amber-500 via-orange-500 to-amber-600',
    iconGlow: 'from-amber-400/25 to-transparent',
    iconRing: 'ring-white/30 dark:ring-white/10',
    iconColor: 'text-white',
    stepNum: 'bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-sm',
    stepBorder: 'border-amber-200/50 bg-amber-50/30 dark:border-amber-500/20 dark:bg-amber-950/20',
    stepHover: 'hover:border-amber-300/60 hover:shadow-md dark:hover:border-amber-500/30',
    accentLine: 'from-amber-400/40 via-orange-300/25 to-transparent',
    badge: 'bg-amber-500/10 text-amber-800 ring-amber-500/20 dark:bg-amber-500/15 dark:text-amber-300',
  },
};

function normalizeSteps(steps?: string[] | EmptyStateStep[]): EmptyStateStep[] {
  if (!steps) return [];
  return steps.slice(0, 3).map((step) => (typeof step === 'string' ? { label: step } : step));
}

function StepCard({
  step,
  index,
  compact,
  styles,
}: {
  step: EmptyStateStep;
  index: number;
  compact: boolean;
  styles: (typeof variantStyles)[EmptyStateVariant];
}) {
  const StepIcon = step.icon;
  const interactive = Boolean(step.href || step.onClick);

  const inner = (
    <>
      <div className="flex items-center gap-2.5 sm:block sm:text-center">
        <span
          className={`flex shrink-0 items-center justify-center rounded-xl font-medium tabular-nums ${
            styles.stepNum
          } ${compact ? 'h-7 w-7 text-[11px]' : 'h-8 w-8 text-[12px] sm:mx-auto'}`}
        >
          {StepIcon ? <StepIcon className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} strokeWidth={2.25} /> : index + 1}
        </span>
        <div className={`min-w-0 flex-1 sm:mt-3 ${compact ? '' : ''}`}>
          <p
            className={`font-medium leading-snug text-theme-fg ${
              compact ? 'text-[13px]' : 'text-[13px] sm:text-[14px]'
            }`}
          >
            {step.label}
          </p>
          {step.description && (
            <p className={`mt-0.5 font-medium leading-relaxed text-theme-secondary ${compact ? 'text-[11px]' : 'text-[12px]'}`}>
              {step.description}
            </p>
          )}
        </div>
        {interactive && (
          <ArrowRight
            className={`hidden shrink-0 text-theme-muted transition group-hover:translate-x-0.5 group-hover:text-whatsapp-600 sm:block ${
              compact ? 'h-3.5 w-3.5' : 'h-4 w-4'
            }`}
          />
        )}
      </div>
    </>
  );

  const cardClass = `group relative rounded-2xl border backdrop-blur-sm transition-all duration-200 ${styles.stepBorder} ${
    interactive ? `cursor-pointer ${styles.stepHover} active:scale-[0.99]` : ''
  } ${compact ? 'px-3.5 py-3' : 'px-4 py-3.5 sm:px-4 sm:py-5 sm:text-center'}`;

  if (step.href) {
    return (
      <Link to={step.href} className={cardClass}>
        {inner}
      </Link>
    );
  }

  if (step.onClick) {
    return (
      <button type="button" onClick={step.onClick} className={`${cardClass} w-full text-left`}>
        {inner}
      </button>
    );
  }

  return <div className={cardClass}>{inner}</div>;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  illustration,
  variant = 'default',
  steps,
  hint,
  compact = false,
  bare = false,
  className = '',
}: EmptyStateProps) {
  const styles = variantStyles[variant];
  const normalizedSteps = normalizeSteps(steps);
  const showSparkle = variant === 'default' && !compact && !bare;

  return (
    <div
      className={`relative text-center ${
        bare
          ? compact
            ? 'px-4 py-6'
            : 'px-6 py-10'
          : `dashboard-card overflow-hidden ${compact ? 'px-5 py-8 sm:py-9' : 'px-6 py-12 sm:px-10 sm:py-16'}`
      } ${className}`}
      role="status"
    >
      {!bare && (
        <>
          <div
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(37,211,102,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(37,211,102,0.035)_1px,transparent_1px)] bg-[size:44px_44px] opacity-70 dark:opacity-35"
            aria-hidden
          />
          <div
            className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${styles.mesh}`}
            aria-hidden
          />
          <div
            className={`pointer-events-none absolute -left-16 -top-8 h-48 w-48 rounded-full bg-gradient-to-br blur-3xl ${styles.orb}`}
            aria-hidden
          />
          <div
            className={`pointer-events-none absolute -bottom-10 -right-10 h-44 w-44 rounded-full bg-gradient-to-tl blur-3xl ${styles.orb}`}
            aria-hidden
          />
        </>
      )}

      <div className="relative flex flex-col items-center">
        {illustration ?? (
          <div className="relative">
            {!bare && (
              <div
                className={`pointer-events-none absolute -inset-5 rounded-full bg-gradient-to-br blur-2xl ${styles.iconGlow}`}
                aria-hidden
              />
            )}
            <div
              className={`relative flex items-center justify-center rounded-[1.35rem] bg-gradient-to-br ${styles.iconGradient} ${
                bare ? '' : `shadow-[0_12px_40px_rgba(37,211,102,0.18)] ring-1 ${styles.iconRing}`
              } ${compact ? 'h-14 w-14' : 'h-[4.5rem] w-[4.5rem] sm:h-20 sm:w-20'}`}
            >
              <Icon
                className={`${styles.iconColor} ${compact ? 'h-6 w-6' : 'h-7 w-7 sm:h-8 sm:w-8'}`}
                strokeWidth={1.85}
              />
            </div>
            {showSparkle && (
              <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-md dark:border-neutral-900">
                <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} />
              </span>
            )}
          </div>
        )}

        <h3
          className={`empty-lead text-theme-fg ${compact ? 'mt-4' : 'mt-4 sm:mt-5'}`}
        >
          {title}
        </h3>

        {description && (
          <p
            className={`mx-auto font-medium leading-relaxed text-theme-secondary ${
              compact ? 'mt-1.5 max-w-xs text-[13px]' : 'mt-2 max-w-md text-[14px] sm:max-w-lg sm:text-[15px]'
            }`}
          >
            {description}
          </p>
        )}

        {normalizedSteps.length > 0 && (
          <div className={`w-full ${compact ? 'mt-4 max-w-sm' : 'mt-7 max-w-2xl sm:mt-8'}`}>
            {!compact && normalizedSteps.length > 1 ? <div className="mb-4" /> : null}

            <div
              className={`relative ${
                compact || normalizedSteps.length === 1
                  ? 'space-y-2'
                  : 'grid gap-2.5 sm:grid-cols-3 sm:gap-3'
              }`}
            >
              {!compact && normalizedSteps.length > 1 && (
                <div
                  className="pointer-events-none absolute left-[16.67%] right-[16.67%] top-[1.75rem] hidden h-px bg-gradient-to-r sm:block"
                  style={{
                    backgroundImage: `linear-gradient(to right, transparent, var(--color-border), var(--color-border), transparent)`,
                  }}
                  aria-hidden
                />
              )}
              {normalizedSteps.map((step, index) => (
                <StepCard
                  key={step.label}
                  step={step}
                  index={index}
                  compact={compact}
                  styles={styles}
                />
              ))}
            </div>
          </div>
        )}

        {hint && (
          <p
            className={`mt-4 text-[11px] font-semibold text-theme-secondary ${
              bare
                ? ''
                : 'inline-flex items-center gap-2 rounded-full border border-theme-border/80 bg-theme-subtle/80 px-3.5 py-1.5'
            }`}
          >
            {!bare && variant === 'default' && (
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-whatsapp-400 opacity-50" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-whatsapp-500" />
              </span>
            )}
            {hint}
          </p>
        )}

        {(action || secondaryAction) && (
          <div
            className={`flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-center ${
              compact ? 'mt-4' : 'mt-7'
            }`}
          >
            {action}
            {secondaryAction}
          </div>
        )}
      </div>
    </div>
  );
}

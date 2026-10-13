import { TEMPLATE_REVIEW_ETA, formatTemplateStatusForCustomer } from '../../utils/templateRejectionGuide';
import { getQualityLabel } from '../../utils/templateUtils';

const statusTextClass: Record<string, string> = {
  APPROVED: 'text-emerald-600 dark:text-emerald-400',
  PENDING: 'text-amber-600 dark:text-amber-400',
  REJECTED: 'text-red-600 dark:text-red-400',
  PAUSED: 'text-neutral-600 dark:text-neutral-400',
  DISABLED: 'text-neutral-500 dark:text-neutral-500',
};

const statusBadgeClass: Record<string, string> = {
  APPROVED:
    'bg-emerald-50 text-emerald-700 ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/60',
  PENDING:
    'bg-amber-50 text-amber-800 ring-amber-200/80 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/60',
  REJECTED:
    'bg-red-50 text-red-700 ring-red-200/80 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-800/60',
  PAUSED:
    'bg-neutral-100 text-neutral-700 ring-neutral-200/80 dark:bg-neutral-900 dark:text-neutral-300 dark:ring-neutral-700',
  DISABLED:
    'bg-neutral-100 text-neutral-500 ring-neutral-200/80 dark:bg-neutral-900 dark:text-neutral-400 dark:ring-neutral-700',
};

const qualityDotClass: Record<string, string> = {
  GREEN: 'bg-emerald-500',
  YELLOW: 'bg-amber-500',
  RED: 'bg-red-500',
};

function qualityShortLabel(score?: string): string | null {
  const q = getQualityLabel(score);
  if (!q) return null;
  if (q.label.includes('High')) return 'High';
  if (q.label.includes('Medium')) return 'Medium';
  if (q.label.includes('Low')) return 'Low';
  return q.label;
}

interface TemplateStatusCellProps {
  status?: string;
  qualityScore?: string;
  rejectedReason?: string | null;
  /** `badge` is the compact chip used on template cards. */
  variant?: 'stack' | 'badge';
  badgeClassName?: string;
}

export default function TemplateStatusCell({
  status,
  qualityScore,
  rejectedReason,
  variant = 'stack',
  badgeClassName = '',
}: TemplateStatusCellProps) {
  const upper = (status || '').toUpperCase();
  const quality = qualityShortLabel(qualityScore);
  const dotTone = (qualityScore || '').toUpperCase();

  if (variant === 'badge') {
    if (!upper) return <span className="text-[12px] text-theme-muted">—</span>;
    return (
      <span
        className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-bold ring-1 ${statusBadgeClass[upper] ?? 'bg-theme-subtle text-theme-fg ring-theme-border'} ${badgeClassName}`}
        title={upper === 'PENDING' ? TEMPLATE_REVIEW_ETA.detail : quality ? `Quality: ${quality}` : undefined}
      >
        {quality && upper === 'APPROVED' && (
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${qualityDotClass[dotTone] ?? 'bg-emerald-500'}`} />
        )}
        {formatTemplateStatusForCustomer(upper)}
      </span>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      {upper ? (
        <span
          className={`text-[12px] font-extrabold uppercase tracking-[0.04em] ${statusTextClass[upper] ?? 'text-theme-fg'}`}
        >
          {formatTemplateStatusForCustomer(upper)}
        </span>
      ) : (
        <span className="text-[13px] text-theme-muted">—</span>
      )}
      {upper === 'PENDING' && (
        <span
          className="text-[11px] font-medium text-theme-muted"
          title={TEMPLATE_REVIEW_ETA.detail}
        >
          {TEMPLATE_REVIEW_ETA.short}
        </span>
      )}
      {quality && upper === 'APPROVED' && (
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-theme-muted">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${qualityDotClass[dotTone] ?? 'bg-emerald-500'}`}
          />
          Quality: {quality}
        </span>
      )}
      {rejectedReason && (
        <p
          className="max-w-[200px] truncate text-[11px] font-medium text-red-600 dark:text-red-400"
          title={rejectedReason}
        >
          {rejectedReason}
        </p>
      )}
    </div>
  );
}

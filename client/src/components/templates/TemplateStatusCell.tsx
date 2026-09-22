import { TEMPLATE_REVIEW_ETA, formatTemplateStatusForCustomer } from '../../utils/templateRejectionGuide';
import { getQualityLabel } from '../../utils/templateUtils';

const statusTextClass: Record<string, string> = {
  APPROVED: 'text-emerald-600 dark:text-emerald-400',
  PENDING: 'text-amber-600 dark:text-amber-400',
  REJECTED: 'text-red-600 dark:text-red-400',
  PAUSED: 'text-neutral-600 dark:text-neutral-400',
  DISABLED: 'text-neutral-500 dark:text-neutral-500',
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
}

export default function TemplateStatusCell({
  status,
  qualityScore,
  rejectedReason,
}: TemplateStatusCellProps) {
  const upper = (status || '').toUpperCase();
  const quality = qualityShortLabel(qualityScore);
  const dotTone = (qualityScore || '').toUpperCase();

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

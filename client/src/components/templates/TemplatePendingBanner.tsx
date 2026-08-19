import { Clock } from 'lucide-react';
import { TEMPLATE_REVIEW_ETA } from '../../utils/templateRejectionGuide';

interface TemplatePendingBannerProps {
  pending: number;
}

/** Full-width approval status strip — always visible per templates mock. */
export default function TemplatePendingBanner({ pending }: TemplatePendingBannerProps) {
  return (
    <div className="flex items-start gap-2 border-b border-amber-200/70 bg-amber-50/90 px-3 py-2 sm:items-center sm:gap-3 sm:px-5 sm:py-3 dark:border-amber-900/40 dark:bg-amber-950/25">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600 ring-1 ring-amber-200/80 sm:h-8 sm:w-8 dark:bg-amber-900/50 dark:text-amber-300 dark:ring-amber-800/50">
        <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2.25} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-bold leading-snug text-amber-950 sm:text-[13px] dark:text-amber-100">
          {pending > 0
            ? `${pending} template${pending > 1 ? 's are' : ' is'} waiting for approval`
            : 'No templates waiting for approval'}
        </p>
        <p className="mt-0.5 hidden text-[12px] font-medium text-amber-800/85 sm:block dark:text-amber-300/80">
          {pending > 0
            ? `${TEMPLATE_REVIEW_ETA.typical}. We check every 30 seconds.`
            : 'New submissions usually take a few minutes to 24 hours.'}
        </p>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, X } from 'lucide-react';
import { billingApi } from '../../services/api';

interface QualityEntry {
  phoneNumber: string;
  qualityRating: string;
  wabaId: string;
}

export default function QualityRatingBanner() {
  const [ratings, setRatings] = useState<QualityEntry[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    billingApi
      .usage()
      .then((res) => {
        const data = res.data.data as { qualityRatings?: QualityEntry[] };
        const flagged = (data.qualityRatings || []).filter((r) =>
          ['YELLOW', 'RED'].includes(r.qualityRating.toUpperCase())
        );
        setRatings(flagged);
      })
      .catch(() => {
        /* non-blocking */
      });
  }, []);

  if (dismissed || ratings.length === 0) return null;

  const hasRed = ratings.some((r) => r.qualityRating.toUpperCase() === 'RED');
  const tone = hasRed ? 'red' : 'amber';

  const styles = {
    red: {
      border: 'border-red-200/80 dark:border-red-800/40',
      bg: 'bg-red-50/95 dark:bg-red-900/20',
      icon: 'text-red-700 dark:text-red-400',
      title: 'text-red-900 dark:text-red-200',
      body: 'text-red-800/90 dark:text-red-300/90',
    },
    amber: {
      border: 'border-amber-200/80 dark:border-amber-800/40',
      bg: 'bg-amber-50/95 dark:bg-amber-900/20',
      icon: 'text-amber-700 dark:text-amber-400',
      title: 'text-amber-900 dark:text-amber-200',
      body: 'text-amber-800/90 dark:text-amber-300/90',
    },
  }[tone];

  return (
    <div className={`flex items-start gap-3 border-b px-4 py-3 sm:px-6 ${styles.border} ${styles.bg}`}>
      <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${styles.icon}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-[13px] font-bold ${styles.title}`}>
          WhatsApp quality rating {hasRed ? 'critical' : 'warning'}
        </p>
        <p className={`mt-0.5 text-[12px] font-medium ${styles.body}`}>
          {ratings.map((r) => `${r.phoneNumber} (${r.qualityRating})`).join(' · ')}.
          {hasRed
            ? ' Message throughput is restricted by Meta. Review template hygiene and opt-in consent in WhatsApp Manager.'
            : ' Monitor template quality and response feedback in WhatsApp Manager to avoid deliverability restrictions.'}
          {' '}
          <a
            href="https://business.facebook.com/wa/manage/phone-numbers/"
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold underline underline-offset-2 hover:opacity-80"
          >
            Open WhatsApp Manager
          </a>
          {' · '}
          <Link to="/billing" className="font-semibold underline underline-offset-2 opacity-80 hover:opacity-100">
            View usage
          </Link>
        </p>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 rounded-lg p-1 text-theme-muted transition hover:bg-black/5 dark:hover:bg-white/10"
        aria-label="Dismiss quality rating alert"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

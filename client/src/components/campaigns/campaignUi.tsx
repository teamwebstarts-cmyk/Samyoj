import type { LucideIcon } from 'lucide-react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  Loader2,
  Pause,
  Send,
  XCircle,
} from 'lucide-react';
import { messagingConsent } from '../../utils/plainLanguage';

export function campaignProgress(sent: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((sent / total) * 100));
}

export function formatCampaignDate(iso?: string) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

export const statusMeta: Record<
  string,
  {
    label: string;
    icon: LucideIcon;
    badge: string;
    bar: string;
    pulse?: boolean;
  }
> = {
  DRAFT: {
    label: 'Draft',
    icon: Clock,
    badge: 'bg-neutral-100 text-neutral-700 ring-neutral-200/70 dark:bg-slate-800 dark:text-slate-300',
    bar: 'from-neutral-400 to-neutral-500',
  },
  SCHEDULED: {
    label: 'Scheduled',
    icon: Calendar,
    badge: 'bg-amber-50 text-amber-800 ring-amber-200/70 dark:bg-amber-900/40 dark:text-amber-300',
    bar: 'from-amber-400 to-orange-500',
  },
  RUNNING: {
    label: 'Running',
    icon: Loader2,
    badge: 'bg-sky-50 text-sky-800 ring-sky-200/70 dark:bg-sky-900/40 dark:text-sky-300',
    bar: 'from-sky-400 to-blue-600',
    pulse: true,
  },
  PAUSED: {
    label: 'Paused',
    icon: Pause,
    badge: 'bg-neutral-100 text-neutral-600 ring-neutral-200/70 dark:bg-slate-800 dark:text-slate-400',
    bar: 'from-neutral-400 to-neutral-500',
  },
  COMPLETED: {
    label: 'Completed',
    icon: CheckCircle2,
    badge: 'bg-emerald-50 text-emerald-800 ring-emerald-200/70 dark:bg-emerald-900/40 dark:text-emerald-300',
    bar: 'from-emerald-400 to-whatsapp-600',
  },
  FAILED: {
    label: 'Failed',
    icon: XCircle,
    badge: 'bg-red-50 text-red-700 ring-red-200/70 dark:bg-red-900/40 dark:text-red-300',
    bar: 'from-red-400 to-rose-600',
  },
  CANCELLED: {
    label: 'Cancelled',
    icon: XCircle,
    badge: 'bg-neutral-100 text-neutral-500 ring-neutral-200/70 dark:bg-slate-800 dark:text-slate-400',
    bar: 'from-neutral-300 to-neutral-400',
  },
};

export function getStatusMeta(status: string) {
  return (
    statusMeta[status] ?? {
      label: status,
      icon: Send,
      badge: 'bg-neutral-100 text-neutral-600 ring-neutral-200/70 dark:bg-slate-800 dark:text-slate-300',
      bar: 'from-violet-400 to-purple-600',
    }
  );
}

export const audienceLabels: Record<string, string> = {
  MANUAL: 'Manual list',
  TAGS: 'By tags',
  CONTACTS: 'Selected contacts',
  ALL_OPTED_IN: messagingConsent.allAudienceLabel,
};

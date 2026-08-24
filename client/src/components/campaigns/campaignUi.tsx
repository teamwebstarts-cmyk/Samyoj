import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  FileText,
  Gift,
  Loader2,
  Megaphone,
  Pause,
  Play,
  Send,
  Tag,
  XCircle,
} from 'lucide-react';
import type { Campaign } from '../../types';
import { messagingConsent } from '../../utils/plainLanguage';

export function campaignProgress(sent: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((sent / total) * 100));
}

export function formatCampaignDate(iso?: string, timezone?: string) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      ...(timezone ? { timeZone: timezone, timeZoneName: 'short' } : {}),
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

export function formatCampaignTimestamp(iso?: string) {
  if (!iso) return null;
  try {
    const date = new Date(iso);
    const day = new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
    const time = new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
    return `${day} • ${time}`;
  } catch {
    return null;
  }
}

function formatRelativeFuture(iso: string) {
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return 'Due now';
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 60) return `In ${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `In ${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `In ${days} day${days === 1 ? '' : 's'}`;
}

function formatRelativePast(iso: string, prefix: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0) return prefix;
  const minutes = Math.max(1, Math.round(diffMs / 60_000));
  if (minutes < 60) return `${prefix} ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${prefix} ${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${prefix} ${days}d ago`;
}

export function getCampaignRelativeLabel(campaign: Campaign) {
  switch (campaign.status) {
    case 'DRAFT':
      return 'Not sent';
    case 'SCHEDULED':
      return campaign.scheduledAt ? formatRelativeFuture(campaign.scheduledAt) : 'Scheduled';
    case 'RUNNING':
      return campaign.createdAt ? formatRelativePast(campaign.createdAt, 'Started') : 'In progress';
    case 'PAUSED':
      return campaign.pausedAt ? formatRelativePast(campaign.pausedAt, 'Paused') : 'Paused';
    case 'COMPLETED':
      return 'Completed';
    case 'FAILED':
      return 'Failed';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return '';
  }
}

export function getCampaignProgressDisplay(campaign: Campaign) {
  if (campaign.status === 'DRAFT') {
    return { kind: 'empty' as const, percent: 0, label: '—' };
  }
  const percent = campaignProgress(campaign.sentCount, campaign.totalContacts);
  return {
    kind: 'bar' as const,
    percent,
    fraction: `${campaign.sentCount.toLocaleString()} / ${campaign.totalContacts.toLocaleString()}`,
  };
}

export const statusMeta: Record<
  string,
  {
    label: string;
    icon: LucideIcon;
    tileIcon: LucideIcon;
    tile: string;
    badge: string;
    bar: string;
    templatePill: string;
    pulse?: boolean;
  }
> = {
  DRAFT: {
    label: 'Draft',
    icon: FileText,
    tileIcon: Megaphone,
    tile: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300',
    badge: 'bg-neutral-100 text-neutral-700 ring-neutral-200/70 dark:bg-slate-800 dark:text-slate-300',
    bar: 'bg-neutral-300',
    templatePill: 'bg-sky-50 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  },
  SCHEDULED: {
    label: 'Scheduled',
    icon: Calendar,
    tileIcon: Send,
    tile: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300',
    badge: 'bg-amber-50 text-amber-800 ring-amber-200/70 dark:bg-amber-900/40 dark:text-amber-300',
    bar: 'bg-neutral-300',
    templatePill: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
  },
  RUNNING: {
    label: 'Running',
    icon: Play,
    tileIcon: Tag,
    tile: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300',
    badge: 'bg-emerald-50 text-emerald-800 ring-emerald-200/70 dark:bg-emerald-900/40 dark:text-emerald-300',
    bar: 'bg-emerald-500',
    templatePill: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
    pulse: true,
  },
  PAUSED: {
    label: 'Paused',
    icon: Pause,
    tileIcon: Pause,
    tile: 'bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-300',
    badge: 'bg-orange-50 text-orange-800 ring-orange-200/70 dark:bg-orange-900/40 dark:text-orange-300',
    bar: 'bg-orange-400',
    templatePill: 'bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
  },
  COMPLETED: {
    label: 'Completed',
    icon: CheckCircle2,
    tileIcon: Gift,
    tile: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300',
    badge: 'bg-emerald-50 text-emerald-800 ring-emerald-200/70 dark:bg-emerald-900/40 dark:text-emerald-300',
    bar: 'bg-emerald-500',
    templatePill: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  },
  FAILED: {
    label: 'Failed',
    icon: AlertTriangle,
    tileIcon: AlertTriangle,
    tile: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-300',
    badge: 'bg-red-50 text-red-700 ring-red-200/70 dark:bg-red-900/40 dark:text-red-300',
    bar: 'bg-red-500',
    templatePill: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  },
  CANCELLED: {
    label: 'Cancelled',
    icon: XCircle,
    tileIcon: XCircle,
    tile: 'bg-neutral-100 text-neutral-500 dark:bg-slate-800 dark:text-slate-400',
    badge: 'bg-neutral-100 text-neutral-500 ring-neutral-200/70 dark:bg-slate-800 dark:text-slate-400',
    bar: 'bg-neutral-300',
    templatePill: 'bg-neutral-100 text-neutral-600 dark:bg-slate-800 dark:text-slate-300',
  },
};

function sentenceCase(value: string) {
  return value
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function getStatusMeta(status: string) {
  return (
    statusMeta[status] ?? {
      label: sentenceCase(status),
      icon: Loader2,
      tileIcon: Send,
      tile: 'bg-violet-50 text-violet-600 dark:bg-violet-950/40 dark:text-violet-300',
      badge: 'bg-neutral-100 text-neutral-600 ring-neutral-200/70 dark:bg-slate-800 dark:text-slate-300',
      bar: 'bg-violet-500',
      templatePill: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
    }
  );
}

export type CampaignPrimaryAction = 'edit' | 'pause' | 'resume' | 'view' | 'retry';

export function getCampaignPrimaryAction(status: string): CampaignPrimaryAction {
  if (status === 'DRAFT' || status === 'SCHEDULED') return 'edit';
  if (status === 'RUNNING') return 'pause';
  if (status === 'PAUSED') return 'resume';
  return 'view';
}

export function getCampaignPrimaryLabel(campaign: Campaign, action: CampaignPrimaryAction) {
  if (action === 'edit') return 'Edit';
  if (action === 'pause') return 'Pause';
  if (action === 'resume') return 'Resume';
  if (campaign.status === 'COMPLETED' || campaign.status === 'FAILED') return 'View results';
  return 'View';
}

export function canRescheduleCampaign(status: string) {
  return status === 'DRAFT' || status === 'SCHEDULED' || status === 'COMPLETED';
}

export function formatCampaignRepeatLabel(campaign: Campaign) {
  if (!campaign.repeatIntervalDays) return null;
  const days = campaign.repeatIntervalDays;
  const cadence = days === 1 ? 'Repeats every day' : `Repeats every ${days} days`;
  const sent = campaign.repeatOccurrenceCount ?? 0;
  const max = campaign.repeatMaxOccurrences;
  if (max) return `${cadence} · ${sent}/${max} sent`;
  if (sent) return `${cadence} · ${sent} sent`;
  return cadence;
}

export const audienceLabels: Record<string, string> = {
  MANUAL: 'Phone numbers',
  TAGS: 'Contact tags',
  CONTACTS: 'Select contacts',
  ALL_OPTED_IN: messagingConsent.allAudienceLabel,
};

export function getAudienceLabel(audienceType: string) {
  return audienceLabels[audienceType] ?? sentenceCase(audienceType);
}

export const recipientStatusLabels: Record<string, string> = {
  PENDING: 'Pending',
  SENT: 'Sent',
  DELIVERED: 'Delivered',
  READ: 'Read',
  FAILED: 'Failed',
  QUEUED: 'Queued',
  SENDING: 'Sending',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

export function getRecipientStatusLabel(status: string) {
  return recipientStatusLabels[status] ?? sentenceCase(status);
}

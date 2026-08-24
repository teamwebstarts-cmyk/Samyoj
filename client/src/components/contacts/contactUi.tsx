import { CheckCircle2, MessageSquare, Shield, XCircle } from 'lucide-react';
import type { Contact, ContactSource } from '../../types';
import { formatContactPhone, formatContactRelativeTime, getContactSourceMeta } from '../../utils/contactUtils';
import {
  getContactConsentDisplay,
  type ContactConsentInput,
} from '../../utils/contactConsent';
import { messagingConsent, conversationStatusLabel } from '../../utils/plainLanguage';
import { ContactConsentBadgeInfo } from './ContactConsentInfoTip';

const consentBadgeStyles = {
  eligible:
    'bg-emerald-50 text-emerald-700 ring-emerald-200/70 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/50',
  stopped:
    'bg-rose-50 text-rose-700 ring-rose-200/70 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-800/50',
  not_on_list:
    'bg-amber-50 text-amber-800 ring-amber-200/70 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/50',
} as const;

export function ContactOptInBadge({
  contact,
  compact,
  table,
  showInfo = false,
}: {
  contact: ContactConsentInput | null | undefined;
  compact?: boolean;
  /** Shorter labels for fixed-width table cells. */
  table?: boolean;
  /** Show (i) tooltip explaining this contact's campaign consent status. */
  showInfo?: boolean;
}) {
  if (!contact) return null;

  const status = getContactConsentDisplay(contact);
  const label =
    status === 'eligible'
      ? table
        ? messagingConsent.badgeYesShort
        : messagingConsent.badgeYes
      : status === 'stopped'
        ? messagingConsent.badgeStopped
        : table
          ? messagingConsent.badgeNotOnListShort
          : messagingConsent.badgeNotOnList;
  const Icon = status === 'eligible' ? CheckCircle2 : status === 'stopped' ? XCircle : Shield;
  const sizeClass = table ? 'px-1.5 py-0.5 text-[8px]' : compact ? 'px-2 py-1 text-[9px]' : 'px-2.5 py-1 text-[10px]';
  const iconClass = table ? 'h-2.5 w-2.5' : compact ? 'h-2.5 w-2.5' : 'h-3 w-3';

  return (
    <span className="inline-flex max-w-full items-center gap-0.5">
      <span
        title={table ? (status === 'eligible' ? messagingConsent.badgeYes : status === 'stopped' ? messagingConsent.badgeStopped : messagingConsent.badgeNotOnList) : undefined}
        className={`inline-flex max-w-full items-center gap-0.5 rounded-md font-bold uppercase tracking-wide ring-1 ring-inset leading-none ${sizeClass} ${consentBadgeStyles[status]}`}
      >
        <Icon className={`shrink-0 ${iconClass}`} />
        <span className="truncate">{label}</span>
      </span>
      {showInfo ? <ContactConsentBadgeInfo status={status} /> : null}
    </span>
  );
}

export function ContactSourceBadge({ source }: { source?: ContactSource }) {
  const meta = getContactSourceMeta(source);
  return (
    <span
      className={`inline-flex rounded-md px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ring-1 ring-inset ${meta.bg} ${meta.tone}`}
    >
      {meta.label}
    </span>
  );
}

export function ContactTagBadge({ tag }: { tag: string }) {
  return (
    <span className="inline-flex rounded-md bg-violet-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-700 ring-1 ring-violet-100 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-800/40">
      {tag}
    </span>
  );
}

export function ContactConversationBadge({
  status,
  compact,
  table,
}: {
  status: string;
  compact?: boolean;
  /** Compact single-column table cell — icon + short label, no wrap. */
  table?: boolean;
}) {
  const tones: Record<string, string> = {
    OPEN: 'bg-emerald-50 text-emerald-700 ring-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-300',
    PENDING: 'bg-amber-50 text-amber-700 ring-amber-200/60 dark:bg-amber-950/40 dark:text-amber-300',
    CLOSED: 'bg-neutral-100 text-neutral-500 ring-neutral-200/60 dark:bg-slate-800 dark:text-slate-400',
  };
  const label = conversationStatusLabel[status] || status;
  const sizeClass = table ? 'px-1.5 py-0.5 text-[8px]' : compact ? 'px-2 py-1 text-[9px]' : 'px-2 py-0.5 text-[9px]';

  return (
    <span
      title={table ? `Inbox · ${label}` : undefined}
      className={`inline-flex max-w-full items-center gap-0.5 rounded-md font-bold uppercase tracking-wide ring-1 ring-inset leading-none ${sizeClass} ${tones[status] || tones.CLOSED}`}
    >
      <MessageSquare className="h-2.5 w-2.5 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}

export function ContactInboxStatusCell({
  status,
}: {
  status?: string | null;
}) {
  if (!status) {
    return (
      <span className="text-[11px] font-medium text-theme-muted" title="No Inbox thread yet">
        —
      </span>
    );
  }
  return <ContactConversationBadge status={status} table />;
}

export function ContactActiveIndicator({ lastActiveAt }: { lastActiveAt?: string | null }) {
  const label = formatContactRelativeTime(lastActiveAt);
  const isRecent =
    lastActiveAt && Date.now() - new Date(lastActiveAt).getTime() < 7 * 24 * 60 * 60 * 1000;

  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          isRecent
            ? 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.2)]'
            : lastActiveAt
              ? 'bg-amber-400'
              : 'bg-neutral-300 dark:bg-slate-600'
        }`}
      />
      <span className="text-[12px] font-semibold text-theme-secondary">{label}</span>
    </div>
  );
}

export function ContactRowPreview({ contact }: { contact: Contact }) {
  return (
    <div className="min-w-0">
      <p className="truncate font-semibold text-theme-fg group-hover:text-sky-700 dark:group-hover:text-sky-300">
        {contact.name || 'Unnamed contact'}
      </p>
      <p className="mt-0.5 truncate font-mono text-[11px] font-medium text-theme-muted">
        {formatContactPhone(contact.phone)}
      </p>
    </div>
  );
}

export function ContactEmptyTags() {
  return (
    <span className="inline-flex items-center gap-1 text-[12px] font-medium text-theme-muted">
      <XCircle className="h-3 w-3 opacity-50" />
      No tags
    </span>
  );
}

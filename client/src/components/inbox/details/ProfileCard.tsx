import { Copy, ExternalLink, Mail, Phone, ShieldAlert, ShieldCheck, UserPlus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import ContactAvatar from '../ContactAvatar';
import { useGlassTipProps } from '../ComposerGlassTip';
import type { Contact, Conversation } from '../../../types';

interface ProfileCardProps {
  contact: Contact;
  conversation: Conversation;
  assignedAgent?: { id: string; name: string } | null;
  onChangeAssignee: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Open',
  PENDING: 'Pending',
  CLOSED: 'Closed',
  SNOOZED: 'Snoozed',
};

function formatRelative(iso?: string | null): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const diff = Date.now() - t;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ProfileCard({
  contact,
  conversation,
  assignedAgent,
  onChangeAssignee,
}: ProfileCardProps) {
  const tipFor = useGlassTipProps();
  const optedIn = contact.optedIn !== false;
  const status = STATUS_LABEL[conversation.status] || conversation.status;
  const lastActive = formatRelative(conversation.lastMessageAt || contact.lastActiveAt);
  const [copied, setCopied] = useState(false);

  const copyPhone = async () => {
    try {
      await navigator.clipboard.writeText(contact.phone);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard may be blocked — silent */
    }
  };

  return (
    <div className="px-3.5 pb-3.5 pt-3.5">
      <div className="flex items-start gap-3">
        {/* No online/presence pip — we do not invent customer availability. */}
        <ContactAvatar name={contact.name} phone={contact.phone} size="md" shape="circle" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold tracking-tight text-theme-fg">
            {contact.name || contact.phone}
          </p>
          <button
            type="button"
            onClick={() => void copyPhone()}
            aria-label={copied ? 'Copied' : 'Copy phone'}
            {...tipFor(copied ? 'Copied' : 'Copy phone')}
            className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-[12px] font-medium text-theme-muted transition hover:text-theme-fg"
          >
            <Phone className="h-3 w-3 shrink-0" />
            <span className="truncate">{contact.phone}</span>
            <Copy className="h-3 w-3 shrink-0 opacity-60" />
          </button>
          {contact.email && (
            <p className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-[12px] font-medium text-theme-muted">
              <Mail className="h-3 w-3 shrink-0" />
              <span className="truncate">{contact.email}</span>
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        <span className="inline-flex items-center rounded-full bg-theme-subtle px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-theme-secondary ring-1 ring-theme-border/70">
          {status}
        </span>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
            optedIn
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/80 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/50'
              : 'bg-red-50 text-red-700 ring-red-200/80 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-800/50'
          }`}
          {...tipFor(optedIn ? 'Contact opted in for WhatsApp' : 'Contact opted out')}
        >
          {optedIn ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
          {optedIn ? 'Opted in' : 'Opted out'}
        </span>
        {lastActive && (
          <span className="inline-flex items-center rounded-full bg-theme-subtle/80 px-2 py-0.5 text-[10px] font-semibold text-theme-muted">
            Active {lastActive}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onChangeAssignee}
        className="mt-3 inline-flex w-full items-center justify-between gap-2 rounded-xl border border-theme-border/80 bg-white/50 px-3 py-2 text-left transition hover:bg-white/80 dark:bg-neutral-950/40 dark:hover:bg-neutral-900/60"
      >
        <span className="min-w-0">
          <span className="block text-[10px] font-bold uppercase tracking-wide text-theme-muted">
            Assigned to
          </span>
          <span className="mt-0.5 block truncate text-[13px] font-semibold text-theme-fg">
            {assignedAgent?.name || 'Unassigned'}
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-whatsapp-500/10 px-2 py-1 text-[11px] font-bold text-whatsapp-700 dark:text-whatsapp-400">
          <UserPlus className="h-3.5 w-3.5" strokeWidth={2.25} />
          {assignedAgent ? 'Change' : 'Assign'}
        </span>
      </button>

      <Link
        to={`/contacts?highlight=${encodeURIComponent(contact.id)}`}
        className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-theme-border/80 bg-white/45 px-3 py-2 text-[12.5px] font-semibold text-theme-fg transition hover:bg-white/80 dark:bg-neutral-950/35 dark:hover:bg-neutral-900/55"
      >
        View contact
        <ExternalLink className="h-3.5 w-3.5 text-theme-muted" />
      </Link>
    </div>
  );
}

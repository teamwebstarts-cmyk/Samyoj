import { Check, Loader2, PhoneIncoming, PhoneMissed, PhoneOff, PhoneOutgoing } from 'lucide-react';
import ContactAvatar from '../inbox/ContactAvatar';
import { FOCUS_RING_CLASS } from '../../hooks/inboxA11y';
import {
  CALL_RECENTS_COLOR,
  callListTitle,
  callRecentsKind,
  callRecentsLabel,
  formatCallTime,
  formatDuration,
  isActiveCallStatus,
  type CallRecentsKind,
} from './callUtils';

interface CallListItemProps {
  name?: string | null;
  phone: string;
  status: string;
  direction?: string;
  handler: string;
  durationSeconds?: number | null;
  preview?: string;
  createdAt: string;
  botName?: string | null;
  agentName?: string | null;
  selected: boolean;
  onSelect: () => void;
  onContextMenu?: (event: React.MouseEvent) => void;
  onCallBack?: () => void;
  callingBack?: boolean;
  selectable?: boolean;
  checked?: boolean;
  onToggleSelect?: () => void;
}

function RecentsGlyph({ kind, direction }: { kind: CallRecentsKind; direction?: string }) {
  const color = CALL_RECENTS_COLOR[kind];
  if (kind === 'live') {
    const Icon = direction === 'BUSINESS_INITIATED' ? PhoneOutgoing : PhoneIncoming;
    return (
      <span className="relative inline-flex items-center" title="Live">
        <Icon className={`h-3.5 w-3.5 ${color}`} strokeWidth={2.4} />
        <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        </span>
      </span>
    );
  }
  if (kind === 'failed') {
    return <PhoneOff className={`h-3.5 w-3.5 ${color}`} strokeWidth={2.4} />;
  }
  if (kind === 'missed') {
    return <PhoneMissed className={`h-3.5 w-3.5 ${color}`} strokeWidth={2.4} />;
  }
  if (kind === 'outgoing') {
    return <PhoneOutgoing className={`h-3.5 w-3.5 ${color}`} strokeWidth={2.4} />;
  }
  return <PhoneIncoming className={`h-3.5 w-3.5 ${color}`} strokeWidth={2.4} />;
}

export default function CallListItem({
  name,
  phone,
  status,
  direction,
  durationSeconds,
  createdAt,
  selected,
  onSelect,
  onContextMenu,
  onCallBack,
  callingBack,
  selectable = false,
  checked = false,
  onToggleSelect,
}: CallListItemProps) {
  const kind = callRecentsKind(direction, status);
  const active = isActiveCallStatus(status);
  const missed = kind === 'missed';
  const displayName = callListTitle(name, phone);
  const duration =
    active || (durationSeconds != null && durationSeconds > 0)
      ? formatDuration(durationSeconds ?? 0)
      : '';
  const typeLabel = callRecentsLabel(kind);
  const typeColor = CALL_RECENTS_COLOR[kind];

  return (
    <button
      type="button"
      onClick={onSelect}
      onContextMenu={onContextMenu}
      aria-current={selected ? 'true' : undefined}
      className={`group relative flex w-full items-center gap-3 px-3 py-3 text-left transition-colors sm:px-4 ${FOCUS_RING_CLASS} ${
        checked
          ? 'bg-whatsapp-500/10 dark:bg-whatsapp-400/12'
          : selected
            ? 'bg-neutral-100/90 ring-1 ring-inset ring-neutral-200/80 dark:bg-neutral-900/50 dark:ring-neutral-800'
            : active
              ? 'bg-emerald-50/50 hover:bg-emerald-50/80 dark:bg-emerald-950/15'
              : 'bg-white hover:bg-neutral-50 dark:bg-neutral-950 dark:hover:bg-neutral-900/50'
      }`}
    >
      {selected && !checked && (
        <span className="absolute bottom-0 left-0 top-0 w-[3px] bg-emerald-500" />
      )}

      {selectable && (
        <span
          role="checkbox"
          aria-checked={checked}
          aria-label="Select call"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              onToggleSelect?.();
            }
          }}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.();
          }}
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition ${FOCUS_RING_CLASS} ${
            checked
              ? 'border-whatsapp-500 bg-gradient-to-br from-whatsapp-400 to-whatsapp-600 text-white shadow-[0_1px_3px_rgba(37,211,102,0.35)]'
              : 'border-neutral-200 bg-white dark:border-neutral-500/45 dark:bg-neutral-900/50'
          }`}
        >
          {checked && <Check className="h-3 w-3" strokeWidth={3} />}
        </span>
      )}

      <ContactAvatar name={name || undefined} phone={phone} size="sm" active={active} />

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2">
          <span
            className={`truncate text-[15px] leading-snug tracking-[-0.01em] ${
              missed
                ? 'font-semibold text-[#FF3B30] dark:text-rose-400'
                : active
                  ? 'font-semibold text-neutral-900 dark:text-neutral-50'
                  : 'font-semibold text-neutral-900 dark:text-neutral-100'
            }`}
          >
            {displayName}
          </span>
          <span className="ml-auto shrink-0 text-[12px] font-medium tabular-nums text-neutral-400">
            {formatCallTime(createdAt)}
          </span>
        </p>
        <p className="mt-0.5 flex items-center justify-between gap-2">
          <span className={`inline-flex min-w-0 items-center gap-1.5 text-[12px] font-medium ${typeColor}`}>
            <RecentsGlyph kind={kind} direction={direction} />
            <span className="truncate">
              {typeLabel}
              {duration ? <span className="text-neutral-400"> · {duration}</span> : null}
            </span>
          </span>
          {onCallBack && !active && !selectable ? (
            <span
              aria-label={callingBack ? 'Calling…' : 'Call back'}
              onClick={(e) => {
                e.stopPropagation();
                if (!callingBack) onCallBack();
              }}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-neutral-400 transition hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-emerald-950/40"
              title={callingBack ? 'Calling…' : 'Call back'}
            >
              {callingBack ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-600" strokeWidth={2.5} />
              ) : (
                <PhoneOutgoing className="h-3.5 w-3.5" strokeWidth={2.25} />
              )}
            </span>
          ) : null}
        </p>
      </div>
    </button>
  );
}

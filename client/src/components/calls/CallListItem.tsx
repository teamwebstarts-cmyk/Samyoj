import { Loader2, PhoneIncoming, PhoneMissed, PhoneOff, PhoneOutgoing } from 'lucide-react';
import ContactAvatar from '../inbox/ContactAvatar';
import {
  callListTitle,
  formatCallTime,
  formatDuration,
  isActiveCallStatus,
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
}

function CallTypeGlyph({
  direction,
  status,
}: {
  direction?: string;
  status: string;
}) {
  const missed = status === 'MISSED' || status === 'REJECTED';
  const outbound = direction === 'BUSINESS_INITIATED';
  const live = isActiveCallStatus(status);

  const DirectionIcon = outbound ? PhoneOutgoing : PhoneIncoming;
  const directionClass = outbound ? 'text-emerald-600' : 'text-sky-600';

  if (live) {
    return (
      <span className="relative inline-flex items-center" title={outbound ? 'Outgoing' : 'Incoming'}>
        <DirectionIcon className={`h-3.5 w-3.5 ${directionClass}`} strokeWidth={2.25} />
        <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
        </span>
      </span>
    );
  }
  if (status === 'FAILED') {
    return <PhoneOff className="h-3.5 w-3.5 text-amber-500" strokeWidth={2.25} />;
  }
  if (missed) {
    return <PhoneMissed className="h-3.5 w-3.5 text-rose-500" strokeWidth={2.25} />;
  }
  return <DirectionIcon className={`h-3.5 w-3.5 ${directionClass}`} strokeWidth={2.25} />;
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
}: CallListItemProps) {
  const active = isActiveCallStatus(status);
  const missed = status === 'MISSED' || status === 'REJECTED';
  const displayName = callListTitle(name, phone);
  const duration =
    active || (durationSeconds != null && durationSeconds > 0)
      ? formatDuration(durationSeconds ?? 0)
      : '';

  return (
    <button
      type="button"
      onClick={onSelect}
      onContextMenu={onContextMenu}
      className={`group relative flex w-full items-center gap-2.5 px-3 py-3.5 text-left transition-colors sm:px-4 ${
        selected
          ? 'bg-emerald-50/90 ring-1 ring-inset ring-emerald-200/70 dark:bg-emerald-950/30 dark:ring-emerald-900/60'
          : active
            ? 'bg-emerald-50/40 hover:bg-emerald-50/70 dark:bg-emerald-950/10'
            : 'bg-white hover:bg-neutral-100 dark:bg-neutral-950 dark:hover:bg-neutral-900/60'
      }`}
    >
      {selected && (
        <span className="absolute bottom-0 left-0 top-0 w-[3px] bg-emerald-500" />
      )}

      <ContactAvatar name={name || undefined} phone={phone} size="sm" active={active} />

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2">
          <span
            className={`truncate text-[14px] leading-snug tracking-tight ${
              missed
                ? 'font-extrabold text-rose-600 dark:text-rose-400'
                : active
                  ? 'font-extrabold text-neutral-900 dark:text-neutral-50'
                  : 'font-extrabold text-neutral-900 dark:text-neutral-100'
            }`}
          >
            {displayName}
          </span>
          <span className="ml-auto shrink-0 text-[11px] font-semibold tabular-nums text-neutral-500">
            {formatCallTime(createdAt)}
          </span>
        </p>
        <p className="mt-0.5 flex items-baseline justify-between gap-2">
          <span className="truncate text-[12px] font-medium text-neutral-500">
            {duration}
          </span>
          <span
            className={`inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold tabular-nums ${
              active ? 'text-emerald-600' : 'text-neutral-500'
            }`}
          >
            <CallTypeGlyph direction={direction} status={status} />
            {onCallBack && !active ? (
              <button
                type="button"
                aria-label={callingBack ? 'Calling…' : 'Call back'}
                disabled={callingBack}
                onClick={(e) => {
                  e.stopPropagation();
                  onCallBack();
                }}
                className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-md text-neutral-500 transition hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-70 dark:hover:bg-emerald-950/40"
                title={callingBack ? 'Calling…' : 'Call back'}
              >
                {callingBack ? (
                  <Loader2 className="h-3 w-3 animate-spin text-emerald-600" strokeWidth={2.5} />
                ) : (
                  <PhoneOutgoing className="h-3 w-3" strokeWidth={2.25} />
                )}
              </button>
            ) : null}
          </span>
        </p>
      </div>
    </button>
  );
}

import { Phone, PhoneOutgoing } from 'lucide-react';
import ContactAvatar from '../inbox/ContactAvatar';
import {
  callStatusLabel,
  callStatusTone,
  formatCallTime,
  formatDuration,
  formatPhoneDisplay,
  isActiveCallStatus,
} from './callUtils';

interface CallListItemProps {
  name?: string | null;
  phone: string;
  status: string;
  handler: string;
  durationSeconds?: number | null;
  preview?: string;
  createdAt: string;
  botName?: string | null;
  agentName?: string | null;
  selected: boolean;
  onSelect: () => void;
  onCallBack?: () => void;
  callingBack?: boolean;
}

function StatusBadge({ status }: { status: string }) {
  const tone = callStatusTone(status);
  const label = callStatusLabel(status);

  const classes =
    tone === 'live'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/80'
      : tone === 'missed'
        ? 'bg-rose-50 text-rose-700 ring-rose-200/80'
        : tone === 'completed'
          ? 'bg-sky-50 text-sky-700 ring-sky-200/80'
          : tone === 'failed'
            ? 'bg-amber-50 text-amber-700 ring-amber-200/80'
            : 'bg-neutral-100 text-neutral-600 ring-neutral-200';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${classes}`}
    >
      {tone === 'live' && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
        </span>
      )}
      {label}
    </span>
  );
}

function WaveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 12" fill="currentColor" aria-hidden>
      <rect x="0" y="4" width="2" height="4" rx="1" />
      <rect x="3.5" y="2" width="2" height="8" rx="1" />
      <rect x="7" y="0" width="2" height="12" rx="1" />
      <rect x="10.5" y="2" width="2" height="8" rx="1" />
      <rect x="14" y="4" width="2" height="4" rx="1" />
    </svg>
  );
}

export default function CallListItem({
  name,
  phone,
  status,
  durationSeconds,
  createdAt,
  selected,
  onSelect,
  onCallBack,
  callingBack,
}: CallListItemProps) {
  const active = isActiveCallStatus(status);
  const displayName = name || formatPhoneDisplay(phone);
  const duration = formatDuration(durationSeconds ?? (active ? 0 : 0));

  return (
    <button
      type="button"
      onClick={onSelect}
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
              active ? 'font-extrabold text-neutral-900 dark:text-neutral-50' : 'font-extrabold text-neutral-900 dark:text-neutral-100'
            }`}
          >
            {displayName}
          </span>
          <StatusBadge status={status} />
          <span className="ml-auto shrink-0 text-[11px] font-semibold tabular-nums text-neutral-500">
            {formatCallTime(createdAt)}
          </span>
        </p>
        <p className="mt-0.5 flex items-baseline justify-between gap-2">
          <span className="truncate text-[12px] font-medium text-neutral-500">
            {formatPhoneDisplay(phone)}
          </span>
          <span
            className={`inline-flex shrink-0 items-center gap-1 text-[11px] font-semibold tabular-nums ${
              active ? 'text-emerald-600' : 'text-neutral-500'
            }`}
          >
            {duration}
            {active ? (
              <WaveIcon className="h-3 w-3 text-emerald-500" />
            ) : onCallBack ? (
              <button
                type="button"
                aria-label="Call back"
                disabled={callingBack}
                onClick={(e) => {
                  e.stopPropagation();
                  onCallBack();
                }}
                className="ml-0.5 inline-flex h-5 w-5 items-center justify-center rounded-md text-neutral-500 transition hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-50 dark:hover:bg-emerald-950/40"
                title="Call back"
              >
                <PhoneOutgoing className="h-3 w-3" strokeWidth={2.25} />
              </button>
            ) : (
              <Phone className="h-3 w-3 text-neutral-600 dark:text-neutral-400" strokeWidth={2.25} />
            )}
          </span>
        </p>
      </div>
    </button>
  );
}

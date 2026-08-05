import { Phone } from 'lucide-react';
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
            ? 'bg-neutral-100 text-neutral-600 ring-neutral-200'
            : 'bg-neutral-100 text-neutral-600 ring-neutral-200';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${classes}`}
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
  handler,
  durationSeconds,
  preview,
  botName,
  agentName,
  createdAt,
  selected,
  onSelect,
}: CallListItemProps) {
  const active = isActiveCallStatus(status);
  const displayName = name || formatPhoneDisplay(phone);
  const duration = formatDuration(durationSeconds ?? (active ? 0 : 0));
  const previewText = preview && preview !== 'No conversation yet' ? preview : null;
  const handlerLabel =
    handler === 'AI' ? (botName ? `AI · ${botName}` : 'AI') : handler === 'AGENT' ? 'Agent' : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative flex w-full items-center gap-3 px-3 py-3 text-left transition-colors sm:px-4 ${
        selected
          ? 'bg-emerald-50/80 dark:bg-emerald-950/25'
          : active
            ? 'bg-emerald-50/40 hover:bg-emerald-50/60 dark:bg-emerald-950/10'
            : 'bg-white hover:bg-neutral-50 dark:bg-neutral-950 dark:hover:bg-neutral-900/60'
      }`}
    >
      {selected && (
        <span className="absolute bottom-0 left-0 top-0 w-[3px] bg-emerald-500" />
      )}

      <ContactAvatar name={name || undefined} phone={phone} size="sm" active={active} />

      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-[13px] ${
            active ? 'font-extrabold text-neutral-900 dark:text-neutral-100' : 'font-bold text-neutral-800 dark:text-neutral-200'
          }`}
        >
          {displayName}
        </p>
        <p className="mt-0.5 truncate text-[12px] font-medium text-neutral-500">
          {formatPhoneDisplay(phone)}
        </p>
        {previewText && (
          <p className="mt-0.5 hidden truncate text-[11px] font-medium text-neutral-400 sm:block">
            {previewText}
          </p>
        )}
      </div>

      <div className="hidden shrink-0 sm:block">
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={status} />
          {handlerLabel && <span className="text-[10px] font-bold text-neutral-400">{handlerLabel}</span>}
        </div>
      </div>

      <div className="flex w-[72px] shrink-0 flex-col items-end gap-0.5 sm:w-[80px]">
        <span className="text-[11px] font-semibold tabular-nums text-neutral-500">
          {formatCallTime(createdAt)}
        </span>
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-semibold tabular-nums ${
            active ? 'text-emerald-600' : 'text-neutral-400'
          }`}
        >
          {duration}
          {active ? (
            <WaveIcon className="h-3 w-3 text-emerald-500" />
          ) : (
            <Phone className="h-3 w-3 text-neutral-300" strokeWidth={2} />
          )}
        </span>
        <span className="sm:hidden">
          <StatusBadge status={status} />
        </span>
      </div>
    </button>
  );
}

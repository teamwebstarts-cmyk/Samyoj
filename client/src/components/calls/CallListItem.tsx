import { Bot, PhoneCall, User } from 'lucide-react';
import ContactAvatar from '../inbox/ContactAvatar';
import { callStatusLabel, formatCallTime, formatDuration, isActiveCallStatus } from './callUtils';

interface CallListItemProps {
  name?: string | null;
  phone: string;
  status: string;
  handler: string;
  durationSeconds?: number | null;
  preview: string;
  createdAt: string;
  botName?: string | null;
  agentName?: string | null;
  selected: boolean;
  onSelect: () => void;
}

export default function CallListItem({
  name,
  phone,
  status,
  handler,
  durationSeconds,
  preview,
  createdAt,
  botName,
  agentName,
  selected,
  onSelect,
}: CallListItemProps) {
  const active = isActiveCallStatus(status);
  const displayName = name || phone;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`group relative flex w-full items-center gap-3 px-4 py-3.5 text-left transition-all ${
        selected
          ? 'bg-gradient-to-r from-violet-50/95 to-emerald-50/30'
          : 'hover:bg-neutral-50/90'
      }`}
    >
      {selected && (
        <span className="absolute bottom-2 left-0 top-2 w-1 rounded-r-full bg-gradient-to-b from-violet-500 to-whatsapp-500" />
      )}

      <div className="relative shrink-0">
        <ContactAvatar name={name || undefined} phone={phone} size="sm" active={active} />
        {active && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-sm ring-2 ring-white">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className={`truncate text-[13px] ${active ? 'font-extrabold text-neutral-900' : 'font-bold text-neutral-800'}`}>
            {displayName}
          </span>
          <span className={`shrink-0 text-[10px] font-semibold tabular-nums ${active ? 'text-violet-600' : 'text-neutral-400'}`}>
            {formatCallTime(createdAt)}
          </span>
        </div>
        <p className="mt-0.5 truncate text-[12px] font-medium text-neutral-500">{preview}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {active ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200/80">
              <PhoneCall className="h-3 w-3" />
              {callStatusLabel(status)}
            </span>
          ) : (
            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-600">
              {callStatusLabel(status)}
            </span>
          )}
          {handler === 'AI' && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-100">
              <Bot className="h-2.5 w-2.5" />
              AI
            </span>
          )}
          {handler === 'AGENT' && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700 ring-1 ring-sky-100">
              <User className="h-2.5 w-2.5" />
              {agentName?.split(' ')[0] || 'Agent'}
            </span>
          )}
          {durationSeconds != null && durationSeconds > 0 && (
            <span className="text-[10px] font-medium text-neutral-400">{formatDuration(durationSeconds)}</span>
          )}
          {botName && !active && (
            <span className="hidden max-w-[72px] truncate text-[10px] text-neutral-400 sm:inline">{botName}</span>
          )}
        </div>
      </div>
    </button>
  );
}

import { ArrowLeft, Bot, MessageSquare, PhoneOff, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import ContactAvatar from '../inbox/ContactAvatar';
import AppButton from '../ui/AppButton';
import { callStatusLabel, formatCallTime, formatDuration, isActiveCallStatus } from './callUtils';

interface TranscriptEntry {
  role: string;
  text: string;
  at: string;
}

interface CallDetailViewProps {
  name?: string | null;
  phone: string;
  status: string;
  createdAt: string;
  durationSeconds?: number | null;
  botName?: string | null;
  agentName?: string | null;
  conversationId?: string | null;
  transcript?: TranscriptEntry[] | null;
  onBack?: () => void;
  onEndCall?: () => void;
  ending?: boolean;
}

function roleLabel(role: string): string {
  if (role === 'user') return 'Customer';
  if (role === 'assistant') return 'Assistant';
  return 'Greeting';
}

export default function CallDetailView({
  name,
  phone,
  status,
  createdAt,
  durationSeconds,
  botName,
  agentName,
  conversationId,
  transcript,
  onBack,
  onEndCall,
  ending,
}: CallDetailViewProps) {
  const active = isActiveCallStatus(status);
  const displayName = name || phone;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="calls-detail-header flex shrink-0 items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-950">
        {onBack && (
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200/80 bg-white text-neutral-700 shadow-input transition hover:border-violet-300/50 hover:bg-violet-50 md:hidden dark:border-neutral-700 dark:bg-neutral-900"
            onClick={onBack}
            aria-label="Back to calls"
          >
            <ArrowLeft size={18} strokeWidth={2.25} />
          </button>
        )}

        <ContactAvatar name={name || undefined} phone={phone} size="lg" active={active} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold tracking-tight text-theme-fg">{displayName}</p>
          <p className="truncate text-[12px] font-medium text-theme-muted">
            {formatCallTime(createdAt)}
            {durationSeconds != null && durationSeconds > 0 && (
              <span> · {formatDuration(durationSeconds)}</span>
            )}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {active && (
            <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200/80 sm:inline-flex">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              {callStatusLabel(status)}
            </span>
          )}
          {active && onEndCall && (
            <AppButton variant="danger" size="sm" loading={ending} onClick={onEndCall}>
              <PhoneOff className="h-4 w-4" />
              End
            </AppButton>
          )}
        </div>
      </div>

      {(botName || agentName || conversationId || !active) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-neutral-200 bg-white px-4 py-2 dark:border-neutral-800 dark:bg-neutral-950">
          {!active && (
            <span className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-600">
              {callStatusLabel(status)}
            </span>
          )}
          {botName && (
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-0.5 text-[10px] font-bold text-violet-700 ring-1 ring-violet-100">
              <Bot className="h-3 w-3" />
              {botName}
            </span>
          )}
          {agentName && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-[10px] font-bold text-sky-700 ring-1 ring-sky-100">
              <User className="h-3 w-3" />
              {agentName}
            </span>
          )}
          {conversationId && (
            <Link
              to={`/inbox?conversation=${conversationId}`}
              className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-100 hover:bg-emerald-100"
            >
              <MessageSquare className="h-3 w-3" />
              Open in inbox
            </Link>
          )}
        </div>
      )}

      <div className="inbox-chat-bg min-h-0 flex-1 overflow-y-auto">
        {!transcript?.length ? (
          <div className="flex h-full min-h-[200px] items-center justify-center p-8">
            <div className="rounded-2xl border border-white/60 bg-white/70 px-5 py-4 text-center shadow-sm backdrop-blur-sm">
              <p className="text-[13px] font-semibold text-neutral-700">
                {active ? 'Conversation will appear here' : 'No conversation recorded'}
              </p>
              <p className="mt-1 text-[12px] text-neutral-500">
                {active
                  ? 'Speak after the greeting — your words and AI replies show up live.'
                  : 'Transcript appears once the call starts and someone speaks.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="px-4 py-4 sm:px-6 sm:py-5">
            <div className="mx-auto max-w-2xl space-y-3">
              {transcript.map((entry, idx) => {
                const isCustomer = entry.role === 'user';
                const isAssistant = entry.role === 'assistant';
                const isSystem = entry.role === 'system';

                return (
                  <div
                    key={`${entry.at}-${idx}`}
                    className={`flex animate-fade-up ${isCustomer ? 'justify-start' : 'justify-end'}`}
                    style={{ animationDelay: `${Math.min(idx * 40, 200)}ms` }}
                  >
                    <div
                      className={`max-w-[min(100%,320px)] rounded-2xl px-3.5 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.06)] ${
                        isCustomer
                          ? 'rounded-tl-md bg-white/95 ring-1 ring-black/[0.04]'
                          : isAssistant
                            ? 'rounded-tr-md bg-gradient-to-br from-whatsapp-600 to-whatsapp-700 text-white shadow-[0_2px_12px_rgba(37,211,102,0.25)]'
                            : isSystem
                              ? 'rounded-tr-md bg-violet-500/90 text-white shadow-[0_2px_12px_rgba(139,92,246,0.2)]'
                              : 'rounded-tr-md bg-neutral-500/90 text-white'
                      }`}
                    >
                      <p
                        className={`mb-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          isCustomer ? 'text-neutral-400' : 'text-white/70'
                        }`}
                      >
                        {roleLabel(entry.role)}
                      </p>
                      <p
                        className={`text-[13px] leading-[1.45] ${
                          isCustomer ? 'font-medium text-neutral-800' : 'font-medium text-white'
                        }`}
                      >
                        {entry.text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState, type ComponentType } from 'react';
import {
  ArrowLeft,
  Bot,
  CheckCheck,
  Clock3,
  Grid3X3,
  MessageSquare,
  MicOff,
  MoreVertical,
  Pause,
  PhoneForwarded,
  PhoneIncoming,
  PhoneOff,
  PhoneOutgoing,
  Timer,
  User,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import ContactAvatar from '../inbox/ContactAvatar';
import AppButton from '../ui/AppButton';
import {
  callStatusLabel,
  callStatusTone,
  formatBubbleTime,
  formatCallTime,
  formatDuration,
  formatPhoneDisplay,
  isActiveCallStatus,
} from './callUtils';

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
  direction?: string;
  handler?: string;
  botName?: string | null;
  agentName?: string | null;
  conversationId?: string | null;
  transcript?: TranscriptEntry[] | null;
  notes?: string;
  onNotesChange?: (value: string) => void;
  onSaveNotes?: () => void;
  savingNotes?: boolean;
  notesDirty?: boolean;
  onBack?: () => void;
  onEndCall?: () => void;
  ending?: boolean;
}

function Waveform() {
  return (
    <div className="flex h-4 items-end gap-0.5" aria-hidden>
      {[3, 6, 4, 8, 5, 7, 3, 6].map((h, i) => (
        <span
          key={i}
          className="w-0.5 animate-pulse rounded-full bg-emerald-500"
          style={{ height: `${h * 2}px`, animationDelay: `${i * 80}ms` }}
        />
      ))}
    </div>
  );
}

function isAssistantRole(role: string) {
  return role === 'assistant' || role === 'system' || role === 'bot';
}

export default function CallDetailView({
  name,
  phone,
  status,
  createdAt,
  durationSeconds,
  direction = 'USER_INITIATED',
  handler,
  botName,
  agentName,
  conversationId,
  transcript,
  notes = '',
  onNotesChange,
  onSaveNotes,
  savingNotes,
  notesDirty,
  onBack,
  onEndCall,
  ending,
}: CallDetailViewProps) {
  const active = isActiveCallStatus(status);
  const displayName = name || formatPhoneDisplay(phone);
  const tone = callStatusTone(status);
  const scrollRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const [liveElapsed, setLiveElapsed] = useState(durationSeconds ?? 0);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (!active) {
      setLiveElapsed(durationSeconds ?? 0);
      return;
    }
    const started = new Date(createdAt).getTime();
    const tick = () => setLiveElapsed(Math.max(0, Math.floor((Date.now() - started) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active, createdAt, durationSeconds]);

  useEffect(() => {
    if (!active || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [transcript?.length, active]);

  useEffect(() => {
    if (!moreOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  const inbound = direction !== 'BUSINESS_INITIATED';
  const handlerLabel =
    handler === 'AGENT' || agentName
      ? `Handler ${agentName || 'Agent'}`
      : handler === 'AI' || botName
        ? `Handler AI (${botName || 'Samyoj AI'})`
        : null;

  const lastEntry = transcript?.length ? transcript[transcript.length - 1] : null;
  const aiLikelySpeaking =
    status === 'CONNECTED' &&
    handler !== 'AGENT' &&
    Boolean(
      lastEntry &&
        isAssistantRole(lastEntry.role) &&
        Date.now() - new Date(lastEntry.at).getTime() < 8000
    );

  const statusPillClass =
    tone === 'live'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/80'
      : tone === 'missed'
        ? 'bg-rose-50 text-rose-700 ring-rose-200/80'
        : tone === 'completed'
          ? 'bg-sky-50 text-sky-700 ring-sky-200/80'
          : 'bg-neutral-100 text-neutral-600 ring-neutral-200';

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-2.5 border-b border-neutral-200 bg-white px-3 py-3 sm:gap-3 sm:px-4 dark:border-neutral-800 dark:bg-neutral-950">
        {onBack && (
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200 text-neutral-700 md:hidden dark:border-neutral-700"
            onClick={onBack}
            aria-label="Back to calls"
          >
            <ArrowLeft size={18} strokeWidth={2.25} />
          </button>
        )}

        <ContactAvatar name={name || undefined} phone={phone} size="lg" active={active} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-[15px] font-bold tracking-tight text-theme-fg">{displayName}</p>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${statusPillClass}`}
            >
              {active && (
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
              )}
              {callStatusLabel(status)}
              {active && (
                <span className="font-semibold tabular-nums normal-case tracking-normal">
                  · {formatDuration(liveElapsed)}
                </span>
              )}
            </span>
          </div>
          <p className="truncate text-[12px] font-medium text-theme-muted">{formatPhoneDisplay(phone)}</p>
        </div>

        <div className="relative flex shrink-0 items-center gap-1.5 sm:gap-2" ref={moreRef}>
          {conversationId ? (
            <Link to={`/inbox?conversation=${conversationId}`}>
              <AppButton variant="primary" size="sm">
                <MessageSquare className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Open chat</span>
              </AppButton>
            </Link>
          ) : (
            <AppButton variant="secondary" size="sm" disabled title="No linked chat yet">
              <MessageSquare className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Open chat</span>
            </AppButton>
          )}

          {active && onEndCall && (
            <AppButton
              variant="danger"
              size="sm"
              loading={ending}
              onClick={onEndCall}
              className="hidden sm:inline-flex"
            >
              <PhoneOff className="h-3.5 w-3.5" />
              End call
            </AppButton>
          )}

          <button
            type="button"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-200 text-neutral-500 hover:bg-neutral-50 dark:border-neutral-700"
            aria-label="More"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((v) => !v)}
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {moreOpen && (
            <div className="absolute right-0 top-11 z-20 w-44 rounded-xl border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-[12px] font-semibold text-neutral-700 hover:bg-neutral-50 dark:text-neutral-200"
                onClick={() => {
                  void navigator.clipboard?.writeText(phone);
                  setMoreOpen(false);
                }}
              >
                Copy number
              </button>
              {conversationId && (
                <Link
                  to={`/inbox?conversation=${conversationId}`}
                  className="block px-3 py-2 text-[12px] font-semibold text-neutral-700 hover:bg-neutral-50 dark:text-neutral-200"
                  onClick={() => setMoreOpen(false)}
                >
                  Open chat
                </Link>
              )}
              {onNotesChange && (
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-[12px] font-semibold text-neutral-700 hover:bg-neutral-50 dark:text-neutral-200"
                  onClick={() => {
                    setMoreOpen(false);
                    document.getElementById('call-notes')?.focus();
                  }}
                >
                  Focus notes
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-2 gap-x-4 gap-y-2 border-b border-neutral-200 bg-white px-3 py-2.5 text-[12px] font-medium text-neutral-500 sm:flex sm:flex-wrap sm:items-center sm:px-4 dark:border-neutral-800 dark:bg-neutral-950">
        <span className="inline-flex items-center gap-1.5">
          {inbound ? (
            <PhoneIncoming className="h-3.5 w-3.5 text-neutral-700 dark:text-neutral-300" strokeWidth={2.25} />
          ) : (
            <PhoneOutgoing className="h-3.5 w-3.5 text-neutral-700 dark:text-neutral-300" strokeWidth={2.25} />
          )}
          <span>
            <span className="font-bold text-neutral-900 dark:text-neutral-100">Type</span>
            <span className="text-neutral-300 dark:text-neutral-600">:</span>
            <span className="font-semibold text-neutral-700 dark:text-neutral-200">
              {inbound ? 'Inbound call' : 'Outbound call'}
            </span>
          </span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock3 className="h-3.5 w-3.5 text-neutral-700 dark:text-neutral-300" strokeWidth={2.25} />
          <span>
            <span className="font-bold text-neutral-900 dark:text-neutral-100">Started</span>
            <span className="text-neutral-300 dark:text-neutral-600">:</span>
            <span className="font-semibold text-neutral-700 dark:text-neutral-200">
              {formatCallTime(createdAt)}
            </span>
          </span>
        </span>
        {handlerLabel && (
          <span className="inline-flex items-center gap-1.5">
            {agentName || handler === 'AGENT' ? (
              <User className="h-3.5 w-3.5 text-neutral-700 dark:text-neutral-300" strokeWidth={2.25} />
            ) : (
              <Bot className="h-3.5 w-3.5 text-neutral-700 dark:text-neutral-300" strokeWidth={2.25} />
            )}
            <span>
              <span className="font-bold text-neutral-900 dark:text-neutral-100">Handler</span>
              <span className="text-neutral-300 dark:text-neutral-600">:</span>
              <span className="font-semibold text-neutral-700 dark:text-neutral-200">{handlerLabel}</span>
            </span>
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <Timer className="h-3.5 w-3.5 text-neutral-700 dark:text-neutral-300" strokeWidth={2.25} />
          <span>
            <span className="font-bold text-neutral-900 dark:text-neutral-100">Duration</span>
            <span className="text-neutral-300 dark:text-neutral-600">:</span>
            <span className="font-semibold text-neutral-700 dark:text-neutral-200">
              {formatDuration(active ? liveElapsed : durationSeconds)}
            </span>
          </span>
        </span>
      </div>

      {aiLikelySpeaking && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-emerald-100 bg-emerald-50/80 px-3 py-2 sm:px-4 dark:border-emerald-900/40 dark:bg-emerald-950/30">
          <span className="inline-flex items-center gap-2 text-[12px] font-bold text-emerald-700 dark:text-emerald-300">
            <Bot className="h-4 w-4" />
            AI is speaking…
          </span>
          <Waveform />
        </div>
      )}
      {status === 'CONNECTED' && handler !== 'AGENT' && !aiLikelySpeaking && (
        <div className="flex shrink-0 items-center gap-2 border-b border-neutral-100 bg-neutral-50/80 px-3 py-1.5 text-[11px] font-semibold text-neutral-500 sm:px-4 dark:border-neutral-800 dark:bg-neutral-900/40">
          <Bot className="h-3.5 w-3.5" />
          AI on this call · listening
        </div>
      )}

      <div ref={scrollRef} className="inbox-placeholder-bg min-h-0 flex-1 overflow-y-auto">
        {!transcript?.length ? (
          <div className="flex h-full min-h-[140px] items-center justify-center p-6 sm:p-8">
            <div className="rounded-2xl border border-white/60 bg-white/80 px-5 py-4 text-center shadow-sm">
              <p className="text-[13px] font-semibold text-neutral-700">
                {active
                  ? 'Listening…'
                  : tone === 'missed'
                    ? 'This call wasn’t answered'
                    : 'No speech on this call yet'}
              </p>
              <p className="mt-1 text-[12px] text-neutral-500">
                {active
                  ? 'Conversation appears here as you and the AI talk.'
                  : tone === 'missed'
                    ? 'Customer didn’t connect — notes still help your team.'
                    : 'Transcript appears once someone speaks.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="px-3 py-4 sm:px-5">
            <div className="mx-auto max-w-2xl space-y-3">
              {transcript.map((entry, idx) => {
                const isCustomer = entry.role === 'user';
                return (
                  <div
                    key={`${entry.at}-${idx}`}
                    className={`flex animate-fade-up items-end gap-2 ${
                      isCustomer ? 'justify-end' : 'justify-start'
                    }`}
                  >
                    {!isCustomer && (
                      <span className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <Bot className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <div
                      className={`max-w-[min(100%,85vw)] rounded-2xl px-3.5 py-2.5 shadow-sm sm:max-w-[min(100%,320px)] ${
                        isCustomer
                          ? 'rounded-br-md bg-emerald-100 text-neutral-900 dark:bg-emerald-900/40 dark:text-emerald-50'
                          : 'rounded-bl-md border border-neutral-200/80 bg-white text-neutral-800 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100'
                      }`}
                    >
                      <p className="text-[13px] font-medium leading-[1.45]">{entry.text}</p>
                      <p
                        className={`mt-1 flex items-center justify-end gap-1 text-[10px] font-medium ${
                          isCustomer ? 'text-emerald-700/70' : 'text-neutral-400'
                        }`}
                      >
                        {formatBubbleTime(entry.at)}
                        {isCustomer && <CheckCheck className="h-3 w-3 text-sky-500" />}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {active && onEndCall && (
        <div className="flex shrink-0 gap-1.5 border-t border-neutral-200 bg-white px-2 py-2 sm:hidden dark:border-neutral-800 dark:bg-neutral-950">
          <ControlBtn icon={MicOff} label="Mute" disabled tip="Available on agent softphone" />
          <ControlBtn icon={Pause} label="Hold" disabled tip="Coming soon" />
          <ControlBtn icon={Grid3X3} label="Keypad" disabled tip="Coming soon" />
          <ControlBtn icon={PhoneForwarded} label="Transfer" disabled tip="Live transfer next" />
          <button
            type="button"
            onClick={onEndCall}
            disabled={ending}
            className="flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl bg-rose-600 text-white disabled:opacity-60"
          >
            <PhoneOff className="h-4 w-4" />
            <span className="text-[10px] font-bold">End call</span>
          </button>
        </div>
      )}

      {onNotesChange && onSaveNotes && (
        <div className="shrink-0 border-t border-neutral-200 bg-white px-3 py-3 sm:px-4 dark:border-neutral-800 dark:bg-neutral-950">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-[13px] font-bold text-theme-fg">Notes</p>
            {notesDirty && (
              <span className="text-[10px] font-bold uppercase tracking-wide text-amber-600">Unsaved</span>
            )}
          </div>
          <textarea
            id="call-notes"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            rows={2}
            placeholder="Add notes about this call..."
            className="w-full resize-none rounded-xl border border-neutral-200 bg-neutral-50/80 px-3 py-2 text-[13px] font-medium text-theme-fg outline-none placeholder:text-neutral-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <div className="mt-2 flex justify-end">
            <AppButton size="sm" loading={savingNotes} disabled={!notesDirty && !savingNotes} onClick={onSaveNotes}>
              Save note
            </AppButton>
          </div>
        </div>
      )}
    </div>
  );
}

function ControlBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
  tip,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  tip?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={tip}
      aria-pressed={active}
      className={`flex min-h-[44px] flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border text-[10px] font-bold ${
        active
          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
          : 'border-neutral-200 bg-white text-neutral-600 disabled:opacity-45 dark:border-neutral-700 dark:bg-neutral-900'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

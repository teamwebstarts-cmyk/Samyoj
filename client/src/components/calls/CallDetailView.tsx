import { useEffect, useRef, useState, type ComponentType } from 'react';
import {
  ArrowLeft,
  Bot,
  CheckCheck,
  Clock3,
  Grid3X3,
  MessageSquare,
  Mic,
  MicOff,
  PanelRight,
  Pause,
  PhoneForwarded,
  PhoneIncoming,
  PhoneOff,
  PhoneOutgoing,
  Timer,
  User,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import CallSummaryNote from './CallSummaryNote';
import CallingAiPicker from './CallingAiPicker';
import ContactAvatar from '../inbox/ContactAvatar';
import AppButton from '../ui/AppButton';
import { getAgentPeerConnection } from '../../utils/agentCallRTC';
import { FOCUS_RING_CLASS } from '../../hooks/inboxA11y';
import {
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
  contactId?: string | null;
  callingAiEnabled?: boolean;
  onCallingAiChange?: (enabled: boolean) => void;
  callingAiSaving?: boolean;
  transcript?: TranscriptEntry[] | null;
  summary?: string | null;
  onBack?: () => void;
  onOpenDetails?: () => void;
  onEndCall?: () => void;
  onCallBack?: () => void;
  callingBack?: boolean;
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
  contactId,
  callingAiEnabled = true,
  onCallingAiChange,
  callingAiSaving,
  transcript,
  summary,
  onBack,
  onOpenDetails,
  onEndCall,
  onCallBack,
  callingBack,
  ending,
}: CallDetailViewProps) {
  const active = isActiveCallStatus(status);
  const displayName = name || formatPhoneDisplay(phone);
  const tone = callStatusTone(status);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [liveElapsed, setLiveElapsed] = useState(durationSeconds ?? 0);
  const [muted, setMuted] = useState(false);

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

  const inbound = direction !== 'BUSINESS_INITIATED';
  const handlerLabel =
    handler === 'AGENT' || agentName
      ? `${agentName || 'Agent'}`
      : handler === 'AI' || botName
        ? `${botName || 'Samyoj AI'}`
        : null;
  const handlerTag =
    handler === 'AI' ? 'AI Agent' : handler === 'AGENT' ? 'Human' : null;

  const lastEntry = transcript?.length ? transcript[transcript.length - 1] : null;
  const aiLikelySpeaking =
    status === 'CONNECTED' &&
    handler !== 'AGENT' &&
    Boolean(
      lastEntry &&
        isAssistantRole(lastEntry.role) &&
        Date.now() - new Date(lastEntry.at).getTime() < 8000
    );

  const mobileMeta = [
    inbound ? 'Incoming' : 'Outgoing',
    formatDuration(active ? liveElapsed : durationSeconds),
    handlerTag || handlerLabel,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-neutral-200 bg-white px-1.5 py-1.5 sm:gap-3 sm:px-4 sm:py-3 dark:border-neutral-800 dark:bg-neutral-950">
        {onBack && (
          <button
            type="button"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-800 md:hidden dark:text-neutral-100"
            onClick={onBack}
            aria-label="Back to calls"
          >
            <ArrowLeft size={20} strokeWidth={2.25} />
          </button>
        )}

        <ContactAvatar name={name || undefined} phone={phone} size="sm" active={active} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold tracking-tight text-theme-fg sm:text-[15px] sm:font-bold">
            {displayName}
          </p>
          <p className="truncate text-[11px] font-medium text-theme-muted sm:hidden">{mobileMeta}</p>
          <p className="mt-0.5 hidden truncate text-[12px] font-medium text-theme-muted sm:block">
            {formatPhoneDisplay(phone)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-0.5 sm:gap-2">
          {onOpenDetails && (
            <button
              type="button"
              onClick={onOpenDetails}
              aria-label="Call details"
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-neutral-600 md:hidden dark:text-neutral-300 ${FOCUS_RING_CLASS}`}
            >
              <PanelRight className="h-[18px] w-[18px]" strokeWidth={2.1} />
            </button>
          )}
          {contactId && onCallingAiChange ? (
            <span className="hidden sm:inline-flex">
              <CallingAiPicker
                enabled={callingAiEnabled !== false}
                saving={callingAiSaving}
                botName={botName}
                onChange={onCallingAiChange}
              />
            </span>
          ) : null}
          {!active && onCallBack && (
            <>
              <button
                type="button"
                onClick={onCallBack}
                disabled={callingBack}
                title="Call this contact back"
                aria-label={callingBack ? 'Calling' : 'Call'}
                className={`flex h-9 w-9 items-center justify-center rounded-full text-emerald-700 sm:hidden ${FOCUS_RING_CLASS}`}
              >
                <PhoneOutgoing className="h-[18px] w-[18px]" strokeWidth={2.1} />
              </button>
              <AppButton
                variant="secondary"
                size="sm"
                loading={callingBack}
                onClick={onCallBack}
                title="Call this contact back"
                className={`hidden sm:inline-flex ${
                  callingBack
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700/50 dark:bg-emerald-950/40 dark:text-emerald-200'
                    : ''
                }`}
              >
                {!callingBack && <PhoneOutgoing className="h-3.5 w-3.5" />}
                {callingBack ? 'Calling…' : 'Call back'}
              </AppButton>
            </>
          )}

          {conversationId ? (
            <Link to={`/inbox?conversation=${conversationId}`} aria-label="Open chat">
              <span className={`flex h-9 w-9 items-center justify-center rounded-full text-whatsapp-600 sm:hidden ${FOCUS_RING_CLASS}`}>
                <MessageSquare className="h-[18px] w-[18px]" strokeWidth={2.1} />
              </span>
              <span className="hidden sm:inline-flex">
                <AppButton variant="primary" size="sm">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Open chat
                </AppButton>
              </span>
            </Link>
          ) : (
            <>
              <button
                type="button"
                disabled
                title="No linked chat yet"
                aria-label="Open chat"
                className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-300 sm:hidden"
              >
                <MessageSquare className="h-[18px] w-[18px]" strokeWidth={2.1} />
              </button>
              <span className="hidden sm:inline-flex">
                <AppButton variant="secondary" size="sm" disabled title="No linked chat yet">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Open chat
                </AppButton>
              </span>
            </>
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
        </div>
      </div>

      <div className="hidden shrink-0 border-b border-neutral-200 bg-white px-4 py-2.5 text-[12px] font-medium text-neutral-500 sm:flex sm:flex-wrap sm:items-center dark:border-neutral-800 dark:bg-neutral-950">
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
              {inbound ? 'Incoming call' : 'Outgoing call'}
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
              <span className="font-bold text-neutral-900 dark:text-neutral-100">Answered by</span>
              <span className="text-neutral-300 dark:text-neutral-600">:</span>
              <span className="inline-flex items-center gap-1.5 font-semibold text-neutral-700 dark:text-neutral-200">
                {handlerLabel}
                {handlerTag && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                    handler === 'AI' ? 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300' : 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300'
                  }`}>
                    {handlerTag}
                  </span>
                )}
              </span>
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
        {summary ? (
          <div className="mx-3 mt-3 sm:mx-4">
            <CallSummaryNote summary={summary} />
          </div>
        ) : null}
        {!transcript?.length ? (
          summary && !active ? null : (
          <div className="flex h-full min-h-[140px] items-center justify-center p-6 sm:p-8">
            <div className="rounded-2xl border border-white/60 bg-white/80 px-5 py-4 text-center shadow-sm">
              <p className="text-[13px] font-semibold text-neutral-700">
                {active
                  ? handler === 'AGENT'
                    ? 'Live with customer…'
                    : 'Listening…'
                  : tone === 'missed'
                    ? 'This call wasn’t answered'
                    : handler === 'AGENT'
                      ? 'Human call — no AI transcript'
                      : 'No speech on this call yet'}
              </p>
              <p className="mt-1 text-[12px] text-neutral-500">
                {active
                  ? handler === 'AGENT'
                    ? 'Talk normally — your mic audio goes to WhatsApp. AI transcript only for AI-answered calls.'
                    : 'Conversation appears here as you and the AI talk.'
                  : tone === 'missed'
                    ? 'Customer didn’t connect — notes still help your team.'
                    : handler === 'AGENT'
                      ? 'Agent incoming/outgoing calls don’t store an AI speech transcript.'
                      : 'Transcript appears once someone speaks.'}
              </p>
            </div>
          </div>
          )
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
          <ControlBtn
            icon={muted ? MicOff : Mic}
            label={muted ? 'Unmute' : 'Mute'}
            active={muted}
            onClick={() => {
              const pc = getAgentPeerConnection();
              if (pc) {
                const senders = pc.getSenders();
                const audioSender = senders.find((s) => s.track?.kind === 'audio');
                if (audioSender?.track) {
                  audioSender.track.enabled = muted;
                  setMuted(!muted);
                }
              }
            }}
          />
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

import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, PhoneOff } from 'lucide-react';
import { callingApi } from '../../services/api';
import { cleanupAgentCall } from '../../utils/agentCallRTC';
import {
  OUTBOUND_DIALING_ID,
  clearOutboundLiveCall,
  getOutboundLiveCall,
  isOutboundDockStatus,
  subscribeOutboundLiveCall,
  type OutboundLiveCall,
} from '../../utils/outboundLiveCallStore';
import { formatDuration } from './callUtils';
import { getAvatarGradient, getInitials } from '../inbox/inboxUtils';
import { toastError, toastSuccess } from '../../utils/toast';

function useOutboundLiveCall(): OutboundLiveCall | null {
  const [call, setCall] = useState(getOutboundLiveCall);
  useEffect(() => subscribeOutboundLiveCall(() => setCall(getOutboundLiveCall())), []);
  return call;
}

function LiveWaveform({ active }: { active: boolean }) {
  const bars = useMemo(
    () => Array.from({ length: 12 }, (_, i) => 0.35 + ((i * 37) % 55) / 100),
    []
  );
  return (
    <div className="hidden h-7 items-end gap-[2px] sm:flex" aria-hidden>
      {bars.map((base, i) => (
        <span
          key={i}
          className={`w-[3px] rounded-full bg-whatsapp-500 ${
            active ? 'outbound-live-wave' : 'opacity-35'
          }`}
          style={{
            height: `${Math.round(base * 100)}%`,
            animationDelay: `${i * 70}ms`,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Global bottom dock for OUTBOUND (BIC) agent calls.
 * Shows as soon as Callback is pressed (DIALING), then CONNECTING → LIVE.
 */
export default function OutboundLiveCallBar() {
  const call = useOutboundLiveCall();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [ending, setEnding] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const dialing = call?.status === 'DIALING' || call?.callId === OUTBOUND_DIALING_ID;
  const onCallStage =
    Boolean(call) &&
    !dialing &&
    (pathname === `/calls/${call!.callId}` || pathname.startsWith(`/calls/${call!.callId}/`));

  useEffect(() => {
    if (!call || !isOutboundDockStatus(call.status)) {
      setElapsed(0);
      return;
    }
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - call.startedAt) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [call?.callId, call?.startedAt, call?.status]);

  if (!call || !isOutboundDockStatus(call.status)) return null;

  const live = call.status === 'CONNECTED';
  const label =
    call.status === 'DIALING'
      ? 'CALLING…'
      : live
        ? 'LIVE CALL'
        : call.status === 'RINGING'
          ? 'RINGING'
          : 'CONNECTING';
  const avatarKey = call.contactName || call.phone;

  const handleReturn = () => {
    if (dialing || call.callId === OUTBOUND_DIALING_ID) return;
    navigate(`/calls/${call.callId}`);
  };

  const handleEnd = async () => {
    if (ending) return;
    setEnding(true);
    try {
      if (!dialing && call.callId !== OUTBOUND_DIALING_ID) {
        await callingApi.terminate(call.callId);
      }
      cleanupAgentCall();
      clearOutboundLiveCall(call.callId);
      toastSuccess('Call ended.');
    } catch {
      toastError('Could not end the call.');
    } finally {
      setEnding(false);
    }
  };

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex justify-center px-3 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-5"
      role="status"
      aria-live="polite"
      aria-label={`Outgoing call with ${call.contactName}`}
    >
      <div className="pointer-events-auto flex w-auto max-w-[min(100%,42rem)] animate-[slideUp_0.28s_ease-out] items-center gap-2.5 rounded-2xl border border-emerald-200/80 bg-theme-surface/95 px-3 py-2.5 shadow-[0_12px_40px_rgba(15,23,42,0.12)] backdrop-blur-md sm:gap-3 sm:rounded-[1.25rem] sm:px-4 sm:py-3 dark:border-emerald-800/50 dark:bg-neutral-950/90 dark:shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
        <span className="relative flex h-10 w-10 shrink-0 items-center justify-center">
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-bold text-white ring-2 ring-white dark:ring-neutral-900 ${getAvatarGradient(avatarKey)}`}
          >
            {getInitials(call.contactName, call.phone)}
          </span>
          {dialing && (
            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-theme-surface ring-1 ring-theme-border dark:bg-neutral-950">
              <Loader2 className="h-3 w-3 animate-spin text-whatsapp-600" strokeWidth={2.5} />
            </span>
          )}
        </span>

        <div className="min-w-0 flex-1 sm:min-w-[7rem]">
          <p className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] text-whatsapp-700 dark:text-whatsapp-400">
            {(dialing || live) && (
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-whatsapp-500 opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-whatsapp-500" />
              </span>
            )}
            {label}
          </p>
          <p className="truncate text-[14px] font-bold text-theme-fg sm:text-[15px]">
            {call.contactName}
          </p>
        </div>

        <p className="shrink-0 tabular-nums text-[13px] font-semibold text-theme-secondary sm:text-[14px]">
          {formatDuration(elapsed)}
        </p>

        <LiveWaveform active />

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {!onCallStage && !dialing && (
            <button
              type="button"
              onClick={handleReturn}
              className="inline-flex h-9 items-center justify-center rounded-xl bg-gradient-to-br from-whatsapp-500 to-whatsapp-600 px-3 text-[12px] font-bold text-white shadow-[0_2px_8px_rgba(37,211,102,0.28)] transition hover:brightness-105 active:scale-[0.98] sm:px-3.5 sm:text-[13px]"
            >
              Return to call
            </button>
          )}
          {onCallStage && (
            <span className="hidden h-9 items-center rounded-xl border border-emerald-200/80 bg-emerald-50 px-3 text-[12px] font-semibold text-emerald-800 sm:inline-flex dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-200">
              On this call
            </span>
          )}
          <button
            type="button"
            onClick={() => void handleEnd()}
            disabled={ending}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-200/90 bg-rose-50 px-2.5 text-[12px] font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-60 sm:px-3 sm:text-[13px] dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 dark:hover:bg-rose-500/15"
          >
            {ending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.25} />
            ) : (
              <PhoneOff className="h-3.5 w-3.5" strokeWidth={2.25} />
            )}
            <span className="hidden sm:inline">End call</span>
          </button>
        </div>
      </div>
    </div>
  );
}

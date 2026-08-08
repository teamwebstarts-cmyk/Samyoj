import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, PhoneOff, PhoneIncoming } from 'lucide-react';
import { callingApi } from '../../services/api';
import { createAgentAnswer, setActiveCallId } from '../../utils/agentCallRTC';
import { toastError, toastSuccess } from '../../utils/toast';

interface RingPayload {
  callId: string;
  fromPhone: string;
  contactName?: string;
  conversationId?: string;
  timeoutSec?: number;
}

interface CallRingModalProps {
  ring: RingPayload | null;
  onDismiss: () => void;
}

export default function CallRingModal({ ring, onDismiss }: CallRingModalProps) {
  const navigate = useNavigate();
  const [accepting, setAccepting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(25);

  useEffect(() => {
    if (!ring) return;
    setSecondsLeft(ring.timeoutSec ?? 25);

    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 440;
      gain.gain.value = 0.05;
      osc.start();
      const stop = setTimeout(() => {
        osc.stop();
        void ctx.close();
      }, 300);
      return () => {
        clearTimeout(stop);
        osc.stop();
        void ctx.close();
      };
    } catch {
      return undefined;
    }
  }, [ring?.callId]);

  useEffect(() => {
    if (!ring) return;
    const timer = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [ring?.callId]);

  const handleAccept = useCallback(async () => {
    if (!ring) return;
    setAccepting(true);
    try {
      const { data } = await callingApi.getSignaling(ring.callId);
      const sdpOffer = data.data.sdpOffer as string;
      const sdpAnswer = await createAgentAnswer(sdpOffer);
      await callingApi.accept(ring.callId, sdpAnswer);
      setActiveCallId(ring.callId);
      toastSuccess('Call connected.');
      onDismiss();
      navigate(`/calls/${ring.callId}`);
    } catch (err) {
      toastError(err instanceof Error ? err.message : 'Could not answer. Check microphone permissions.');
    } finally {
      setAccepting(false);
    }
  }, [ring, navigate, onDismiss]);

  const handleDecline = useCallback(async () => {
    if (!ring) return;
    try {
      await callingApi.decline(ring.callId);
    } catch {
      // ignore
    }
    onDismiss();
  }, [ring, onDismiss]);

  if (!ring) return null;

  const displayName = ring.contactName || ring.fromPhone;

  // Non-blocking bottom banner — like a mobile incoming call notification.
  // Doesn't block the page, user can still interact with everything below.
  return (
    <div className="fixed bottom-4 left-1/2 z-[100] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 animate-slide-up" role="alertdialog">
      <div className="overflow-hidden rounded-2xl border border-white/25 bg-gradient-to-r from-violet-600 to-indigo-700 shadow-2xl shadow-violet-500/30 backdrop-blur-xl dark:from-violet-800 dark:to-indigo-900">
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Avatar */}
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/20 text-white ring-1 ring-white/30">
            <PhoneIncoming className="h-5 w-5" />
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-extrabold text-white">{displayName}</p>
            <div className="mt-0.5 flex items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              <p className="text-[12px] font-semibold text-white/80">
                Incoming call · {secondsLeft}s
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => void handleDecline()}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition"
              title="Decline"
            >
              <PhoneOff className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => void handleAccept()}
              disabled={accepting}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white hover:bg-emerald-400 transition disabled:opacity-60"
              title="Accept"
            >
              <Phone className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

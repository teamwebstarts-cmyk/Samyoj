import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, PhoneOff, PhoneIncoming } from 'lucide-react';
import AppButton from '../ui/AppButton';
import { callingApi } from '../../services/api';
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

async function createAgentAnswer(sdpOffer: string): Promise<string> {
  const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  for (const track of stream.getTracks()) {
    pc.addTrack(track, stream);
  }

  await pc.setRemoteDescription({ type: 'offer', sdp: sdpOffer });
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  await new Promise<void>((resolve) => {
    if (pc.iceGatheringState === 'complete') {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, 5000);
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(timer);
        resolve();
      }
    };
  });

  const sdp = pc.localDescription?.sdp;
  if (!sdp) throw new Error('Could not generate call answer');

  (window as unknown as { __activeCallPc?: RTCPeerConnection }).__activeCallPc = pc;
  return sdp;
}

export default function CallRingModal({ ring, onDismiss }: CallRingModalProps) {
  const navigate = useNavigate();
  const [accepting, setAccepting] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(25);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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
      toastSuccess('Call connected — use your microphone to speak.');
      onDismiss();
      navigate(`/calls/${ring.callId}`);
    } catch {
      toastError('Could not answer the call. Check microphone permissions.');
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

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div
        className="w-full max-w-md animate-fade-up rounded-2xl border border-violet-200/80 bg-white p-5 shadow-2xl"
        role="alertdialog"
        aria-labelledby="call-ring-title"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-lg">
            <PhoneIncoming className="h-6 w-6 animate-pulse" />
          </span>
          <div className="min-w-0 flex-1">
            <p id="call-ring-title" className="truncate text-[16px] font-extrabold text-neutral-900">
              Incoming call
            </p>
            <p className="truncate text-[13px] font-medium text-neutral-500">{displayName}</p>
            <p className="text-[11px] font-semibold text-violet-600">Answering in {secondsLeft}s</p>
          </div>
        </div>

        <div className="mt-5 flex gap-2">
          <AppButton variant="danger" className="flex-1" onClick={() => void handleDecline()}>
            <PhoneOff className="h-4 w-4" />
            Decline
          </AppButton>
          <AppButton className="flex-1" loading={accepting} onClick={() => void handleAccept()}>
            <Phone className="h-4 w-4" />
            Answer
          </AppButton>
        </div>
        <audio ref={audioRef} className="hidden" />
      </div>
    </div>
  );
}

/**
 * Agent-call WebRTC manager.
 *
 * Lives on `window` so both the Inbox (call button) and the CallsPage
 * (detail view) can share state while the browser navigates between them.
 *
 * Outbound BIC: browser creates SDP *offer* (with mic) → Meta → customer answers
 * → browser applies SDP *answer*. Inbound agent ring: opposite (answer Meta offer).
 */

import { getActiveWhatsappNumberId } from '../services/api';
import { isCurrentNumberRequest } from './whatsappWorkspace';
import { canApplyRemoteAnswer } from './webrtcSignaling';

const WINDOW_KEY = '__agentCallRtc';

interface AgentCallRtc {
  pc: RTCPeerConnection;
  remoteAudio: HTMLAudioElement;
  callId: string;
  /** True once Meta SDP answer (outbound) or local answer (inbound) is applied. */
  connected: boolean;
}

interface SignalingRes {
  data?: { sdpAnswer?: string | null; ended?: boolean };
}

function getStored(): AgentCallRtc | undefined {
  return (window as unknown as Record<string, AgentCallRtc | undefined>)[WINDOW_KEY];
}

function setStored(val: AgentCallRtc | undefined) {
  (window as unknown as Record<string, AgentCallRtc | undefined>)[WINDOW_KEY] = val;
}

let applyAnswerChain: Promise<void> = Promise.resolve();

/** Fetch the SDP answer directly (avoids axios interceptor logging 404s on every poll). */
async function fetchSdpAnswer(callId: string): Promise<{ sdp: string | null; ended: boolean }> {
  const numberId = getActiveWhatsappNumberId();
  if (!numberId) return { sdp: null, ended: false };
  const res = await fetch(`/api/calling/${callId}/signaling`, {
    credentials: 'include',
    headers: {
      'X-WhatsApp-Number-Id': numberId,
    },
  });
  if (res.status === 404) return { sdp: null, ended: true };
  if (!res.ok) return { sdp: null, ended: false };
  const body = (await res.json()) as SignalingRes;
  if (!isCurrentNumberRequest(numberId, getActiveWhatsappNumberId())) {
    return { sdp: null, ended: true };
  }
  return {
    sdp: body.data?.sdpAnswer || null,
    ended: body.data?.ended === true,
  };
}

function attachRemoteAudio(pc: RTCPeerConnection): HTMLAudioElement {
  const remoteAudio = new Audio();
  remoteAudio.autoplay = true;
  (remoteAudio as HTMLAudioElement & { playsInline: boolean }).playsInline = true;
  remoteAudio.style.display = 'none';
  document.body.appendChild(remoteAudio);

  pc.ontrack = (event) => {
    const stream = event.streams[0] ?? new MediaStream([event.track]);
    remoteAudio.srcObject = stream;
    void remoteAudio.play().catch(() => {});
  };

  // Only tear down on terminal failure — do NOT cleanup on brief "disconnected"
  // (common on Codespaces / flaky ICE); that was stopping the mic mid-call
  // while remote audio could still appear to work briefly.
  pc.oniceconnectionstatechange = () => {
    const state = pc.iceConnectionState;
    if (state === 'failed') {
      console.warn('[webrtc] ICE failed', state);
    }
    if (state === 'closed') {
      cleanupAgentCall();
    }
  };

  return remoteAudio;
}

async function waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
  await new Promise<void>((resolve) => {
    if (pc.iceGatheringState === 'complete') {
      resolve();
      return;
    }
    const t = setTimeout(resolve, 5000);
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(t);
        resolve();
      }
    };
  });
}

/**
 * Mic must be sendrecv. addTrack (not addTransceiver + offerToReceiveAudio)
 * keeps a single audio m-line — Meta rejects multi-stream SDP (138008).
 */
async function addMicrophoneSendRecv(pc: RTCPeerConnection): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });
  const track = stream.getAudioTracks()[0];
  if (!track) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error('No microphone track');
  }
  track.enabled = true;
  pc.addTrack(track, stream);
  (pc as unknown as Record<string, MediaStream>)._localStream = stream;
  return stream;
}

function ensureLocalAudioSending(pc: RTCPeerConnection): void {
  for (const sender of pc.getSenders()) {
    if (sender.track?.kind === 'audio') {
      sender.track.enabled = true;
    }
  }
  for (const t of pc.getTransceivers()) {
    if (t.receiver.track.kind === 'audio' || t.sender.track?.kind === 'audio') {
      if (t.direction === 'inactive' || t.direction === 'recvonly') {
        try {
          t.direction = 'sendrecv';
        } catch {
          /* ignore if closed */
        }
      }
    }
  }
}

/** Meta requires SHA-256 (capitalized) fingerprints, CRLF, and a single audio stream. */
function sanitizeAgentSdp(sdp: string): string {
  const lines = sdp
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => {
      if (!line) return false;
      if (/^a=extmap-allow-mixed$/i.test(line)) return false;
      if (/^a=fingerprint:sha-384\b/i.test(line)) return false;
      if (/^a=fingerprint:sha-512\b/i.test(line)) return false;
      return true;
    })
    .map((line) => line.replace(/^a=fingerprint:sha-256/i, 'a=fingerprint:SHA-256'));
  return `${lines.join('\r\n')}\r\n`;
}

/** Create a browser WebRTC offer, grab mic, return the SDP offer string. */
export async function createAgentOffer(): Promise<string | null> {
  cleanupAgentCall();
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  });

  try {
    await addMicrophoneSendRecv(pc);
  } catch {
    pc.close();
    return null;
  }

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  await waitForIceGathering(pc);
  ensureLocalAudioSending(pc);

  const raw = pc.localDescription?.sdp;
  if (!raw) {
    pc.close();
    return null;
  }

  const sdpOffer = sanitizeAgentSdp(raw);

  // Guard: offer must advertise send (not recvonly) or Meta will not pull agent mic.
  if (/a=recvonly/i.test(sdpOffer) && !/a=sendrecv|a=sendonly/i.test(sdpOffer)) {
    console.error('[webrtc] Offer is recvonly — aborting outbound call setup');
    cleanupAgentCall();
    pc.close();
    return null;
  }

  if ((sdpOffer.match(/^m=audio /gm) || []).length !== 1 || /^m=video /m.test(sdpOffer)) {
    console.error('[webrtc] Offer is not a single audio stream — aborting outbound call setup');
    cleanupAgentCall();
    pc.close();
    return null;
  }

  const remoteAudio = attachRemoteAudio(pc);
  setStored({ pc, remoteAudio, callId: '', connected: false });
  return sdpOffer;
}

/**
 * Answer an inbound agent ring: set Meta's SDP offer as remote, create local answer,
 * play remote audio via the shared RTC store (same as outbound).
 */
export async function createAgentAnswer(sdpOffer: string): Promise<string> {
  cleanupAgentCall();
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ],
  });

  try {
    await addMicrophoneSendRecv(pc);
  } catch {
    pc.close();
    throw new Error('Microphone access is required to answer calls. Check your browser permissions.');
  }

  const remoteAudio = attachRemoteAudio(pc);
  await pc.setRemoteDescription({ type: 'offer', sdp: sdpOffer });
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await waitForIceGathering(pc);
  ensureLocalAudioSending(pc);

  const sdp = pc.localDescription?.sdp;
  if (!sdp) {
    remoteAudio.remove();
    pc.close();
    throw new Error('Could not generate call answer');
  }

  setStored({ pc, remoteAudio, callId: '', connected: true });
  return sanitizeAgentSdp(sdp);
}

/** Apply the SDP answer returned by Meta (via polling or socket). */
export async function applyAgentOfferAnswer(callId: string, sdpAnswer: string): Promise<void> {
  const run = applyAnswerChain.then(() => applyAgentOfferAnswerNow(callId, sdpAnswer));
  applyAnswerChain = run.then(
    () => undefined,
    () => undefined
  );
  return run.catch(() => undefined);
}

async function applyAgentOfferAnswerNow(callId: string, sdpAnswer: string): Promise<void> {
  const stored = getStored();
  if (!stored) {
    return;
  }

  const idOk = !stored.callId || stored.callId === callId;
  if (!idOk) {
    console.warn('[webrtc] SDP answer callId mismatch', { expected: stored.callId, got: callId });
    return;
  }
  if (!stored.callId) stored.callId = callId;

  if (!canApplyRemoteAnswer(stored.pc.signalingState, stored.connected)) {
    if (stored.pc.signalingState === 'stable') stored.connected = true;
    return;
  }

  try {
    await stored.pc.setRemoteDescription({ type: 'answer', sdp: sdpAnswer });
    ensureLocalAudioSending(stored.pc);
    stored.connected = true;
    console.log('[webrtc] SDP answer applied — local mic should be sending', {
      ice: stored.pc.iceConnectionState,
      senders: stored.pc.getSenders().map((s) => ({
        kind: s.track?.kind,
        enabled: s.track?.enabled,
        muted: s.track?.muted,
      })),
    });
  } catch (e) {
    if (stored.pc.signalingState === 'stable') {
      stored.connected = true;
      return;
    }
    console.error('[webrtc] setRemoteDescription failed:', e);
  }
}

/** Store the current callId so applyAgentOfferAnswer can match it. */
export function setActiveCallId(callId: string): void {
  const stored = getStored();
  if (stored) stored.callId = callId;
}

/** Active agent PeerConnection (mute / inspect). */
export function getAgentPeerConnection(): RTCPeerConnection | null {
  return getStored()?.pc ?? null;
}

/** Stop mic, close peer connection, remove audio element. */
export function cleanupAgentCall(): void {
  const stored = getStored();
  if (!stored) return;
  try {
    const stream = (stored.pc as unknown as Record<string, MediaStream>)._localStream;
    if (stream) stream.getTracks().forEach((t) => t.stop());
  } catch {
    /* ignore */
  }
  try {
    stored.pc.close();
  } catch {
    /* ignore */
  }
  try {
    stored.remoteAudio.pause();
    stored.remoteAudio.srcObject = null;
    stored.remoteAudio.remove();
  } catch {
    /* ignore */
  }
  setStored(undefined);
  // Lazy import avoids circular deps with call UI modules.
  void import('./outboundLiveCallStore').then(({ clearOutboundLiveCall }) => {
    clearOutboundLiveCall();
  });
}

/** Poll GET /signaling for the SDP answer until it arrives (500ms interval, 3 min timeout). */
export async function pollSdpAnswer(callId: string, timeoutMs = 180000): Promise<void> {
  setActiveCallId(callId);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 500));
    const stored = getStored();
    if (!stored) return;
    if (stored.callId && stored.callId !== callId) return;
    if (stored.connected) return;
    try {
      const result = await fetchSdpAnswer(callId);
      if (result.ended) {
        cleanupAgentCall();
        return;
      }
      if (result.sdp) {
        await applyAgentOfferAnswer(callId, result.sdp);
        return;
      }
    } catch {
      /* not yet available — keep polling */
    }
  }
  const leftover = getStored();
  if (leftover && (!leftover.callId || leftover.callId === callId) && !leftover.connected) {
    console.warn('[webrtc] Timed out waiting for SDP answer', callId);
  }
}

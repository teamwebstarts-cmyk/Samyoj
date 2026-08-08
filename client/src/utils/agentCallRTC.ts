/**
 * Agent-call WebRTC manager.
 *
 * Lives on `window` so both the Inbox (call button) and the CallsPage
 * (detail view) can share state while the browser navigates between them.
 *
 * Outbound BIC: browser creates SDP *offer* (with mic) → Meta → customer answers
 * → browser applies SDP *answer*. Inbound agent ring: opposite (answer Meta offer).
 */

const WINDOW_KEY = '__agentCallRtc';

interface AgentCallRtc {
  pc: RTCPeerConnection;
  remoteAudio: HTMLAudioElement;
  callId: string;
  /** True once Meta SDP answer (outbound) or local answer (inbound) is applied. */
  connected: boolean;
}

interface SignalingRes {
  data?: { sdpAnswer?: string | null };
}

function getStored(): AgentCallRtc | undefined {
  return (window as unknown as Record<string, AgentCallRtc | undefined>)[WINDOW_KEY];
}

function setStored(val: AgentCallRtc | undefined) {
  (window as unknown as Record<string, AgentCallRtc | undefined>)[WINDOW_KEY] = val;
}

/** Fetch the SDP answer directly (avoids axios interceptor logging 404s on every poll). */
async function fetchSdpAnswer(callId: string): Promise<string | null> {
  const res = await fetch(`/api/calling/${callId}/signaling`, {
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${localStorage.getItem('accessToken') || ''}`,
    },
  });
  if (!res.ok) return null;
  const body = (await res.json()) as SignalingRes;
  return body.data?.sdpAnswer || null;
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
 * Mic must be sendrecv. Using addTransceiver+replaceTrack avoids recvonly offers
 * that cause one-way audio (hear customer, they cannot hear agent).
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

  const transceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });
  await transceiver.sender.replaceTrack(track);
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

  const offer = await pc.createOffer({
    offerToReceiveAudio: true,
    offerToReceiveVideo: false,
  });
  await pc.setLocalDescription(offer);
  await waitForIceGathering(pc);
  ensureLocalAudioSending(pc);

  const sdpOffer = pc.localDescription?.sdp;
  if (!sdpOffer) {
    pc.close();
    return null;
  }

  // Guard: offer must advertise send (not recvonly) or Meta will not pull agent mic.
  if (/a=recvonly/i.test(sdpOffer) && !/a=sendrecv|a=sendonly/i.test(sdpOffer)) {
    console.error('[webrtc] Offer is recvonly — aborting outbound call setup');
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
  return sdp;
}

/** Apply the SDP answer returned by Meta (via polling or socket). */
export async function applyAgentOfferAnswer(callId: string, sdpAnswer: string): Promise<void> {
  const stored = getStored();
  if (!stored) {
    console.warn('[webrtc] No peer connection to apply SDP answer');
    return;
  }

  // Race: answer can arrive before setActiveCallId — still apply if this PC is waiting.
  const idOk = !stored.callId || stored.callId === callId;
  if (!idOk) {
    console.warn('[webrtc] SDP answer callId mismatch', { expected: stored.callId, got: callId });
    return;
  }
  if (!stored.callId) stored.callId = callId;

  if (stored.connected && stored.pc.signalingState === 'stable') {
    return;
  }

  const state = stored.pc.signalingState;
  if (state === 'have-local-offer' || state === 'have-remote-pranswer') {
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
      console.error('[webrtc] setRemoteDescription failed:', e);
    }
  } else {
    console.warn('[webrtc] Unexpected signaling state for answer', state);
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
}

/** Poll GET /signaling for the SDP answer until it arrives (500ms interval, 3 min timeout). */
export async function pollSdpAnswer(callId: string, timeoutMs = 180000): Promise<void> {
  setActiveCallId(callId);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 500));
    const stored = getStored();
    if (stored?.connected) return;
    try {
      const sdp = await fetchSdpAnswer(callId);
      if (sdp) {
        await applyAgentOfferAnswer(callId, sdp);
        return;
      }
    } catch {
      /* not yet available — keep polling */
    }
  }
  console.warn('[webrtc] Timed out waiting for SDP answer', callId);
}

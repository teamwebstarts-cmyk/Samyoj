/**
 * Agent-call WebRTC manager.
 *
 * Lives on `window` so both the Inbox (call button) and the CallsPage
 * (detail view) can share state while the browser navigates between them.
 *
 * Responsibilities
 * 1. Create a browser RTCPeerConnection with mic
 * 2. Generate an SDP offer to send to Meta
 * 3. Apply the SDP answer (from Meta via webhook → API poll or socket)
 * 4. Route remote audio to a hidden <audio> element
 * 5. Clean up media + PC when the call ends
 */

const WINDOW_KEY = '__agentCallRtc';

interface AgentCallRtc {
  pc: RTCPeerConnection;
  remoteAudio: HTMLAudioElement;
  callId: string;
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

/** Create a browser WebRTC offer, grab mic, return the SDP offer string. */
export async function createAgentOffer(): Promise<string | null> {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
  });

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) pc.addTrack(track, stream);
    // keep a handle on the local stream so we can stop tracks on cleanup
    (pc as unknown as Record<string, MediaStream>)._localStream = stream;
  } catch {
    return null; // mic not available — server bridge fallback
  }

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  // wait for ICE gathering
  await new Promise<void>((resolve) => {
    if (pc.iceGatheringState === 'complete') { resolve(); return; }
    const t = setTimeout(resolve, 5000);
    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === 'complete') { clearTimeout(t); resolve(); }
    };
  });

  const remoteAudio = new Audio();
  remoteAudio.autoplay = true;
  (remoteAudio as HTMLAudioElement & { playsInline: boolean }).playsInline = true;
  remoteAudio.style.display = 'none';
  document.body.appendChild(remoteAudio);

  pc.ontrack = (event) => {
    console.log('[webrtc] inbound audio track', { streams: event.streams.length });
    remoteAudio.srcObject = event.streams[0];
    void remoteAudio.play().catch(() => {});
  };
  pc.oniceconnectionstatechange = () => {
    console.log('[webrtc] ICE state:', pc.iceConnectionState);
    if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
      console.warn('[webrtc] ICE failed — cleaning up');
      cleanupAgentCall();
    }
  };
  const sdpOffer = pc.localDescription?.sdp;
  if (!sdpOffer) {
    pc.close();
    return null;
  }

  setStored({ pc, remoteAudio, callId: '' });
  return sdpOffer;
}

/** Apply the SDP answer returned by Meta (via polling or socket). */
export async function applyAgentOfferAnswer(callId: string, sdpAnswer: string): Promise<void> {
  const stored = getStored();
  if (!stored || stored.callId !== callId) return;
  if (stored.pc.signalingState !== 'stable') {
    // already has remote description
    if (stored.pc.signalingState === 'have-local-offer' || stored.pc.signalingState === 'have-remote-pranswer') {
      try {
        await stored.pc.setRemoteDescription({ type: 'answer', sdp: sdpAnswer });
        console.log('[webrtc] SDP answer applied — ICE connecting');
      } catch (e) {
        console.error('[webrtc] setRemoteDescription failed:', e);
      }
    }
  }
}

/** Store the current callId so applyAgentOfferAnswer can match it. */
export function setActiveCallId(callId: string): void {
  const stored = getStored();
  if (stored) stored.callId = callId;
}

/** Stop mic, close peer connection, remove audio element. */
export function cleanupAgentCall(): void {
  const stored = getStored();
  if (!stored) return;
  try {
    const stream = (stored.pc as unknown as Record<string, MediaStream>)._localStream;
    if (stream) stream.getTracks().forEach((t) => t.stop());
  } catch {}
  try { stored.pc.close(); } catch {}
  try {
    stored.remoteAudio.pause();
    stored.remoteAudio.srcObject = null;
    stored.remoteAudio.remove();
  } catch {}
  setStored(undefined);
}

/** Poll GET /signaling for the SDP answer until it arrives (500ms interval, 60s timeout). */
export async function pollSdpAnswer(callId: string, timeoutMs = 60000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 500));
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
}

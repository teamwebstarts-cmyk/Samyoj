export type OutboundLiveCall = {
  callId: string;
  contactName: string;
  phone: string;
  conversationId?: string;
  startedAt: number;
  /** DIALING = mic/API in progress before we have a real call id */
  status: string;
};

export const OUTBOUND_DIALING_ID = '__dialing__';

type Listener = () => void;

let current: OutboundLiveCall | null = null;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((listener) => listener());
}

export function isOutboundDockStatus(status: string): boolean {
  return ['DIALING', 'CONNECTING', 'RINGING', 'CONNECTED'].includes(status);
}

/** Immediate UI feedback when user taps Callback (before API returns). */
export function beginOutboundDialing(input: {
  contactName?: string | null;
  phone: string;
  conversationId?: string;
}): void {
  current = {
    callId: OUTBOUND_DIALING_ID,
    contactName: (input.contactName || '').trim() || input.phone,
    phone: input.phone,
    conversationId: input.conversationId,
    startedAt: Date.now(),
    status: 'DIALING',
  };
  emit();
}

/** Start / replace tracking once the real outbound call id exists. */
export function beginOutboundLiveCall(input: {
  callId: string;
  contactName?: string | null;
  phone: string;
  conversationId?: string;
  status?: string;
}): void {
  const prev = current;
  current = {
    callId: input.callId,
    contactName: (input.contactName || prev?.contactName || '').trim() || input.phone,
    phone: input.phone || prev?.phone || '',
    conversationId: input.conversationId ?? prev?.conversationId,
    startedAt: prev?.status === 'DIALING' ? prev.startedAt : Date.now(),
    status: input.status || 'CONNECTING',
  };
  emit();
}

export function updateOutboundLiveCallStatus(callId: string, status: string): void {
  if (!current) return;
  if (current.callId !== callId && current.callId !== OUTBOUND_DIALING_ID) return;
  if (!isOutboundDockStatus(status)) {
    current = null;
    emit();
    return;
  }
  current = {
    ...current,
    callId: current.callId === OUTBOUND_DIALING_ID ? callId : current.callId,
    status,
  };
  emit();
}

export function clearOutboundLiveCall(callId?: string): void {
  if (!current) return;
  if (
    callId &&
    current.callId !== callId &&
    current.callId !== OUTBOUND_DIALING_ID
  ) {
    return;
  }
  current = null;
  emit();
}

export function getOutboundLiveCall(): OutboundLiveCall | null {
  return current;
}

export function subscribeOutboundLiveCall(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

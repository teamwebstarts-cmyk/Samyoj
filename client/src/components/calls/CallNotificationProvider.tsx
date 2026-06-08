import { useCallback, useState } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { toastSuccess } from '../../utils/toast';
import CallRingModal from './CallRingModal';

interface RingPayload {
  callId: string;
  fromPhone: string;
  contactName?: string;
  conversationId?: string;
  timeoutSec?: number;
  agentIds?: string[];
}

export default function CallNotificationProvider({ children }: { children: React.ReactNode }) {
  const [ring, setRing] = useState<RingPayload | null>(null);

  useSocket(
    useCallback((event: string, data: unknown) => {
      if (event === 'call:incoming') {
        const payload = data as { fromPhone: string; contactName?: string };
        toastSuccess(`Incoming call from ${payload.contactName || payload.fromPhone}`);
      }
      if (event === 'call:ring') {
        setRing(data as RingPayload);
      }
      if (event === 'call:ring_timeout' || event === 'call:updated') {
        const payload = data as { callId?: string; status?: string };
        setRing((current) =>
          current && payload.callId === current.callId ? null : current
        );
      }
    }, [])
  );

  return (
    <>
      {children}
      <CallRingModal ring={ring} onDismiss={() => setRing(null)} />
    </>
  );
}

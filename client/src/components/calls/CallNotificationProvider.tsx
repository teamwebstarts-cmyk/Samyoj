import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../hooks/useSocket';
import { toastInbox, toastSuccess } from '../../utils/toast';
import CallRingModal from './CallRingModal';

interface RingPayload {
  callId: string;
  fromPhone: string;
  contactName?: string;
  conversationId?: string;
  timeoutSec?: number;
  agentIds?: string[];
}

interface CallbackRequestedPayload {
  when?: string;
  reason?: string;
  callId?: string;
  contactId?: string;
  ticketId?: string;
  conversationId?: string;
}

export default function CallNotificationProvider({ children }: { children: React.ReactNode }) {
  const [ring, setRing] = useState<RingPayload | null>(null);
  const navigate = useNavigate();

  useSocket(
    useCallback((event: string, data: unknown) => {
      if (event === 'call:incoming') {
        const payload = data as { fromPhone: string; contactName?: string };
        toastSuccess(`Incoming call from ${payload.contactName || payload.fromPhone}`);
      }
      if (event === 'call:callback_requested') {
        const payload = data as CallbackRequestedPayload;
        const when = (payload.when || 'soon').trim() || 'soon';
        const href = payload.ticketId
          ? '/tickets'
          : payload.callId
            ? `/calls/${payload.callId}`
            : '/calls';
        toastInbox(`Callback requested: ${when}`, {
          icon: 'star',
          actionLabel: 'View',
          onAction: () => navigate(href),
          duration: 5000,
        });
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
    }, [navigate])
  );

  return (
    <>
      {children}
      <CallRingModal ring={ring} onDismiss={() => setRing(null)} />
    </>
  );
}

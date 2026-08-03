import { useEffect, useRef, useState } from 'react';
import { whatsappApi } from '../services/api';
import type { WebhookHealth, WebhookStatus } from '../types';

export type InboundHealth =
  | { state: 'unknown' }
  | { state: 'loading' }
  | { state: 'ok'; totalReceived: number; lastReceivedAt: string | null }
  | { state: 'unhealthy'; reason: string };

const POLL_INTERVAL_MS = 60_000;

interface UseWebhookHealthResult {
  health: InboundHealth;
  refresh: () => void;
}

/**
 * Polls the WhatsApp webhook status + process health on a cheap 60s cadence
 * (only while mounted) to power the red "inbound is down" banner in the
 * Inbox list header. Returns one of four states so the UI can decide whether
 * to render the banner, an amber transient, or nothing.
 */
export function useWebhookHealth(enabled = true): UseWebhookHealthResult {
  const [health, setHealth] = useState<InboundHealth>({ state: 'unknown' });
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);

  const refresh = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const [statusRes, healthRes] = await Promise.all([
        whatsappApi.webhookStatus().catch(() => null),
        whatsappApi.webhookHealth().catch(() => null),
      ]);
      if (!mountedRef.current) return;
      const status = (statusRes?.data?.data ?? null) as WebhookStatus | null;
      const proc = (healthRes?.data?.data ?? null) as WebhookHealth | null;

      if (status && !status.connected) {
        setHealth({ state: 'unhealthy', reason: 'WhatsApp is not connected' });
        return;
      }
      if (status?.statusCheckFailed) {
        setHealth({
          state: 'unhealthy',
          reason: "Couldn't reach Meta to verify webhook status",
        });
        return;
      }
      if (status && status.subscribed === false) {
        setHealth({
          state: 'unhealthy',
          reason: 'Webhook is not subscribed in Meta — replies will not arrive',
        });
        return;
      }
      setHealth({
        state: 'ok',
        totalReceived: proc?.totalReceived ?? 0,
        lastReceivedAt: proc?.lastReceivedAt ?? null,
      });
    } finally {
      inFlightRef.current = false;
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    if (!enabled) {
      setHealth({ state: 'unknown' });
      return () => {
        mountedRef.current = false;
      };
    }
    setHealth((prev) => (prev.state === 'unknown' ? { state: 'loading' } : prev));
    void refresh();
    const interval = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return { health, refresh };
}

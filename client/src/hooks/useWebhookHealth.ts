import { useEffect, useRef, useState } from 'react';
import { whatsappApi } from '../services/api';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';
import { useOnActiveNumberChange } from './useOnActiveNumberChange';
import type { WebhookHealth, WebhookStatus } from '../types';

export type InboundHealth =
  | { state: 'unknown' }
  | { state: 'loading' }
  | { state: 'ok'; totalReceived: number; lastReceivedAt: string | null }
  | { state: 'unhealthy'; kind: 'busy' | 'off' };

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
  const { activeNumber, resolved } = useWhatsAppNumber();
  const [health, setHealth] = useState<InboundHealth>({ state: 'unknown' });
  const inFlightRef = useRef(false);
  const queuedRef = useRef(false);
  const mountedRef = useRef(true);
  const numberIdRef = useRef<string | null>(null);
  numberIdRef.current = activeNumber?.id ?? null;

  const refresh = async () => {
    if (inFlightRef.current) {
      queuedRef.current = true;
      return;
    }
    if (!enabled || !resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    inFlightRef.current = true;
    try {
      const [statusRes, healthRes] = await Promise.all([
        whatsappApi.webhookStatus().catch(() => null),
        whatsappApi.webhookHealth().catch(() => null),
      ]);
      if (!mountedRef.current || requestNumberId !== numberIdRef.current) return;
      const status = (statusRes?.data?.data ?? null) as WebhookStatus | null;
      const proc = (healthRes?.data?.data ?? null) as WebhookHealth | null;

      if (status && !status.connected) {
        setHealth({ state: 'unhealthy', kind: 'off' });
        return;
      }
      if (status?.statusCheckFailed) {
        setHealth({ state: 'unhealthy', kind: 'busy' });
        return;
      }
      if (status && status.subscribed === false) {
        setHealth({ state: 'unhealthy', kind: 'off' });
        return;
      }
      setHealth({
        state: 'ok',
        totalReceived: proc?.totalReceived ?? 0,
        lastReceivedAt: proc?.lastReceivedAt ?? null,
      });
    } finally {
      inFlightRef.current = false;
      if (queuedRef.current && mountedRef.current) {
        queuedRef.current = false;
        void refresh();
      }
    }
  };

  useOnActiveNumberChange(() => {
    setHealth({ state: 'loading' });
    void refresh();
  });

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
  }, [activeNumber?.id, enabled, resolved]);

  return { health, refresh };
}

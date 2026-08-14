import { useEffect, useRef } from 'react';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';

export interface ActiveNumberChangeEvent {
  numberId: string;
  previousNumberId: string | null;
  /** Internal workspace row identity, which changes after reconnect. */
  internalNumberId: string;
  previousInternalNumberId: string | null;
  /** First resolved number after mount — use normal page load, not a switch */
  isInitial: boolean;
}

/**
 * Runs when the user switches the active WhatsApp business number.
 * Does not run on the first number resolution (isInitial === true).
 */
export function useOnActiveNumberChange(handler: (event: ActiveNumberChangeEvent) => void) {
  const { activeNumber, resolved } = useWhatsAppNumber();
  const numberId = activeNumber?.phoneNumberId ?? null;
  const internalNumberId = activeNumber?.id ?? null;
  const prevRef = useRef<string | null>(null);
  const previousInternalRef = useRef<string | null>(null);
  const initialRef = useRef(true);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!resolved || !numberId) return;

    const previousNumberId = prevRef.current;
    const previousInternalNumberId = previousInternalRef.current;
    const isInitial = initialRef.current;
    const changed =
      numberId !== previousNumberId || internalNumberId !== previousInternalNumberId;

    if (changed && !isInitial) {
      handlerRef.current({
        numberId,
        previousNumberId,
        internalNumberId: internalNumberId as string,
        previousInternalNumberId,
        isInitial: false,
      });
    }
    if (changed) {
      prevRef.current = numberId;
      previousInternalRef.current = internalNumberId;
      initialRef.current = false;
    }
  }, [internalNumberId, numberId, resolved]);
}

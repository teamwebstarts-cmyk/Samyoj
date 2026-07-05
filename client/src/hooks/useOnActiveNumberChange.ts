import { useEffect, useRef } from 'react';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';

export interface ActiveNumberChangeEvent {
  numberId: string;
  previousNumberId: string | null;
  /** First resolved number after mount — use normal page load, not a switch */
  isInitial: boolean;
}

/**
 * Runs when the user switches the active WhatsApp business number.
 * Does not run on the first number resolution (isInitial === true).
 */
export function useOnActiveNumberChange(handler: (event: ActiveNumberChangeEvent) => void) {
  const { activeNumber, loading } = useWhatsAppNumber();
  const numberId = activeNumber?.id ?? null;
  const prevRef = useRef<string | null>(null);
  const initialRef = useRef(true);
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (loading || !numberId) return;

    const previousNumberId = prevRef.current;
    const isInitial = initialRef.current;
    const changed = numberId !== previousNumberId;

    if (changed && !isInitial) {
      handlerRef.current({ numberId, previousNumberId, isInitial: false });
    }
    if (changed) {
      prevRef.current = numberId;
      initialRef.current = false;
    }
  }, [numberId, loading]);
}

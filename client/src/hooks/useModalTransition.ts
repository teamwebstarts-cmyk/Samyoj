import { useEffect, useState } from 'react';

/**
 * M4 — drives the enter/exit transition for a mountable child.
 *
 * Usage:
 *   const { mounted, phase } = useModalTransition(open);
 *   if (!mounted) return null;
 *   return <div className={phase === 'leaving' ? 'inbox-modal-exit' : 'inbox-modal-enter'}>...</div>;
 *
 * `mounted` stays true for the duration of the exit animation after `open` flips
 * to false, so the close can play before the element is unmounted.
 */
export function useModalTransition(open: boolean, exitMs = 150) {
  const [mounted, setMounted] = useState(open);
  const [phase, setPhase] = useState<'entering' | 'leaving'>(open ? 'entering' : 'leaving');
  useEffect(() => {
    if (open) {
      setMounted(true);
      setPhase('entering');
      return undefined;
    }
    if (!mounted) return undefined;
    setPhase('leaving');
    const t = setTimeout(() => setMounted(false), exitMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return { mounted, phase };
}

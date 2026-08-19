import { useEffect } from 'react';
import { useBreakpoint } from './useBreakpoint';

/**
 * WhatsApp-style mobile thread: hide app topbar + bottom nav while a
 * conversation or call detail is open. No-op from md and up.
 */
export function useMobileThreadChrome(open: boolean) {
  const breakpoint = useBreakpoint();
  const isMobile = breakpoint === 'xs' || breakpoint === 'sm';

  useEffect(() => {
    const active = open && isMobile;
    document.documentElement.classList.toggle('mobile-thread-open', active);
    return () => document.documentElement.classList.remove('mobile-thread-open');
  }, [open, isMobile]);
}

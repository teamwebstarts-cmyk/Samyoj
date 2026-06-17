import { useEffect, useState } from 'react';

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const BREAKPOINTS: Record<Breakpoint, number> = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
};

function getBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINTS.xl) return 'xl';
  if (width >= BREAKPOINTS.lg) return 'lg';
  if (width >= BREAKPOINTS.md) return 'md';
  if (width >= BREAKPOINTS.sm) return 'sm';
  return 'xs';
}

export function useBreakpoint(): Breakpoint {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>(() =>
    typeof window !== 'undefined' ? getBreakpoint(window.innerWidth) : 'lg',
  );

  useEffect(() => {
    const mqSm = window.matchMedia(`(min-width: ${BREAKPOINTS.sm}px)`);
    const mqMd = window.matchMedia(`(min-width: ${BREAKPOINTS.md}px)`);
    const mqLg = window.matchMedia(`(min-width: ${BREAKPOINTS.lg}px)`);
    const mqXl = window.matchMedia(`(min-width: ${BREAKPOINTS.xl}px)`);

    const update = () => setBreakpoint(getBreakpoint(window.innerWidth));

    mqSm.addEventListener('change', update);
    mqMd.addEventListener('change', update);
    mqLg.addEventListener('change', update);
    mqXl.addEventListener('change', update);
    window.addEventListener('resize', update);

    return () => {
      mqSm.removeEventListener('change', update);
      mqMd.removeEventListener('change', update);
      mqLg.removeEventListener('change', update);
      mqXl.removeEventListener('change', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return breakpoint;
}

export function useIsMobile(): boolean {
  const bp = useBreakpoint();
  return bp === 'xs' || bp === 'sm';
}

export function useIsBelowLg(): boolean {
  const bp = useBreakpoint();
  return bp === 'xs' || bp === 'sm' || bp === 'md';
}

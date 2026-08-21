import type { ReactNode } from 'react';

interface TabTransitionProps {
  tabKey: string;
  children: ReactNode;
}

/**
 * Wraps tab content with a smooth cross-fade animation.
 * The key prop forces React to remount on tab change, triggering the animation.
 */
export function TabTransition({ tabKey, children }: TabTransitionProps) {
  return (
    <div key={tabKey} className="tab-fade">
      {children}
    </div>
  );
}

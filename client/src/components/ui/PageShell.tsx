import type { ReactNode } from 'react';

interface PageShellProps {
  children: ReactNode;
  fullBleed?: boolean;
  className?: string;
}

export default function PageShell({ children, fullBleed = false, className = '' }: PageShellProps) {
  if (fullBleed) {
    return (
      <div className={`page-shell-bleed ${className}`}>{children}</div>
    );
  }

  return <div className={`page-shell ${className}`}>{children}</div>;
}

/** Shared horizontal gutters — keep topbar aligned with page content */
export const PAGE_GUTTER_X = 'px-4 sm:px-6 lg:px-8';

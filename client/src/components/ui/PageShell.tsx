import type { ReactNode } from 'react';

interface PageShellProps {
  children: ReactNode;
  fullBleed?: boolean;
  /** Wider layout for inbox (uses page-shell-inbox) */
  inbox?: boolean;
  /** List pages — full viewport height with internal table scroll */
  list?: boolean;
  className?: string;
}

export default function PageShell({ children, fullBleed = false, inbox = false, list = false, className = '' }: PageShellProps) {
  if (fullBleed || inbox) {
    return (
      <div className={`${inbox ? 'page-shell-inbox' : 'page-shell-bleed'} ${className}`}>{children}</div>
    );
  }

  if (list) {
    return <div className={`page-shell-list ${className}`}>{children}</div>;
  }

  return <div className={`page-shell ${className}`}>{children}</div>;
}

/** Inner-page horizontal gutters (`--page-gutter-x` / Appearance “Page side space”). Not for the global topbar. */
export const PAGE_GUTTER_X = 'page-gutter-x';

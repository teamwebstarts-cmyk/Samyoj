import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { FOCUS_RING_CLASS } from '../../hooks/inboxA11y';

export type MetaChannelHubOption = {
  key: string;
  title: string;
  description: string;
  icon: LucideIcon;
  to?: string;
  onClick?: () => void;
  accent?: 'instagram' | 'facebook' | 'neutral';
};

const accentClass: Record<NonNullable<MetaChannelHubOption['accent']>, string> = {
  instagram:
    'border-[#f9cfe0] bg-gradient-to-br from-[#fff5f9] to-white hover:border-[#f472b6] dark:from-[#2a1520] dark:to-[#1a1018] dark:border-pink-900/40',
  facebook:
    'border-[#cfe2ff] bg-gradient-to-br from-[#f0f6ff] to-white hover:border-[#1877F2] dark:from-[#152238] dark:to-[#101820] dark:border-blue-900/40',
  neutral:
    'border-[var(--igp-line-strong,#e5e7eb)] bg-white hover:border-slate-300 dark:bg-neutral-900 dark:hover:border-neutral-600',
};

type Props = {
  heading: string;
  subheading?: string;
  options: MetaChannelHubOption[];
  className?: string;
};

/** Right-pane hub: 2–3 large tappable destinations (Inbox / Posts / Comments, etc.). */
export default function MetaChannelSideHub({ heading, subheading, options, className = '' }: Props) {
  return (
    <aside
      className={`flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[var(--igp-line,#f3e6ee)] bg-[var(--igp-card,#fff)] shadow-[var(--igp-shadow,0_10px_28px_-16px_rgba(29,20,32,0.18))] dark:border-neutral-800 dark:bg-neutral-950 ${className}`}
      aria-label={heading}
    >
      <div className="border-b border-[var(--igp-line,#f3e6ee)] px-4 py-4 dark:border-neutral-800">
        <h2 className="text-[15px] font-extrabold tracking-tight text-[var(--igp-ink,#1d1420)] dark:text-white">
          {heading}
        </h2>
        {subheading ? (
          <p className="mt-1 text-[12px] font-medium leading-snug text-[var(--igp-muted,#857886)] dark:text-neutral-400">
            {subheading}
          </p>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto p-3 sm:p-4">
        {options.map((option) => {
          const Icon = option.icon;
          const accent = accentClass[option.accent ?? 'neutral'];
          const inner = (
            <>
              <span
                className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-white shadow-sm dark:bg-neutral-900"
                aria-hidden
              >
                <Icon className="h-5 w-5 text-[#db2777]" strokeWidth={2.1} />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-[13px] font-extrabold text-[var(--igp-ink,#1d1420)] dark:text-white">
                  {option.title}
                </span>
                <span className="mt-0.5 block text-[11.5px] font-medium leading-snug text-[var(--igp-muted,#857886)] dark:text-neutral-400">
                  {option.description}
                </span>
              </span>
            </>
          );
          const classNames = `flex w-full items-start gap-3 rounded-2xl border p-3.5 text-left transition ${accent} ${FOCUS_RING_CLASS}`;
          if (option.to) {
            return (
              <Link key={option.key} to={option.to} className={classNames}>
                {inner}
              </Link>
            );
          }
          return (
            <button key={option.key} type="button" className={classNames} onClick={option.onClick}>
              {inner}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

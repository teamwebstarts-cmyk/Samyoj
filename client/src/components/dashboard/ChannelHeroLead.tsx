import type { ReactNode } from 'react';

export function ChannelHeroConnectedBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e9f9f1] px-2 py-0.5 text-[11px] font-bold text-emerald-700">
      <i className="dash-pulse h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
      Connected
    </span>
  );
}

/** Shared left column for WhatsApp / Facebook / Instagram connection heroes. */
export default function ChannelHeroLead({
  icon,
  title,
  badge,
  nameLine,
  description,
}: {
  icon: ReactNode;
  title: string;
  badge?: ReactNode;
  nameLine: ReactNode;
  description: ReactNode;
}) {
  return (
    <div className="channel-hero-lead relative z-10 flex min-w-0 items-start gap-3 sm:gap-4">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 sm:mb-1 sm:gap-x-2.5">
          <h2 className="text-[17px] font-extrabold tracking-tight text-slate-950 sm:text-[21px]">{title}</h2>
          {badge}
        </div>
        <p className="mb-1 flex min-w-0 flex-wrap items-center gap-1.5 text-[13px] font-semibold text-slate-800 sm:mb-2 sm:text-[14px]">
          {nameLine}
        </p>
        <div className="text-[11.5px] leading-snug text-slate-500 sm:text-[12.5px]">{description}</div>
      </div>
    </div>
  );
}

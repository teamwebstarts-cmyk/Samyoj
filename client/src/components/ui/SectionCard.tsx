import type { ReactNode } from 'react';

interface SectionCardProps {
  title?: string;
  subtitle?: string;
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
  hero?: boolean;
}

export default function SectionCard({
  title,
  subtitle,
  headerAction,
  children,
  className = '',
  hero = false,
}: SectionCardProps) {
  return (
    <div
      className={`${hero ? 'dashboard-hero' : 'dashboard-card'} overflow-hidden p-0 ${hero ? 'p-4 sm:p-5' : ''} ${className}`}
    >
      {(title || subtitle || headerAction) && (
        <div
          className={`flex items-start justify-between gap-3 ${hero ? 'mb-4' : 'border-b border-neutral-100 bg-gradient-to-r from-neutral-50/80 via-white to-emerald-50/30 px-4 py-4 sm:px-5'}`}
        >
          <div>
            {title && (
              <h2 className="text-base font-extrabold tracking-tight text-neutral-900">{title}</h2>
            )}
            {subtitle && (
              <p className="mt-0.5 text-[12px] font-medium text-neutral-600">{subtitle}</p>
            )}
          </div>
          {headerAction}
        </div>
      )}
      <div className={hero ? '' : 'p-4 sm:p-5'}>{children}</div>
    </div>
  );
}

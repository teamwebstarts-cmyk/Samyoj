import { MessageCircle } from 'lucide-react';

export const PLATFORM_NAME = 'Samyoj';
export const PLATFORM_TAGLINE = 'CRM & Automation';
export const PLATFORM_LOGO_SRC = '/brand/samyoj-logo.jpeg';

interface PlatformBrandProps {
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md';
  collapsed?: boolean;
  /** Use full logo image (auth pages) vs icon mark (sidebar) */
  useImage?: boolean;
}

export function PlatformLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'h-9 w-9 rounded-[10px]',
    md: 'h-10 w-10 rounded-[11px]',
    lg: 'h-11 w-11 rounded-[12px]',
  };
  const iconSizes = { sm: 'h-4 w-4', md: 'h-5 w-5', lg: 'h-5 w-5' };

  return (
    <div
      className={`flex shrink-0 items-center justify-center bg-whatsapp-600 text-white shadow-[0_2px_10px_rgba(37,211,102,0.35)] ${sizes[size]}`}
    >
      <MessageCircle className={iconSizes[size]} strokeWidth={1.8} />
    </div>
  );
}

export function PlatformBrand({
  variant = 'dark',
  size = 'md',
  collapsed = false,
  useImage = false,
}: PlatformBrandProps) {
  const isLight = variant === 'light';

  if (useImage) {
    const height = size === 'sm' ? 'h-10' : 'h-12';
    return (
      <img
        src={PLATFORM_LOGO_SRC}
        alt="Samyoj — WhatsApp Automation & CRM"
        className={`${height} w-auto max-w-[220px] object-contain object-left`}
      />
    );
  }

  if (collapsed) {
    return (
      <div className="flex justify-center">
        <PlatformLogo size={size === 'sm' ? 'sm' : 'md'} />
      </div>
    );
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5">
      <PlatformLogo size={size === 'sm' ? 'sm' : 'md'} />
      <div className="min-w-0 flex-1">
        <p
          className={`truncate font-bold tracking-[-0.02em] ${
            size === 'sm' ? 'text-sm' : 'text-base'
          } ${isLight ? 'text-white' : 'text-theme-fg'}`}
        >
          {PLATFORM_NAME}
        </p>
        <p
          className={`truncate text-[10px] font-medium leading-tight tracking-wide ${
            isLight ? 'text-emerald-100/80' : 'text-theme-muted'
          }`}
        >
          {PLATFORM_TAGLINE}
        </p>
      </div>
    </div>
  );
}

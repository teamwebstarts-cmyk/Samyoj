import { MessageCircle } from 'lucide-react';

export const PLATFORM_NAME = 'WA Platform';
export const PLATFORM_TAGLINE = 'Business messaging';

interface PlatformBrandProps {
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md';
  collapsed?: boolean;
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
      className={`flex shrink-0 items-center justify-center bg-whatsapp-500 text-white shadow-[0_2px_10px_rgba(37,211,102,0.35)] ${sizes[size]}`}
    >
      <MessageCircle className={iconSizes[size]} strokeWidth={2.2} />
    </div>
  );
}

export function PlatformBrand({ variant = 'dark', size = 'md', collapsed = false }: PlatformBrandProps) {
  const isLight = variant === 'light';

  if (collapsed) {
    return (
      <div className="flex justify-center">
        <PlatformLogo size="md" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <PlatformLogo size={size === 'sm' ? 'sm' : 'md'} />
      <div className="min-w-0">
        <p
          className={`truncate font-bold tracking-[-0.02em] ${
            size === 'sm' ? 'text-[13px]' : 'text-sm'
          } ${isLight ? 'text-white' : 'text-neutral-900'}`}
        >
          {PLATFORM_NAME}
        </p>
        <p
          className={`truncate text-[11px] font-medium ${
            isLight ? 'text-emerald-50' : 'text-neutral-600'
          }`}
        >
          {PLATFORM_TAGLINE}
        </p>
      </div>
    </div>
  );
}

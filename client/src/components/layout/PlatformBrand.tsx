export const PLATFORM_NAME = 'Samyoj';
export const PLATFORM_TAGLINE = 'CRM & Automation';
export const PLATFORM_LOGO_SRC = '/brand/samyoj-logo.png';
export const PLATFORM_MARK_SRC = '/brand/samyoj-mark.png';

interface PlatformBrandProps {
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md';
  collapsed?: boolean;
  /** Always uses brand image assets. Kept for API compatibility. */
  useImage?: boolean;
}

/** Cropped brand mark for collapsed rail / compact chrome. */
export function PlatformLogoMark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const box = {
    sm: 'h-8 w-8 rounded-[9px]',
    md: 'h-9 w-9 rounded-[10px]',
    lg: 'h-11 w-11 rounded-[12px]',
  }[size];

  return (
    <img
      src={PLATFORM_MARK_SRC}
      alt=""
      aria-hidden
      className={`shrink-0 object-contain ${box}`}
    />
  );
}

/**
 * Real Samyoj brand:
 * - Expanded → full logo PNG (icon + wordmark + tagline)
 * - Collapsed → cropped mark PNG only (icon from logo, no wordmark)
 */
export function PlatformBrand({
  size = 'md',
  collapsed = false,
}: PlatformBrandProps) {
  if (collapsed) {
    return (
      <div className="flex shrink-0 items-center">
        <PlatformLogoMark size={size === 'sm' ? 'sm' : 'md'} />
        <span className="sr-only">{PLATFORM_NAME}</span>
      </div>
    );
  }

  const height = size === 'sm' ? 'h-9' : 'h-10';
  return (
    <div className="flex min-w-0 flex-1 items-center overflow-hidden">
      <img
        src={PLATFORM_LOGO_SRC}
        alt="Samyoj — WhatsApp Automation & CRM"
        className={`${height} w-auto max-w-[188px] object-contain object-left`}
      />
    </div>
  );
}

/** @deprecated Use PlatformLogoMark */
export function PlatformLogo({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  return <PlatformLogoMark size={size} />;
}

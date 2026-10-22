export const PLATFORM_NAME = 'Samyoj';
export const PLATFORM_MARK_SRC = '/brand/logo-mark.webp';
export const PLATFORM_LOGO_SRC = '/brand/samyoj-logo.png';

export function PlatformLogoMark({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-7 w-7 rounded-[8px]' : 'h-8 w-8 rounded-[9px]';
  return (
    <img src={PLATFORM_MARK_SRC} alt="" aria-hidden className={`shrink-0 object-contain ${box}`} />
  );
}

export function PlatformBrand({ size = 'md', collapsed = false }: { size?: 'sm' | 'md'; collapsed?: boolean }) {
  if (collapsed) {
    return (
      <div className="flex shrink-0 items-center">
        <PlatformLogoMark size={size === 'sm' ? 'sm' : 'md'} />
        <span className="sr-only">{PLATFORM_NAME}</span>
      </div>
    );
  }
  const height = size === 'sm' ? 'h-8' : 'h-9';
  return (
    <div className="flex min-w-0 items-center overflow-hidden">
      <img
        src={PLATFORM_LOGO_SRC}
        alt="Samyoj — WhatsApp Automation & CRM"
        className={`${height} w-auto max-w-[160px] object-contain object-left`}
      />
    </div>
  );
}

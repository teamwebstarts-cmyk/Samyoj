export const AUTH_LOGO_SRC = '/brand/samyoj-new-logo.png';

/** Auth pages — full wordmark image, sized to the old lockup (~229×46). */
export default function AuthBrand({ compact = false }: { compact?: boolean }) {
  return (
    <img
      src={AUTH_LOGO_SRC}
      alt="samyoj — Business Automation & CRM"
      className={`auth-brand-logo block shrink-0 object-contain object-left ${
        compact ? 'h-10 w-auto max-w-[13.5rem]' : 'h-[58px] w-auto max-w-[18.25rem]'
      }`}
      width={2170}
      height={725}
    />
  );
}

import { PLATFORM_MARK_SRC } from '../layout/PlatformBrand';

/** Auth pages — circular mark + wordmark + green tagline (login mockup). */
export default function AuthBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="inline-flex items-center gap-3">
      <img
        src={PLATFORM_MARK_SRC}
        alt=""
        className={`shrink-0 object-contain ${compact ? 'h-9 w-9' : 'h-[3.85rem] w-[3.85rem]'}`}
      />
      <div className="min-w-0 leading-none">
        <p
          className={`auth-brand-name font-extrabold tracking-[-0.03em] text-[#12182A] ${
            compact ? 'text-[1.2rem]' : 'text-[1.85rem]'
          }`}
        >
          samyoj
        </p>
        <p
          className={`auth-brand-tag mt-1.5 font-semibold uppercase tracking-[0.055em] text-[#0A8954] ${
            compact ? 'text-[8.5px]' : 'text-[11px]'
          }`}
        >
          WhatsApp Automation &amp; CRM
        </p>
      </div>
    </div>
  );
}

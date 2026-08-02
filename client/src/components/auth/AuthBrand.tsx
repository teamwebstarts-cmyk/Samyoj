import { PLATFORM_LOGO_SRC } from '../layout/PlatformBrand';

/** Auth pages — Samyoj logo with soft white blend into mint canvas */
export default function AuthBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`relative inline-flex ${compact ? 'max-w-[180px]' : 'max-w-[220px]'}`}>
      {/* Soft white halo so JPEG white box merges into #F7FAF8 */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-5 -inset-y-3 rounded-2xl bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.98)_28%,rgba(255,255,255,0.72)_52%,rgba(247,250,248,0)_78%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-3 -inset-y-2 rounded-xl bg-white/70 blur-[6px]"
      />
      <img
        src={PLATFORM_LOGO_SRC}
        alt="Samyoj — WhatsApp Automation & CRM"
        className={`relative z-10 ${compact ? 'h-9' : 'h-11'} w-auto max-w-full object-contain object-left`}
      />
    </div>
  );
}

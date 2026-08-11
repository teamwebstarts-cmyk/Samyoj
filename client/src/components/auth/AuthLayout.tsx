import type { ReactNode } from 'react';
import AuthBrand from './AuthBrand';
import AuthShowcase from './AuthShowcase';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  eyebrow?: string;
  children: ReactNode;
  /** Tighter card for taller forms (register) */
  compact?: boolean;
}

export default function AuthLayout({
  title,
  subtitle,
  children,
  compact = false,
}: AuthLayoutProps) {
  return (
    <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-[#F7FAF8]">
      {/* Full-page hero — woman stays visible in the middle */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <img
          src="/brand/auth-hero.png"
          alt=""
          className="h-full w-full object-cover object-[48%_22%]"
        />
        {/* Very light global wash only — do not hide the photo */}
        <div className="absolute inset-0 bg-white/[0.06]" />
        {/* Soft green glow like the design mock (upper mid-right) */}
        <div className="absolute right-[28%] top-[8%] h-56 w-56 rounded-full bg-emerald-200/30 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1">
        <div className="hidden min-h-0 w-[60%] lg:block">
          <AuthShowcase />
        </div>

        <div className="relative flex min-h-0 w-full flex-col lg:w-[40%]">
          {/* Right-side soft white band — top/bottom + far-right corners (subtle) */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
            <div className="absolute inset-y-0 right-0 w-full bg-gradient-to-l from-white/75 from-[0%] via-white/35 via-[55%] to-transparent to-[100%]" />
            <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/50 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white/55 to-transparent" />
            <div className="absolute -right-10 top-0 h-44 w-44 rounded-full bg-white/60 blur-3xl" />
            <div className="absolute -bottom-6 -right-8 h-48 w-48 rounded-full bg-white/55 blur-3xl" />
          </div>

          <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto overscroll-contain px-5 py-4 sm:px-8 xl:px-10">
            <div className="mb-4 flex w-full max-w-[460px] shrink-0 justify-center lg:hidden">
              <AuthBrand />
            </div>

            <div className="my-auto w-full max-w-[460px] py-2">
              <div
                className={`rounded-[1.85rem] border border-white/80 bg-white/95 shadow-[0_20px_60px_rgba(15,23,42,0.1)] backdrop-blur-sm xl:rounded-[2rem] ${compact
                    ? 'p-6 sm:p-7 xl:p-8'
                    : 'p-8 sm:p-9 xl:p-10'
                  }`}
              >
                <header className={compact ? 'mb-4' : 'mb-7'}>
                  <h1
                    className={`font-extrabold leading-[1.15] tracking-[-0.035em] text-slate-900 ${compact
                        ? 'text-[1.55rem] sm:text-[1.7rem]'
                        : 'text-[1.85rem] sm:text-[2rem]'
                      }`}
                  >
                    {title}
                  </h1>
                  <p
                    className={`font-medium leading-relaxed text-slate-500 ${compact ? 'mt-1.5 text-[13px]' : 'mt-2.5 text-[14.5px]'
                      }`}
                  >
                    {subtitle}
                  </p>
                </header>

                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

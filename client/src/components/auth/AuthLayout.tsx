import type { ReactNode } from 'react';
import AuthBrand from './AuthBrand';
import AuthShowcase, { AuthTopBadge, AuthTrustFooter } from './AuthShowcase';

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
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-20 top-8 h-72 w-72 rounded-full bg-emerald-200/35 blur-3xl" />
        <div className="absolute right-[26%] top-0 h-64 w-64 rounded-full bg-whatsapp-300/20 blur-3xl" />
        <div className="absolute bottom-24 left-[38%] h-52 w-52 rounded-full bg-emerald-100/55 blur-3xl" />
        <div className="absolute -right-8 bottom-28 h-56 w-56 rounded-full bg-whatsapp-200/25 blur-3xl" />
      </div>

      <AuthTopBadge />

      <div className="relative z-10 flex min-h-0 flex-1">
        <div className="hidden min-h-0 w-[60%] lg:block">
          <AuthShowcase />
        </div>

        <div className="relative flex min-h-0 w-full flex-col lg:w-[40%]">
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto overscroll-contain px-5 py-4 sm:px-8 xl:px-10">
            <div className="mb-4 flex w-full max-w-[460px] shrink-0 justify-center lg:hidden">
              <AuthBrand />
            </div>

            <div className="my-auto w-full max-w-[460px] py-2">
              <div
                className={`rounded-[1.85rem] border border-slate-100/90 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.1)] xl:rounded-[2rem] ${
                  compact
                    ? 'p-6 sm:p-7 xl:p-8'
                    : 'p-7 sm:p-8 xl:p-9'
                }`}
              >
                <header className={compact ? 'mb-4' : 'mb-6'}>
                  <h1
                    className={`font-extrabold leading-[1.15] tracking-[-0.035em] text-slate-900 ${
                      compact
                        ? 'text-[1.55rem] sm:text-[1.7rem]'
                        : 'text-[1.8rem] sm:text-[1.95rem]'
                    }`}
                  >
                    {title}
                  </h1>
                  <p
                    className={`font-medium leading-relaxed text-slate-500 ${
                      compact ? 'mt-1.5 text-[13px]' : 'mt-2 text-[14px]'
                    }`}
                  >
                    {subtitle}
                  </p>
                </header>

                {children}
              </div>

              <div className="mt-3 sm:mt-4">
                <AuthTrustFooter />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

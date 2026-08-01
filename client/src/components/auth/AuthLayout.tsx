import type { ReactNode } from 'react';
import AuthBrand from './AuthBrand';
import AuthShowcase, { AuthTopBadge, AuthTrustFooter } from './AuthShowcase';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  eyebrow?: string;
  children: ReactNode;
}

export default function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
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
        <div className="hidden min-h-0 w-[56%] lg:block xl:w-[58%]">
          <AuthShowcase />
        </div>

        <div className="relative flex min-h-0 w-full flex-col lg:w-[44%] xl:w-[42%]">
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-5 py-5 sm:px-8 xl:px-10">
            <div className="mb-5 flex w-full max-w-[420px] justify-center lg:hidden">
              <AuthBrand />
            </div>

            <div className="w-full max-w-[420px] rounded-[1.85rem] border border-slate-100/90 bg-white p-7 shadow-[0_20px_60px_rgba(15,23,42,0.1)] sm:p-8 xl:rounded-[2rem] xl:p-9">
              <header className="mb-6">
                <h1 className="text-[1.8rem] font-extrabold leading-[1.15] tracking-[-0.035em] text-slate-900 sm:text-[1.95rem]">
                  {title}
                </h1>
                <p className="mt-2 text-[14px] font-medium leading-relaxed text-slate-500">
                  {subtitle}
                </p>
              </header>

              {children}
            </div>
          </div>

          {/* Trust strip sits under the form column (design) */}
          <div className="shrink-0 pb-3 lg:pb-4">
            <AuthTrustFooter />
          </div>
        </div>
      </div>
    </div>
  );
}

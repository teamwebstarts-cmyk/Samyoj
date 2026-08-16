import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';
import AuthBrand from './AuthBrand';
import AuthShowcase, { AuthCtaCard } from './AuthShowcase';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  eyebrow?: string;
  children: ReactNode;
  /** Tighter header for taller forms (register) */
  compact?: boolean;
}

export default function AuthLayout({
  title,
  subtitle,
  children,
  compact = false,
}: AuthLayoutProps) {
  return (
    <div className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-[#F4F7F5] lg:flex-row">
      <aside className="relative z-10 hidden h-full min-h-0 min-w-0 w-[57%] shrink-0 overflow-hidden lg:block xl:w-[58%]">
        <AuthShowcase />
      </aside>

      <section className="relative z-30 flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden bg-white lg:w-[43%] xl:w-[42%]">
        <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto overscroll-contain px-6 py-6 sm:px-10 lg:px-11 xl:px-14">
          <div className="mb-6 flex w-full max-w-[400px] shrink-0 lg:hidden">
            <AuthBrand compact />
          </div>

          <div className="my-auto w-full max-w-[400px] py-2">
            <header className={compact ? 'mb-5' : 'mb-7'}>
              <h1
                className={`font-extrabold leading-[1.15] tracking-[-0.035em] text-[#12182A] ${
                  compact ? 'text-[1.55rem] sm:text-[1.7rem]' : 'text-[1.75rem] sm:text-[1.95rem]'
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

            <div className="mt-6 lg:hidden">
              <AuthCtaCard />
            </div>

            <p className="mt-8 flex items-center justify-center gap-1.5 text-[12px] font-medium text-slate-400">
              <Lock className="h-3 w-3 shrink-0" strokeWidth={2} />
              Your data is encrypted and never shared.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

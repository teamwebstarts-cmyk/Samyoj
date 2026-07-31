import type { ReactNode } from 'react';
import AuthBrand from './AuthBrand';
import AuthShowcase from './AuthShowcase';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  eyebrow?: string;
  children: ReactNode;
}

export default function AuthLayout({ title, subtitle, eyebrow, children }: AuthLayoutProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f3f6f4] lg:grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-0 h-80 w-80 rounded-full bg-whatsapp-500/15 blur-[110px]" />
        <div className="absolute right-0 top-1/4 h-96 w-96 rounded-full bg-emerald-400/12 blur-[120px]" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-whatsapp-600/10 blur-[100px]" />
      </div>

      <div className="relative hidden lg:block">
        <AuthShowcase />
      </div>

      <div className="relative flex min-h-screen flex-col items-center justify-center px-5 py-10 sm:px-8">
        <div className="mb-8 flex w-full max-w-[440px] justify-center lg:hidden">
          <AuthBrand />
        </div>

        <div className="w-full max-w-[440px] rounded-[1.5rem] border border-white/80 bg-white p-7 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-9">
          <header className="mb-7">
            {eyebrow && (
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-whatsapp-700">
                {eyebrow}
              </p>
            )}
            <h1 className="text-[1.75rem] font-bold leading-[1.15] tracking-[-0.03em] text-theme-fg sm:text-[1.95rem]">
              {title}
            </h1>
            <p className="mt-2.5 max-w-[22rem] text-[14px] leading-relaxed text-theme-secondary">
              {subtitle}
            </p>
          </header>

          {children}
        </div>

        <p className="mt-6 max-w-[440px] text-center text-xs leading-relaxed text-theme-muted">
          By continuing, you agree to our{' '}
          <span className="cursor-pointer text-theme-secondary transition hover:text-theme-fg">
            Terms of Service
          </span>{' '}
          and{' '}
          <span className="cursor-pointer text-theme-secondary transition hover:text-theme-fg">
            Privacy Policy
          </span>
          .
        </p>
      </div>
    </div>
  );
}

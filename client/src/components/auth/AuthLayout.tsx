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
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <div className="hidden lg:block">
        <AuthShowcase />
      </div>

      <div className="relative flex min-h-screen flex-col platform-gradient">
        <div className="relative flex flex-1 flex-col items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[400px]">
            <div className="mb-10 flex justify-center lg:hidden">
              <AuthBrand />
            </div>

            <header className="mb-8">
              {eyebrow && (
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-whatsapp-700 dark:text-whatsapp-400">
                  {eyebrow}
                </p>
              )}
              <h1 className="text-[1.875rem] font-bold leading-[1.15] tracking-[-0.03em] text-theme-fg sm:text-[2.125rem]">
                {title}
              </h1>
              <p className="mt-3 max-w-[22rem] text-[15px] leading-relaxed text-theme-secondary">
                {subtitle}
              </p>
            </header>

            {children}

            <p className="mt-8 text-center text-xs leading-relaxed text-theme-muted">
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
      </div>
    </div>
  );
}

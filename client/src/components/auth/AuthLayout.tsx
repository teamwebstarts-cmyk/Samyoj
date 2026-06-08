import type { ReactNode } from 'react';
import ThemeToggle from '../ui/ThemeToggle';
import AuthBrand from './AuthBrand';
import AuthShowcase from './AuthShowcase';
import AuthTabs from './AuthTabs';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: ReactNode;
}

export default function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <div className="hidden lg:block">
        <AuthShowcase />
      </div>

      <div className="relative flex min-h-screen flex-col overflow-hidden platform-gradient">
        <div className="auth-orb auth-orb--primary -right-24 -top-24 h-72 w-72" />
        <div className="auth-orb auth-orb--secondary -left-16 bottom-1/4 h-56 w-56" />

        <div className="absolute right-4 top-4 z-10 sm:right-6 sm:top-6">
          <ThemeToggle variant="compact" />
        </div>

        <div className="relative flex flex-1 flex-col items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[420px] animate-fade-up">
            <div className="mb-6 flex justify-center lg:hidden">
              <AuthBrand />
            </div>

            <div className="auth-card relative overflow-hidden p-6 sm:p-8">
              <div className="relative">
                <div className="mb-6 hidden justify-center lg:flex">
                  <AuthBrand compact />
                </div>

                <AuthTabs />

                <div className="mb-7">
                  <h1 className="text-[1.75rem] font-extrabold tracking-[-0.03em] text-theme-fg">
                    {title}
                  </h1>
                  <p className="mt-2 text-[14px] leading-relaxed text-theme-secondary">{subtitle}</p>
                </div>

                {children}

                <p className="mt-7 text-center text-[11px] leading-relaxed text-theme-muted">
                  By continuing, you agree to our{' '}
                  <span className="cursor-pointer font-medium text-theme-secondary transition hover:text-theme-fg">
                    Terms of Service
                  </span>{' '}
                  and{' '}
                  <span className="cursor-pointer font-medium text-theme-secondary transition hover:text-theme-fg">
                    Privacy Policy
                  </span>
                  .
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

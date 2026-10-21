import { useEffect, type ReactNode } from 'react';
import AuthBrand from './AuthBrand';
import AuthShowcase, { AUTH_LOGIN_HERO_SRC } from './AuthShowcase';
import './auth-page.css';

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
  useEffect(() => {
    const root = document.documentElement;
    const wasDark = root.classList.contains('dark');
    const prevScheme = root.style.colorScheme;
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
    return () => {
      root.classList.toggle('dark', wasDark);
      root.style.colorScheme = prevScheme;
    };
  }, []);

  return (
    <div
      className="auth-page relative flex min-h-[100dvh] w-full max-w-[100vw] flex-col bg-[#F4F7F5] lg:h-[100dvh] lg:flex-row lg:overflow-hidden"
      style={{ colorScheme: 'light' }}
    >
      <div className="auth-mobile-hero lg:hidden" aria-hidden>
        <img src={AUTH_LOGIN_HERO_SRC} alt="" width={1492} height={1054} decoding="async" />
      </div>

      <aside className="relative z-10 hidden h-full min-h-0 min-w-0 w-[60%] shrink-0 overflow-hidden lg:block">
        <AuthShowcase />
      </aside>

      <section className="auth-form-panel relative z-30 flex min-h-0 w-full min-w-0 flex-1 flex-col lg:border-l lg:border-[#EDF0F3] lg:bg-white">
        <div className="auth-form-scroll flex min-h-0 flex-1 flex-col items-center lg:overflow-y-auto lg:overscroll-contain">
          <div className="auth-mobile-logo flex w-full shrink-0 lg:hidden">
            <AuthBrand compact />
          </div>

          <div className="auth-form-stack w-full shrink-0">
            <header className={compact ? 'mb-5' : 'mb-7'}>
              <h1 className="auth-form-title font-extrabold leading-[1.15] tracking-[-0.035em] text-[#12182A]">
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

            <p className="auth-privacy mt-8 flex items-center justify-center gap-1.5 text-[12px] font-medium text-slate-400">
              <svg
                className="h-3 w-3 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden
              >
                <rect x="4" y="10" width="16" height="11" rx="2.5" />
                <path d="M8 10V7a4 4 0 0 1 8 0v3" />
              </svg>
              Your data is encrypted and never shared.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

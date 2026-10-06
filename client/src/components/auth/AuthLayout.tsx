import { useEffect, type ReactNode } from 'react';
import { Lock } from 'lucide-react';
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
      className="auth-page relative flex h-[100dvh] w-[100vw] max-w-[100vw] flex-col overflow-hidden bg-[#F4F7F5] lg:flex-row"
      style={{ colorScheme: 'light' }}
    >
      <div className="auth-mobile-hero lg:hidden" aria-hidden>
        <img src={AUTH_LOGIN_HERO_SRC} alt="" width={1536} height={1024} decoding="async" />
      </div>

      <aside className="relative z-10 hidden h-full min-h-0 min-w-0 w-[60%] shrink-0 overflow-hidden lg:block">
        <AuthShowcase />
      </aside>

      <section className="auth-form-panel relative z-30 flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden lg:w-[40%] lg:bg-white">
        <div className="auth-form-scroll flex min-h-0 flex-1 flex-col items-center overflow-y-auto overscroll-contain">
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

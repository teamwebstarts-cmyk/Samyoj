import type { ReactNode } from 'react';
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
      {/* Desktop showcase */}
      <div className="hidden lg:block">
        <AuthShowcase />
      </div>

      {/* Form panel */}
      <div className="relative flex min-h-screen flex-col platform-gradient">
        <div className="flex flex-1 flex-col items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[380px] animate-fade-up">
            {/* Mobile brand */}
            <div className="mb-8 flex justify-center lg:hidden">
              <AuthBrand />
            </div>

            <AuthTabs />

            <div className="mb-8">
              <h1 className="text-[1.625rem] font-extrabold tracking-[-0.02em] text-neutral-900">
                {title}
              </h1>
              <p className="mt-2 text-[14px] leading-relaxed text-neutral-600">{subtitle}</p>
            </div>

            {children}

            <p className="mt-8 text-center text-[11px] leading-relaxed text-neutral-600">
              By continuing, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

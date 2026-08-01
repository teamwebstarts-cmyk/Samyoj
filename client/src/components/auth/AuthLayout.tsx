import type { ReactNode } from 'react';
import { BadgeCheck, Lock, ShieldCheck } from 'lucide-react';
import AuthBrand from './AuthBrand';
import AuthShowcase from './AuthShowcase';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  eyebrow?: string;
  children: ReactNode;
}

const trustBadges = [
  { icon: BadgeCheck, label: 'Meta Verified Partner' },
  { icon: Lock, label: '256-bit Encryption' },
  { icon: ShieldCheck, label: '99.9% Uptime' },
];

export default function AuthLayout({ title, subtitle, children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      <div className="hidden lg:block">
        <AuthShowcase />
      </div>

      <div className="relative flex min-h-screen flex-col bg-gradient-to-br from-[#eef8f2] via-[#f7fbf8] to-[#e8f5ee]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_80%_0%,rgba(37,211,102,0.12),transparent_50%)]" />

        <div className="relative flex flex-1 flex-col items-center justify-center px-5 py-10 sm:px-8">
          <div className="w-full max-w-[420px]">
            <div className="mb-8 flex justify-center lg:hidden">
              <AuthBrand compact />
            </div>

            <div className="rounded-[1.5rem] border border-white/80 bg-white p-7 shadow-[0_24px_60px_rgba(15,23,42,0.10)] sm:p-8">
              <header className="mb-7">
                <h1 className="text-[1.85rem] font-extrabold leading-[1.15] tracking-[-0.035em] text-[#0f2744] sm:text-[2rem]">
                  {title}
                </h1>
                <p className="mt-2.5 text-[14px] font-medium leading-relaxed text-neutral-500">
                  {subtitle}
                </p>
              </header>

              {children}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
              {trustBadges.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-1.5 text-neutral-500">
                  <Icon className="h-3.5 w-3.5 text-whatsapp-600" strokeWidth={2.2} />
                  <span className="text-[11px] font-semibold">{label}</span>
                </div>
              ))}
            </div>

            <p className="mt-6 text-center text-[11px] leading-relaxed text-neutral-400">
              By continuing, you agree to our{' '}
              <span className="cursor-pointer font-medium text-neutral-500 transition hover:text-neutral-700">
                Terms of Service
              </span>{' '}
              and{' '}
              <span className="cursor-pointer font-medium text-neutral-500 transition hover:text-neutral-700">
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

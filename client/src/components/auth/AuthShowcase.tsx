import type { ComponentType } from 'react';
import { Lightbulb } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import AuthBrand from './AuthBrand';
import { IconCampaignChart, IconSparkle, IconTeam, IconWhatsAppW } from './AuthIcons';

export const AUTH_LOGIN_HERO_SRC = '/brand/auth-login-hero.png';

type AuthIcon = ComponentType<{ className?: string }>;

const FEATURES: { icon: AuthIcon; title: string; description: string }[] = [
  {
    icon: IconWhatsAppW,
    title: 'Automate Smartly',
    description: 'Save time with intelligent automation.',
  },
  {
    icon: IconCampaignChart,
    title: 'Manage in One Place',
    description: 'All your conversations, contacts and campaigns in one dashboard.',
  },
  {
    icon: IconTeam,
    title: 'Work Better Together',
    description: 'Collaborate with your team seamlessly.',
  },
];

const ICON_WELL = 'flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#E8F5EE] text-[#0A8954]';

export function AuthCtaCard() {
  const { pathname } = useLocation();
  const isRegister = pathname.startsWith('/register');

  if (isRegister) {
    return (
      <div className="auth-cta-card flex max-w-[min(100%,380px)] items-center gap-3.5 rounded-[18px] bg-white px-4 py-3.5 shadow-[0_8px_28px_rgba(15,23,42,0.07)]">
        <span className={ICON_WELL}>
          <Lightbulb className="h-[22px] w-[22px]" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="text-[13.5px] leading-snug text-slate-600">
            <span className="font-bold text-[#12182A]">Already have an account?</span> Sign in to
            continue to your workspace.
          </p>
          <Link
            to="/login"
            className="mt-1 inline-flex text-[13.5px] font-semibold text-[#0A8954] transition hover:text-[#087A4A]"
          >
            Sign in →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-cta-card flex max-w-[min(100%,380px)] items-center gap-3.5 rounded-[18px] bg-white px-4 py-3.5 shadow-[0_8px_28px_rgba(15,23,42,0.07)]">
      <span className={ICON_WELL}>
        <Lightbulb className="h-[22px] w-[22px]" strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className="text-[13.5px] leading-snug text-slate-600">
          <span className="font-bold text-[#12182A]">New here?</span> Create your account and get
          started in minutes.
        </p>
        <Link
          to="/register"
          className="mt-1 inline-flex text-[13.5px] font-semibold text-[#0A8954] transition hover:text-[#087A4A]"
        >
          Create one free →
        </Link>
      </div>
    </div>
  );
}

export default function AuthShowcase() {
  return (
    <div className="auth-showcase font-sans antialiased">
      <div className="auth-showcase-hero" aria-hidden>
        <img
          src={AUTH_LOGIN_HERO_SRC}
          alt=""
          className="auth-showcase-hero-photo max-h-[82vh] w-auto max-w-[min(100%,46vw)]"
          width={1536}
          height={1024}
          decoding="async"
          fetchPriority="low"
        />
      </div>

      <div className="auth-showcase-content">
        <div className="auth-showcase-brand">
          <AuthBrand />
        </div>

        <div className="auth-showcase-copy">
          <h2 className="font-extrabold tracking-[-0.045em] text-[#12182A]">
            Simplify Conversations.
            <br />
            <span className="whitespace-nowrap text-[#0A8954]">
              Strengthen Relationships.
              <IconSparkle className="mb-[0.14em] ml-2 inline-block h-[0.36em] w-[0.36em] align-baseline text-[#0A8954]" />
            </span>
          </h2>
          <p className="font-medium tracking-[-0.012em] text-slate-500">
            A simple platform to automate WhatsApp, manage chats and grow your business.
          </p>
        </div>

        <ul className="auth-showcase-features">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <li key={title} className="flex min-h-0 items-start gap-3">
              <span className="auth-feature-icon mt-0.5">
                <Icon />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="auth-feature-title font-black tracking-[-0.024em] text-[#0B1220]">
                  {title}
                </p>
                <p className="auth-feature-desc font-semibold tracking-[-0.01em] text-slate-600">
                  {description}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div className="auth-showcase-cta">
          <AuthCtaCard />
        </div>
      </div>
    </div>
  );
}

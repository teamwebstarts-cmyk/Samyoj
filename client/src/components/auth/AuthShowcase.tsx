import type { ComponentType } from 'react';
import { Lightbulb, Settings2 } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import AuthBrand from './AuthBrand';
import { IconBarChart, IconBolt } from './AuthIcons';

export const AUTH_LOGIN_HERO_SRC = '/brand/auth-workspace-illustration.png';

type AuthIcon = ComponentType<{ className?: string }>;

const FEATURES: {
  icon: AuthIcon;
  title: string;
  description: string;
  iconVariant: 'channels' | 'automate' | 'grow';
}[] = [
  {
    icon: IconBolt,
    iconVariant: 'channels',
    title: 'All Your Channels, One Place',
    description: 'WhatsApp, Facebook, Instagram, Email and more.',
  },
  {
    icon: Settings2,
    iconVariant: 'automate',
    title: 'Automate & Save Time',
    description: 'Smart automations, AI-powered responses and workflows.',
  },
  {
    icon: IconBarChart,
    iconVariant: 'grow',
    title: 'Engage & Grow',
    description: 'Turn conversations into customers and build lasting relationships.',
  },
];

const ICON_WELL =
  'flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#F3EEFF] text-[#732BFD]';

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
            className="auth-link mt-1 inline-flex text-[13.5px] font-semibold"
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
          className="auth-link mt-1 inline-flex text-[13.5px] font-semibold"
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
          className="auth-showcase-hero-photo"
          width={1536}
          height={1024}
          decoding="async"
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
            <span className="auth-showcase-headline-gradient">Grow Your Business.</span>
          </h2>
          <p className="auth-showcase-sub font-medium tracking-[-0.018em] text-slate-500">
            <span className="auth-showcase-sub__line">
              Manage WhatsApp, Instagram, Facebook, Email and more from a single .
            </span>
            <span className="auth-showcase-sub__line">
            platform Automate, engage and grow your business with Samyoj.
            </span>
          </p>
        </div>

        <ul className="auth-showcase-features">
          {FEATURES.map(({ icon: Icon, title, description, iconVariant }) => (
            <li key={title} className="flex min-h-0 items-start gap-3">
              <span className={`auth-feature-icon auth-feature-icon--${iconVariant} mt-0.5`}>
                {iconVariant === 'automate' ? (
                  <Settings2 className="h-[50%] w-[50%]" strokeWidth={1.75} />
                ) : (
                  <Icon />
                )}
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="auth-feature-title font-bold tracking-[-0.024em] text-[#0B1220]">
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

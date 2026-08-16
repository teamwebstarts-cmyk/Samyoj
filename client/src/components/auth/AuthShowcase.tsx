import type { ComponentType } from 'react';
import { Lightbulb } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import AuthBrand from './AuthBrand';
import { IconMessageBubble, IconSparkle, IconTeam, IconWhatsAppW } from './AuthIcons';

export const AUTH_LOGIN_HERO_SRC = '/brand/auth-login-hero.png';

type AuthIcon = ComponentType<{ className?: string }>;

const FEATURES: { icon: AuthIcon; title: string; description: string }[] = [
  {
    icon: IconWhatsAppW,
    title: 'Automate Smartly',
    description: 'Save time with intelligent automation.',
  },
  {
    icon: IconMessageBubble,
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
      <div className="flex max-w-[min(100%,380px)] items-center gap-3.5 rounded-[18px] bg-white px-4 py-3.5 shadow-[0_8px_28px_rgba(15,23,42,0.07)]">
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
    <div className="flex max-w-[min(100%,380px)] items-center gap-3.5 rounded-[18px] bg-white px-4 py-3.5 shadow-[0_8px_28px_rgba(15,23,42,0.07)]">
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

const HERO_BOTTOM_MASK = 'linear-gradient(to top, transparent 0%, black 12%, black 100%)';

export default function AuthShowcase() {
  return (
    <div className="relative flex h-full min-h-0 w-full flex-col overflow-hidden font-sans antialiased">
      <div
        className="pointer-events-none absolute bottom-[11%] right-[-12%] z-[1] h-auto w-[min(108%,860px)] max-h-[min(86%,860px)] select-none"
        aria-hidden
      >
        <img
          src={AUTH_LOGIN_HERO_SRC}
          alt=""
          className="absolute inset-x-0 bottom-0 h-auto w-full object-contain object-bottom object-right opacity-25 blur-[6px]"
        />
        <img
          src={AUTH_LOGIN_HERO_SRC}
          alt=""
          className="relative h-auto w-full object-contain object-bottom object-right"
          style={{
            WebkitMaskImage: HERO_BOTTOM_MASK,
            maskImage: HERO_BOTTOM_MASK,
          }}
        />
        <div className="absolute inset-x-0 bottom-0 h-[12%] bg-gradient-to-t from-[#F4F7F5]/70 to-transparent" />
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-10 pb-10 pt-12 xl:px-14 xl:pb-12 xl:pt-14">
        <div className="shrink-0">
          <AuthBrand />
        </div>

        <div className="mt-10 max-w-[min(100%,34.5rem)] xl:mt-12">
          <h2 className="text-[clamp(2.05rem,3vw,3.1rem)] font-extrabold leading-[1.12] tracking-[-0.045em] text-[#12182A]">
            Simplify Conversations.
            <br />
            <span className="whitespace-nowrap text-[#0A8954]">
              Strengthen Relationships.
              <IconSparkle className="mb-[0.14em] ml-2 inline-block h-[0.36em] w-[0.36em] align-baseline text-[#0A8954]" />
            </span>
          </h2>
          <p className="mt-4 max-w-[26.5rem] text-[clamp(14.5px,1.15vw,16px)] font-medium leading-[1.55] tracking-[-0.012em] text-slate-500">
            A simple platform to automate WhatsApp, manage chats and grow your business.
          </p>
        </div>

        <ul className="mt-10 w-full max-w-[min(100%,18.5rem)] space-y-6 xl:mt-12 xl:space-y-7">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <li key={title} className="flex items-start gap-3.5">
              <span className={`mt-0.5 ${ICON_WELL}`}>
                <Icon className="h-6 w-6" />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-[17.5px] font-black leading-tight tracking-[-0.024em] text-[#0B1220]">
                  {title}
                </p>
                <p className="mt-1 max-w-[15.5rem] text-[13.5px] font-semibold leading-snug tracking-[-0.01em] text-slate-600">
                  {description}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <div className="relative z-20 mt-auto max-w-[min(100%,400px)] pt-10">
          <AuthCtaCard />
        </div>
      </div>
    </div>
  );
}

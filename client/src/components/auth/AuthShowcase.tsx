import type { ComponentType } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AuthBrand from './AuthBrand';

export const AUTH_LOGIN_HERO_SRC = '/brand/auth-workspace-illustration.png';

/**
 * Floating channel cards around the hero photo.
 * Desktop: absolutely placed around the photo (positions mirror the design).
 * Mobile: a two-row grid under the copy (absolute deps would overlap the text).
 */
const CHANNELS: {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  tone: string;
}[] = [
  { key: 'instagram', label: 'Instagram', icon: IconInstagram, tone: 'instagram' },
  { key: 'whatsapp', label: 'WhatsApp', icon: IconWhatsApp, tone: 'whatsapp' },
  { key: 'facebook', label: 'Facebook', icon: IconFacebook, tone: 'facebook' },
  { key: 'email', label: 'Email', icon: IconMail, tone: 'email' },
  { key: 'ai', label: 'AI Studio', icon: IconSparkle, tone: 'ai' },
];

function IconInstagram({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" stroke="url(#ig-g)" strokeWidth="1.9" />
      <circle cx="12" cy="12" r="4.3" stroke="url(#ig-g)" strokeWidth="1.9" />
      <circle cx="17.3" cy="6.8" r="1.25" fill="#F9506F" />
      <defs>
        <linearGradient id="ig-g" x1="3" y1="21" x2="21" y2="3" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFC107" />
          <stop offset="0.45" stopColor="#F9506F" />
          <stop offset="1" stopColor="#A430C8" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function IconWhatsApp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#25D366"
        d="M12 2.2a9.7 9.7 0 0 0-8.3 14.7L2.2 21.8l5.1-1.4A9.7 9.7 0 1 0 12 2.2Z"
      />
      <path
        fill="#fff"
        d="M8.7 7.5c.2-.4.4-.4.6-.4h.5c.2 0 .4 0 .6.5l.8 1.9c.1.2 0 .4-.1.6l-.5.6c-.2.2-.2.3-.1.5.5.9 1.4 1.9 2.4 2.4.2.1.4.1.5-.1l.6-.7c.2-.2.3-.2.6-.1l1.8.8c.3.2.5.3.5.4 0 .2 0 1-.5 1.5-.5.6-1.3.9-2.2.7-1.7-.3-3.4-1.5-4.6-2.7-1-1-1.7-2.1-1.9-3.1-.2-.9.1-1.6.5-2.1Z"
      />
    </svg>
  );
}

function IconFacebook({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="10.5" fill="#1877F2" />
      <path
        fill="#fff"
        d="M15.4 13.3l.5-3.2h-3.1V8c0-.9.4-1.7 1.8-1.7h1.4V3.6S14.7 3.3 13.5 3.3c-2.4 0-3.9 1.5-3.9 4.1v2.7H6.7v3.2h2.9V21h3.7v-7.7h2.1Z"
      />
    </svg>
  );
}

function IconMail({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M2.5 6.6 12 13.4l9.5-6.8v9.1a1.7 1.7 0 0 1-1.7 1.7H4.2a1.7 1.7 0 0 1-1.7-1.7V6.6Z" />
      <path fill="#EA4335" d="M2.5 6.6A1.7 1.7 0 0 1 4.2 4.9h15.6a1.7 1.7 0 0 1 1.7 1.7L12 13.4 2.5 6.6Z" opacity="0" />
      <path fill="#C5221F" d="M2.5 6.6 12 13.4l9.5-6.8v.9L12 14.5 2.5 7.5v-.9Z" />
      <path fill="#34A853" d="M2.5 16.8V6.6L12 13.4v1.3L4.2 20.6a1.7 1.7 0 0 1-1.7-1.7Z" />
      <path fill="#FBBC04" d="M21.5 16.8V6.6L12 13.4v1.3l7.8 5.9a1.7 1.7 0 0 0 1.7-1.7Z" />
    </svg>
  );
}

function IconSparkle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#A855F7"
        d="M12 2.8l1.9 5.4 5.3 1.9-5.3 1.9L12 17.4l-1.9-5.4L4.8 10.1l5.3-1.9L12 2.8Z"
      />
      <path fill="#7C3AED" d="M18.6 15.2l.9 2.5 2.4.9-2.4.9-.9 2.5-.9-2.5-2.4-.9 2.4-.9.9-2.5Z" />
    </svg>
  );
}

function ChannelCard({
  channel,
  className = '',
}: {
  channel: (typeof CHANNELS)[number];
  className?: string;
}) {
  const Icon = channel.icon;
  const ai = channel.key === 'ai';
  return (
    <div
      className={`auth-channel-card auth-channel-card--${channel.tone} ${
        ai ? 'h-[4.75rem]' : 'h-14'
      } ${className}`}
    >
      <span className="auth-channel-card__tile">
        <Icon className="h-[19px] w-[19px]" />
      </span>
      <span className="auth-channel-card__label">
        <span className="auth-channel-card__title">{channel.label}</span>
        {ai ? <span className="auth-channel-card__desc">Create content with AI</span> : null}
      </span>
      {ai ? <span className="auth-channel-card__badge">NEW</span> : null}
    </div>
  );
}

export function AuthCtaCard() {
  const { pathname } = useLocation();
  const isRegister = pathname.startsWith('/register');

  return (
    <div className="auth-cta-card">
      <span className="auth-cta-card__well" aria-hidden>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path d="M9 18h6M10 21h4" strokeLinecap="round" />
          <path d="M12 3a6 6 0 0 0-3.6 10.8c.5.4.8 1 .8 1.7h5.6c0-.7.3-1.3.8-1.7A6 6 0 0 0 12 3Z" />
        </svg>
      </span>
      <div className="min-w-0">
        <p className="auth-cta-card__text">
          <span className="auth-cta-card__strong">
            {isRegister ? 'Already have an account?' : 'New here?'}
          </span>{' '}
          {isRegister
            ? 'Sign in to continue to your workspace.'
            : 'Create your account and get started in minutes.'}
        </p>
        <Link
          to={isRegister ? '/login' : '/register'}
          className="auth-link auth-cta-card__link"
        >
          {isRegister ? 'Sign in' : 'Create one free'} <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}

export default function AuthShowcase() {
  const byKey = Object.fromEntries(CHANNELS.map((c) => [c.key, c]));

  return (
    <div className="auth-showcase font-sans antialiased">
      <div className="auth-showcase-orbs" aria-hidden />

      <div className="auth-showcase-hero" aria-hidden>
        <img
          src={AUTH_LOGIN_HERO_SRC}
          alt=""
          className="auth-showcase-hero-photo"
          width={1492}
          height={1054}
          decoding="async"
          fetchPriority="high"
        />
      </div>

      <div className="auth-showcase-content">
        <div className="auth-showcase-brand">
          <AuthBrand />
        </div>

        <div className="auth-showcase-copy">
          <h2 className="font-extrabold">
            Simplify Conversations.
            <br />
            <span className="auth-showcase-headline-gradient">Grow Your Business.</span>
          </h2>
          <p className="auth-showcase-sub font-medium">
            Manage WhatsApp, Instagram, Facebook, Email and more from a single platform.
            Automate, engage and grow your business with Samyoj.
          </p>

          <div className="auth-showcase-channels" aria-hidden>
            {CHANNELS.map((channel) => (
              <ChannelCard key={channel.key} channel={channel} />
            ))}
          </div>
        </div>

        <div className="auth-showcase-channel-float" aria-hidden>
          <ChannelCard channel={byKey.instagram} className="auth-channel-card--pos-instagram" />
          <ChannelCard channel={byKey.whatsapp} className="auth-channel-card--pos-whatsapp" />
          <ChannelCard channel={byKey.facebook} className="auth-channel-card--pos-facebook" />
          <ChannelCard channel={byKey.email} className="auth-channel-card--pos-email" />
          <ChannelCard channel={byKey.ai} className="auth-channel-card--pos-ai" />
        </div>

        <ul className="auth-showcase-features">
          <li className="auth-feature">
            <span className="auth-feature-icon auth-feature-icon--channels" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <circle cx="6" cy="6" r="2.4" />
                <circle cx="18" cy="6" r="2.4" />
                <circle cx="12" cy="18" r="2.4" />
                <path d="M8.2 7.2 10.4 16m5.4-8.8L13.6 16" strokeLinecap="round" />
              </svg>
            </span>
            <div>
              <p className="auth-feature-title">All Your Channels, One Place</p>
              <p className="auth-feature-desc">WhatsApp, Instagram, Facebook, Email and more.</p>
            </div>
          </li>
          <li className="auth-feature">
            <span className="auth-feature-icon auth-feature-icon--automate" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <p className="auth-feature-title">Automate &amp; Save Time</p>
              <p className="auth-feature-desc">
                Smart automations, AI-powered responses and workflows.
              </p>
            </div>
          </li>
          <li className="auth-feature">
            <span className="auth-feature-icon auth-feature-icon--grow" aria-hidden>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path d="M4 20V10m5 10V4m5 16v-7m5 7V8" strokeLinecap="round" />
              </svg>
            </span>
            <div>
              <p className="auth-feature-title">Engage &amp; Grow</p>
              <p className="auth-feature-desc">
                Turn conversations into customers and build lasting relationships.
              </p>
            </div>
          </li>
        </ul>

        <div className="auth-showcase-cta">
          <AuthCtaCard />
        </div>
      </div>
    </div>
  );
}

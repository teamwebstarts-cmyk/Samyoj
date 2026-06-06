import { Link } from 'react-router-dom';
import { Bot, PhoneCall, Settings } from 'lucide-react';
import AppButton from '../ui/AppButton';

interface CallPlaceholderProps {
  variant?: 'empty' | 'select' | 'setup';
  setupAction?: 'settings' | 'enable' | 'bot';
  onEnable?: () => void;
  enabling?: boolean;
  enableHints?: string[];
}

export default function CallPlaceholder({
  variant = 'select',
  setupAction,
  onEnable,
  enabling,
  enableHints = [],
}: CallPlaceholderProps) {
  if (variant === 'setup') {
    const copy = {
      settings: {
        title: 'Connect WhatsApp',
        text: 'Link your business number to start receiving voice calls.',
        icon: Settings,
        cta: 'Open Settings',
        to: '/settings',
      },
      enable: {
        title: 'Turn on calls',
        text: 'Enable voice calling so customers can reach you on WhatsApp.',
        icon: PhoneCall,
        cta: 'Enable now',
        to: null,
      },
      bot: {
        title: 'Set up your AI bot',
        text: 'Create an active bot to answer calls on your behalf.',
        icon: Bot,
        cta: 'Go to AI Bots',
        to: '/ai-bot',
      },
    }[setupAction || 'settings'];

    const Icon = copy.icon;

    return (
      <div className="inbox-chat-bg flex flex-1 flex-col items-center justify-center p-8">
        <div className="relative">
          <div className="pointer-events-none absolute -inset-10 rounded-full bg-violet-500/10 blur-3xl" />
          <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-50 to-white shadow-panel ring-1 ring-violet-100">
            <Icon className="h-9 w-9 text-violet-600" strokeWidth={1.75} />
          </div>
        </div>
        <h2 className="mt-6 text-lg font-extrabold tracking-tight text-neutral-900">{copy.title}</h2>
        <p className="mt-2 max-w-sm text-center text-[13px] font-medium leading-relaxed text-neutral-600">
          {copy.text}
        </p>
        {setupAction === 'enable' && enableHints.length > 0 && (
          <ul className="mt-5 max-w-md space-y-2 text-left">
            {enableHints.map((hint) => (
              <li
                key={hint}
                className="flex gap-2 rounded-xl border border-amber-200/70 bg-amber-50/80 px-3 py-2 text-[12px] font-medium leading-relaxed text-amber-950"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                {hint}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-6">
          {copy.to ? (
            <Link to={copy.to}>
              <AppButton>{copy.cta}</AppButton>
            </Link>
          ) : (
            <AppButton loading={enabling} onClick={onEnable}>
              {copy.cta}
            </AppButton>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'empty') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-10 text-center">
        <div className="relative">
          <div className="pointer-events-none absolute -inset-6 rounded-full bg-violet-500/10 blur-2xl" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-white shadow-panel ring-1 ring-violet-100">
            <PhoneCall className="h-7 w-7 text-violet-600" strokeWidth={1.75} />
          </div>
        </div>
        <h3 className="mt-5 text-[15px] font-extrabold text-neutral-900">No calls yet</h3>
        <p className="mt-2 max-w-[260px] text-[12px] font-medium leading-relaxed text-neutral-500">
          When a customer calls your WhatsApp number, it appears here with date, duration, and full transcript.
        </p>
        <p className="mt-4 rounded-full border border-neutral-200/80 bg-neutral-50 px-3 py-1.5 text-[11px] font-semibold text-neutral-600">
          Make sure setup above is complete
        </p>
      </div>
    );
  }

  return (
    <div className="inbox-chat-bg flex flex-1 flex-col items-center justify-center p-8">
      <div className="relative">
        <div className="pointer-events-none absolute -inset-10 rounded-full bg-gradient-to-br from-violet-500/15 to-whatsapp-500/10 blur-3xl" />
        <div className="relative flex h-24 w-24 items-center justify-center rounded-[1.75rem] bg-gradient-to-br from-white to-emerald-50 shadow-panel ring-1 ring-emerald-100/80">
          <PhoneCall className="h-10 w-10 text-whatsapp-600" strokeWidth={1.5} />
        </div>
      </div>
      <h2 className="mt-6 text-xl font-extrabold tracking-tight text-neutral-900">Select a call</h2>
      <p className="mt-2 max-w-sm text-center text-[13px] font-medium leading-relaxed text-neutral-600">
        Pick any call from the list to read the full voice conversation between your customer and AI bot.
      </p>
      <div className="mt-6 grid max-w-xs gap-2 text-left">
        {[
          'See who called and when',
          'Read the full voice transcript',
          'End live calls from here',
        ].map((tip) => (
          <div
            key={tip}
            className="flex items-center gap-2 rounded-xl border border-white/80 bg-white/70 px-3 py-2 text-[12px] font-medium text-neutral-700 shadow-sm backdrop-blur-sm"
          >
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-whatsapp-500" />
            {tip}
          </div>
        ))}
      </div>
    </div>
  );
}

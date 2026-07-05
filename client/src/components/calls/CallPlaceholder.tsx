import { Link } from 'react-router-dom';
import {
  Bot,
  Clock3,
  FileText,
  PhoneCall,
  PhoneIncoming,
  Settings,
  Timer,
} from 'lucide-react';
import AppButton from '../ui/AppButton';
import EmptyState from '../ui/EmptyState';

function CallsEmptyState() {
  const features = [
    { icon: Clock3, label: 'When', hint: 'Date & time' },
    { icon: Timer, label: 'Duration', hint: 'Call length' },
    { icon: FileText, label: 'Transcript', hint: 'Full conversation' },
  ];

  return (
    <div className="inbox-placeholder-bg flex h-full min-h-0 flex-1 flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-[380px] text-center">
        <div className="relative mx-auto flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-[0_8px_24px_rgba(99,102,241,0.35)]">
          <PhoneIncoming className="h-7 w-7" strokeWidth={1.85} />
        </div>

        <h2 className="mt-6 text-xl font-bold tracking-tight text-theme-fg">No calls yet</h2>
        <p className="mx-auto mt-2 max-w-[300px] text-[14px] leading-relaxed text-theme-secondary">
          When a customer calls your WhatsApp number, every conversation appears here automatically.
        </p>

        <div className="mt-8 grid grid-cols-3 gap-2">
          {features.map(({ icon: Icon, label, hint }) => (
            <div
              key={label}
              className="flex flex-col items-center rounded-xl border border-white/70 bg-white/80 px-2 py-3 shadow-sm backdrop-blur-sm dark:border-neutral-700/60 dark:bg-neutral-900/75"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300">
                <Icon className="h-4 w-4" strokeWidth={2} />
              </div>
              <p className="mt-2 text-[11px] font-bold text-theme-fg">{label}</p>
              <p className="mt-0.5 text-[10px] leading-tight text-theme-muted">{hint}</p>
            </div>
          ))}
        </div>

        <p className="mx-auto mt-6 inline-flex items-center gap-2 rounded-full border border-violet-200/60 bg-violet-50/80 px-4 py-2 text-[12px] font-semibold text-violet-700 dark:border-violet-500/20 dark:bg-violet-950/40 dark:text-violet-300">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-50" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-violet-500" />
          </span>
          Complete setup above to go live
        </p>
      </div>
    </div>
  );
}

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
        title: 'Connect WhatsApp first',
        text: 'Link your business number in Settings to start receiving voice calls.',
        icon: Settings,
        cta: 'Go to Settings',
        to: '/settings',
        steps: ['Open Settings', 'Connect your WhatsApp number', 'Come back here to enable calls'],
      },
      enable: {
        title: 'Turn on voice calls',
        text: 'Enable calling so customers can reach you directly on WhatsApp.',
        icon: PhoneCall,
        cta: 'Enable now',
        to: null,
        steps: ['Tap Enable now below', 'Wait a few seconds for setup', 'You are ready to receive calls'],
      },
      bot: {
        title: 'Set up your AI assistant',
        text: 'Create an active bot that can answer calls for you, 24/7.',
        icon: Bot,
        cta: 'Go to AI Bots',
        to: '/ai-bot',
        steps: ['Open AI Bots', 'Create and turn on a bot', 'Return here to test calls'],
      },
    }[setupAction || 'settings'];

    const Icon = copy.icon;

    return (
      <div className="inbox-chat-bg flex flex-col items-center justify-center p-10 sm:p-14">
        <EmptyState
          icon={Icon}
          title={copy.title}
          description={copy.text}
          steps={setupAction === 'enable' && enableHints.length > 0 ? enableHints : copy.steps}
          compact
          className="w-full max-w-lg border-0 bg-transparent shadow-none"
          action={
            copy.to ? (
              <Link to={copy.to}>
                <AppButton>{copy.cta}</AppButton>
              </Link>
            ) : (
              <AppButton loading={enabling} onClick={onEnable}>
                {copy.cta}
              </AppButton>
            )
          }
        />
      </div>
    );
  }

  if (variant === 'empty') {
    return <CallsEmptyState />;
  }

  return (
    <div className="inbox-placeholder-bg flex h-full min-h-0 flex-1 flex-col items-center justify-center px-6 py-8">
      <div className="w-full max-w-[380px] text-center">
        <div className="relative mx-auto flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 text-white shadow-[0_8px_24px_rgba(99,102,241,0.35)]">
          <PhoneCall className="h-7 w-7" strokeWidth={1.85} />
        </div>

        <h2 className="mt-6 text-xl font-bold tracking-tight text-theme-fg">Select a call</h2>
        <p className="mx-auto mt-2 max-w-[300px] text-[14px] leading-relaxed text-theme-secondary">
          Pick a call from the list to view the transcript, duration, and handler details.
        </p>

        <div className="mt-8 grid grid-cols-3 gap-2">
          {[
            { icon: Clock3, label: 'When', hint: 'Date & time' },
            { icon: Timer, label: 'Duration', hint: 'Call length' },
            { icon: FileText, label: 'Transcript', hint: 'Full conversation' },
          ].map(({ icon: Icon, label, hint }) => (
            <div
              key={label}
              className="flex flex-col items-center rounded-xl border border-white/70 bg-white/80 px-2 py-3 shadow-sm backdrop-blur-sm dark:border-neutral-700/60 dark:bg-neutral-900/75"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300">
                <Icon className="h-4 w-4" strokeWidth={2} />
              </div>
              <p className="mt-2 text-[11px] font-bold text-theme-fg">{label}</p>
              <p className="mt-0.5 text-[10px] leading-tight text-theme-muted">{hint}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

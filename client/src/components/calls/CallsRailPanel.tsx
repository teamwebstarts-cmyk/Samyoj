import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  ClipboardList,
  HelpCircle,
  Inbox,
  PhoneIncoming,
  PhoneOutgoing,
  Settings2,
  X,
} from 'lucide-react';

export type CallsRailPanelId = 'settings' | 'help';

interface CallsRailPanelProps {
  panel: CallsRailPanelId;
  onClose: () => void;
  onOpenSetup: () => void;
}

function PanelHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
      <p className="text-[13px] font-extrabold tracking-tight text-theme-fg">{title}</p>
      <button
        type="button"
        className="rounded-lg p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800"
        onClick={onClose}
        aria-label="Close panel"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function ActionRow({
  to,
  onClick,
  icon: Icon,
  title,
  description,
  accent = 'neutral',
}: {
  to?: string;
  onClick?: () => void;
  icon: React.ComponentType<{ className?: string; strokeWidth?: string | number }>;
  title: string;
  description: string;
  accent?: 'emerald' | 'violet' | 'amber' | 'neutral';
}) {
  const accents = {
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
    violet: 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
    neutral: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
  };

  const className =
    'group flex w-full items-start gap-3 rounded-xl border border-neutral-200/90 bg-white px-3 py-3 text-left transition hover:border-neutral-300 hover:bg-neutral-50/80 dark:border-neutral-800 dark:bg-neutral-950 dark:hover:border-neutral-700 dark:hover:bg-neutral-900/60';

  const body = (
    <>
      <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${accents[accent]}`}>
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-bold text-theme-fg">{title}</span>
          <ArrowRight className="h-3.5 w-3.5 shrink-0 text-neutral-300 transition group-hover:translate-x-0.5 group-hover:text-neutral-500 dark:text-neutral-600" />
        </span>
        <span className="mt-0.5 block text-[11px] font-medium leading-snug text-theme-muted">{description}</span>
      </span>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={className}>
        {body}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {body}
    </button>
  );
}

function SettingsBody({ onOpenSetup }: { onOpenSetup: () => void }) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-neutral-200/80 bg-neutral-50/80 px-3.5 py-3 dark:border-neutral-800 dark:bg-neutral-900/40">
        <p className="text-[12px] font-bold text-theme-fg">Call behavior</p>
        <p className="mt-1 text-[11px] font-medium leading-relaxed text-theme-muted">
          Who answers, greetings, after-hours, and voice live in one place — Settings → Calling.
        </p>
      </div>

      <div className="space-y-2">
        <p className="px-0.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">Quick links</p>
        <ActionRow
          to="/settings?tab=calling"
          icon={Settings2}
          accent="emerald"
          title="Call settings"
          description="Who answers, greetings, missed calls, voice"
        />
        <ActionRow
          to="/ai-bot"
          icon={Bot}
          accent="violet"
          title="AI personality"
          description="Tone, business facts, and training for voice + chat"
        />
        <ActionRow
          onClick={onOpenSetup}
          icon={ClipboardList}
          accent="amber"
          title="Setup checklist"
          description="WhatsApp, calling enabled, and bot ready"
        />
      </div>
    </div>
  );
}

function HelpBody({ onOpenSetup }: { onOpenSetup: () => void }) {
  const tips = [
    {
      icon: PhoneOutgoing,
      title: 'Outbound',
      body: 'Start a call from Inbox — no tunnel needed.',
    },
    {
      icon: PhoneIncoming,
      title: 'Inbound',
      body: 'Callers need calling enabled on your WhatsApp number.',
    },
    {
      icon: Bot,
      title: 'One brain',
      body: 'Train answers on AI Bots → Train so voice and chat stay aligned.',
    },
  ];

  return (
    <div className="space-y-3">
      {tips.map((tip) => (
        <div
          key={tip.title}
          className="flex gap-3 rounded-xl border border-neutral-200/90 bg-white px-3 py-3 dark:border-neutral-800 dark:bg-neutral-950"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            <tip.icon className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="text-[12px] font-bold text-theme-fg">{tip.title}</p>
            <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-theme-muted">{tip.body}</p>
          </div>
        </div>
      ))}

      <div className="space-y-2 pt-1">
        <Link
          to="/ai-bot"
          className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-3 py-2.5 text-[12px] font-bold text-emerald-800 transition hover:bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300"
        >
          <span className="inline-flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Open AI Bots → Train
          </span>
          <ArrowRight className="h-3.5 w-3.5 opacity-70" />
        </Link>
        <button
          type="button"
          onClick={onOpenSetup}
          className="flex w-full items-center justify-between gap-2 rounded-xl border border-neutral-200 px-3 py-2.5 text-[12px] font-bold text-theme-secondary transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
        >
          <span className="inline-flex items-center gap-2">
            <HelpCircle className="h-3.5 w-3.5" />
            Open setup guide
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-neutral-400" />
        </button>
        <Link
          to="/inbox"
          className="flex items-center gap-2 px-1 text-[11px] font-semibold text-theme-muted hover:text-theme-secondary"
        >
          <Inbox className="h-3 w-3" />
          Go to Inbox to place a call
        </Link>
      </div>
    </div>
  );
}

export default function CallsRailPanel({ panel, onClose, onOpenSetup }: CallsRailPanelProps) {
  const title = panel === 'settings' ? 'Customize' : 'Help';

  return (
    <div className="absolute inset-y-0 right-[72px] z-20 flex w-[min(100%,300px)] flex-col border-l border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-950 md:static md:z-0 md:w-[260px] md:shadow-none lg:w-[280px]">
      <PanelHeader title={title} onClose={onClose} />
      <div className="min-h-0 flex-1 overflow-y-auto p-3.5 sm:p-4">
        {panel === 'settings' && (
          <SettingsBody
            onOpenSetup={() => {
              onOpenSetup();
              onClose();
            }}
          />
        )}
        {panel === 'help' && (
          <HelpBody
            onOpenSetup={() => {
              onOpenSetup();
              onClose();
            }}
          />
        )}
      </div>
    </div>
  );
}

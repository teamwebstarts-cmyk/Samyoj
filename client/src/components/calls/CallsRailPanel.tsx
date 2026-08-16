import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Inbox,
  PhoneIncoming,
  PhoneOutgoing,
  X,
} from 'lucide-react';

export type CallsRailPanelId = 'help';

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

function HelpBody({ onOpenSetup }: { onOpenSetup: () => void }) {
  const tips = [
    {
      icon: PhoneOutgoing,
      title: 'Outgoing',
      body: 'Start a call from Inbox — no tunnel needed.',
    },
    {
      icon: PhoneIncoming,
      title: 'Incoming',
      body: 'Callers need calling enabled on your WhatsApp number.',
    },
    {
      icon: PhoneOutgoing,
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
            <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-theme-muted">
              {tip.body}
            </p>
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
  const title = panel === 'help' ? 'Help' : 'Help';

  return (
    <div className="absolute inset-y-0 right-[72px] z-20 flex w-[min(100%,300px)] flex-col border-l border-neutral-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-950 md:static md:z-0 md:w-[260px] md:shadow-none lg:w-[280px]">
      <PanelHeader title={title} onClose={onClose} />
      <div className="min-h-0 flex-1 overflow-y-auto p-3.5 sm:p-4">
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

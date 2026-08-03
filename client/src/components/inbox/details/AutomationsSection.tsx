import { GitBranch, Handshake } from 'lucide-react';
import { formatHandoffReason } from '../inboxUtils';
import type { Conversation } from '../../../types';

interface AutomationsSectionProps {
  conversation: Conversation;
  botIsLive: boolean;
}

function formatHandoffWhen(iso?: string | null) {
  if (!iso) return '';
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AutomationsSection({ conversation, botIsLive }: AutomationsSectionProps) {
  const botName = conversation.activeBot?.name || 'Default bot';
  const flow = conversation.activeFlow;
  const handedOff = Boolean(conversation.botHandoffAt);
  const handoffReason = formatHandoffReason(conversation.botHandoffReason) || 'Sent to team';
  const handoffWhen = formatHandoffWhen(conversation.botHandoffAt);

  return (
    <div className="space-y-2">
      <div className="rounded-xl border border-slate-200/80 bg-slate-50/80 px-3 py-2.5 dark:border-neutral-700/60 dark:bg-neutral-950/40">
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold tracking-tight text-theme-fg">{botName}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-theme-muted">
              {botIsLive ? 'Auto-replying' : 'Paused'}
              <span className="text-theme-muted/75"> · manage from header</span>
            </p>
          </div>
          <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${
              botIsLive
                ? 'bg-whatsapp-500/12 text-whatsapp-700 dark:bg-whatsapp-500/15 dark:text-whatsapp-400'
                : 'bg-neutral-200/80 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
            }`}
          >
            {botIsLive ? (
              <span className="h-1.5 w-1.5 rounded-full bg-whatsapp-500 dark:bg-whatsapp-400" aria-hidden />
            ) : null}
            {botIsLive ? 'Live' : 'Paused'}
          </span>
        </div>
      </div>

      {handedOff && (
        <div className="rounded-xl border border-sky-200/70 bg-sky-50/55 px-3 py-2.5 dark:border-sky-800/35 dark:bg-sky-950/20">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-sky-100/90 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300">
              <Handshake className="h-3.5 w-3.5" strokeWidth={2.1} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-semibold tracking-tight text-theme-fg">
                Handed off to agent
              </p>
              <p className="mt-0.5 truncate text-[11px] leading-snug text-theme-muted">
                {handoffReason}
                {handoffWhen ? ` · ${handoffWhen}` : ''}
              </p>
            </div>
          </div>
        </div>
      )}

      {flow && (
        <div className="rounded-xl border border-violet-200/60 bg-violet-50/45 px-3 py-2.5 dark:border-violet-800/35 dark:bg-violet-950/20">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-violet-100/90 text-violet-700 dark:bg-violet-900/45 dark:text-violet-300">
              <GitBranch className="h-3.5 w-3.5" strokeWidth={2.1} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-semibold tracking-tight text-theme-fg">
                {flow.flowName || 'Automation flow'}
              </p>
              <p className="mt-0.5 truncate text-[11px] leading-snug text-theme-muted">
                {flow.currentStepLabel || 'Running'}
                {flow.waitingFor ? ` · waiting for ${flow.waitingFor}` : ''}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

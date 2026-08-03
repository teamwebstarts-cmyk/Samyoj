import { Bot, GitBranch, Handshake, Zap } from 'lucide-react';
import { formatHandoffReason } from '../inboxUtils';
import type { Conversation } from '../../../types';

interface AutomationsSectionProps {
  conversation: Conversation;
  botIsLive: boolean;
}

export default function AutomationsSection({ conversation, botIsLive }: AutomationsSectionProps) {
  const botName = conversation.activeBot?.name || 'Default bot';
  const flow = conversation.activeFlow;
  const handedOff = Boolean(conversation.botHandoffAt);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3 rounded-xl bg-theme-subtle/50 px-3 py-2.5 ring-1 ring-theme-border/60">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
          <Zap className="h-4 w-4" strokeWidth={2.1} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-theme-fg">{botName}</p>
          <p className="inline-flex items-center gap-1 text-[11px] text-theme-muted">
            <Bot className="h-3 w-3" />
            {botIsLive ? 'Auto-replying' : 'Paused'}
            <span className="text-theme-muted/80">· manage from header</span>
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
            botIsLive
              ? 'bg-whatsapp-500/15 text-whatsapp-700 dark:text-whatsapp-400'
              : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
          }`}
        >
          {botIsLive ? 'Live' : 'Paused'}
        </span>
      </div>

      {handedOff && (
        <div className="flex items-center gap-3 rounded-xl bg-orange-50/80 px-3 py-2.5 ring-1 ring-orange-200/70 dark:bg-orange-950/25 dark:ring-orange-800/40">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300">
            <Handshake className="h-4 w-4" strokeWidth={2.1} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-theme-fg">Handed off to agent</p>
            <p className="truncate text-[11px] text-theme-muted">
              {formatHandoffReason(conversation.botHandoffReason) || 'Sent to team'}
              {conversation.botHandoffAt
                ? ` · ${new Date(conversation.botHandoffAt).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}`
                : ''}
            </p>
          </div>
        </div>
      )}

      {flow && (
        <div className="flex items-center gap-3 rounded-xl bg-violet-50/70 px-3 py-2.5 ring-1 ring-violet-200/60 dark:bg-violet-950/30 dark:ring-violet-500/20">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
            <GitBranch className="h-4 w-4" strokeWidth={2.1} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-theme-fg">
              {flow.flowName || 'Automation flow'}
            </p>
            <p className="truncate text-[11px] text-theme-muted">
              {flow.currentStepLabel || 'Running'}
              {flow.waitingFor ? ` · waiting for ${flow.waitingFor}` : ''}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

import { Bot, GitBranch, Zap } from 'lucide-react';
import type { Conversation } from '../../../types';

interface AutomationsSectionProps {
  conversation: Conversation;
  botIsLive: boolean;
  botToggling: boolean;
  onToggleBot: () => void;
}

function Toggle({ on, disabled, onClick, label }: { on: boolean; disabled?: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`relative h-[22px] w-10 shrink-0 rounded-full transition disabled:opacity-50 ${
        on ? 'bg-gradient-to-r from-whatsapp-500 to-whatsapp-600' : 'bg-neutral-300 dark:bg-neutral-700'
      }`}
    >
      <span
        className={`absolute top-[3px] h-4 w-4 rounded-full bg-white shadow transition-all ${
          on ? 'left-[22px]' : 'left-[3px]'
        }`}
      />
    </button>
  );
}

export default function AutomationsSection({
  conversation,
  botIsLive,
  botToggling,
  onToggleBot,
}: AutomationsSectionProps) {
  const botName = conversation.activeBot?.name || 'Default bot';
  const flow = conversation.activeFlow;

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
          </p>
        </div>
        <Toggle
          on={botIsLive}
          disabled={botToggling}
          onClick={onToggleBot}
          label={botIsLive ? 'Pause AI bot' : 'Enable AI bot'}
        />
      </div>

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

import { Activity, Bot, Handshake } from 'lucide-react';
import {
  DetailsSectionCard,
  DetailsSectionHeader,
} from './DetailsSectionCard';
import StatsRow from './StatsRow';
import { formatHandoffReason } from '../inboxUtils';
import type { Conversation } from '../../../types';

interface ConversationActivityProps {
  conversation: Conversation;
  botIsLive: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Open',
  PENDING: 'Pending',
  CLOSED: 'Closed',
  SNOOZED: 'Snoozed',
};

function formatAbsolute(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatRelative(iso?: string | null): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const diff = Date.now() - t;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}d ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-theme-border/50 py-2 last:border-b-0 last:pb-0 first:pt-0">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-theme-muted">
        {label}
      </span>
      <span className="min-w-0 truncate text-right text-[12.5px] font-semibold text-theme-fg">
        {value}
      </span>
    </div>
  );
}

/** Activity tab: real stats + compact conversation summary (no fake event history). */
export default function ConversationActivity({
  conversation,
  botIsLive,
}: ConversationActivityProps) {
  const status = STATUS_LABEL[conversation.status] || conversation.status;
  const opened = formatAbsolute(conversation.createdAt);
  const lastMessageAbs = formatAbsolute(conversation.lastMessageAt);
  const lastMessageRel = formatRelative(conversation.lastMessageAt);
  const lastMessage =
    lastMessageAbs && lastMessageRel
      ? `${lastMessageAbs} · ${lastMessageRel}`
      : lastMessageAbs || lastMessageRel;
  const assignee = conversation.assignedAgent?.name || 'Unassigned';
  const snoozedActive =
    Boolean(conversation.snoozedUntil) &&
    new Date(conversation.snoozedUntil!).getTime() > Date.now();
  const snoozedUntil = snoozedActive ? formatAbsolute(conversation.snoozedUntil) : null;
  const firstResponse = formatAbsolute(conversation.firstResponseAt);
  const handedOff = Boolean(conversation.botHandoffAt);
  const flow = conversation.activeFlow;
  // Only surface handling when there is live bot / handoff / flow — not a paused-default duplicate of Details → Automations.
  const showHandling = handedOff || botIsLive || Boolean(flow);

  return (
    <div className="space-y-2.5 px-3 py-3">
      <DetailsSectionCard data-section="stats" className="!px-0 !pb-0">
        <div className="px-3.5">
          <DetailsSectionHeader title="Stats" />
        </div>
        <StatsRow conversationId={conversation.id} />
      </DetailsSectionCard>

      <DetailsSectionCard data-section="conversation">
        <DetailsSectionHeader
          icon={<Activity className="h-3.5 w-3.5" strokeWidth={2.25} />}
          title="Conversation"
        />
        <div>
          <SummaryRow label="Status" value={status} />
          {opened && <SummaryRow label="Opened" value={opened} />}
          {lastMessage && <SummaryRow label="Last message" value={lastMessage} />}
          <SummaryRow label="Assignee" value={assignee} />
          {snoozedUntil && <SummaryRow label="Snoozed until" value={snoozedUntil} />}
          {firstResponse && <SummaryRow label="First response" value={firstResponse} />}
          {conversation.unreadCount > 0 && (
            <SummaryRow label="Unread" value={String(conversation.unreadCount)} />
          )}
        </div>
      </DetailsSectionCard>

      {showHandling && (
        <DetailsSectionCard data-section="handling">
          <DetailsSectionHeader
            icon={<Bot className="h-3.5 w-3.5" strokeWidth={2.25} />}
            title="Handling"
          />
          <div className="space-y-1.5">
            {(botIsLive || conversation.activeBot) && (
              <div className="flex items-center justify-between gap-2 rounded-xl bg-theme-subtle/50 px-3 py-2 ring-1 ring-theme-border/60">
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-semibold text-theme-fg">
                    {conversation.activeBot?.name || 'Bot'}
                  </p>
                  <p className="text-[11px] text-theme-muted">
                    {botIsLive ? 'Auto-replying' : 'Paused'}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                    botIsLive
                      ? 'bg-whatsapp-500/15 text-whatsapp-700 dark:text-whatsapp-400'
                      : 'bg-neutral-200 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
                  }`}
                >
                  {botIsLive ? 'Live' : 'Off'}
                </span>
              </div>
            )}

            {handedOff && (
              <div className="flex items-start gap-2.5 rounded-xl bg-orange-50/80 px-3 py-2 ring-1 ring-orange-200/70 dark:bg-orange-950/25 dark:ring-orange-800/40">
                <Handshake className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-700 dark:text-orange-300" />
                <div className="min-w-0">
                  <p className="text-[12.5px] font-semibold text-theme-fg">Handed off to agent</p>
                  <p className="truncate text-[11px] text-theme-muted">
                    {formatHandoffReason(conversation.botHandoffReason) || 'Sent to team'}
                    {conversation.botHandoffAt
                      ? ` · ${formatAbsolute(conversation.botHandoffAt)}`
                      : ''}
                  </p>
                </div>
              </div>
            )}

            {flow && (
              <p className="px-1 text-[11.5px] text-theme-muted">
                Flow: <span className="font-semibold text-theme-fg">{flow.flowName || 'Running'}</span>
                {flow.currentStepLabel ? ` · ${flow.currentStepLabel}` : ''}
              </p>
            )}
          </div>
        </DetailsSectionCard>
      )}

      <p className="px-1 pb-1 text-[11px] leading-relaxed text-theme-muted">
        No recent assignment or status-change events logged yet.
      </p>
    </div>
  );
}

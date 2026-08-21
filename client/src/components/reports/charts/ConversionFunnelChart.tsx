import { CheckCheck, Eye, MessageSquare, Send } from 'lucide-react';

interface ConversionFunnelChartProps {
  sent: number;
  delivered: number;
  read: number;
  repliedOrClicked: number;
}

export default function ConversionFunnelChart({
  sent,
  delivered,
  read,
  repliedOrClicked,
}: ConversionFunnelChartProps) {
  const base = Math.max(sent, 1);
  const deliveryPct = Number(((delivered / base) * 100).toFixed(1));
  const readPct = Number(((read / base) * 100).toFixed(1));
  const replyPct = Number(((repliedOrClicked / base) * 100).toFixed(1));

  const stages = [
    {
      label: 'Sent',
      count: sent,
      pct: 100,
      icon: Send,
      gradient: 'from-emerald-500 to-teal-600',
      bg: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300',
    },
    {
      label: 'Delivered',
      count: delivered,
      pct: deliveryPct,
      icon: CheckCheck,
      gradient: 'from-teal-500 to-sky-600',
      bg: 'bg-teal-50 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300',
      dropOff: `${(100 - deliveryPct).toFixed(1)}% undelivered`,
    },
    {
      label: 'Read',
      count: read,
      pct: readPct,
      icon: Eye,
      gradient: 'from-sky-500 to-blue-600',
      bg: 'bg-sky-50 text-sky-800 dark:bg-sky-950/50 dark:text-sky-300',
      dropOff: `${(deliveryPct - readPct).toFixed(1)}% unread`,
    },
    {
      label: 'Interacted / Replied',
      count: repliedOrClicked,
      pct: replyPct,
      icon: MessageSquare,
      gradient: 'from-violet-500 to-purple-600',
      bg: 'bg-violet-50 text-violet-800 dark:bg-violet-950/50 dark:text-violet-300',
      dropOff: `${(readPct - replyPct).toFixed(1)}% no response`,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold tracking-tight text-theme-fg">Message Delivery & Engagement Funnel</h3>
        <span className="text-[11px] font-semibold text-theme-muted">
          Conversion across all messages
        </span>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {stages.map((stage, idx) => {
          const Icon = stage.icon;
          return (
            <div
              key={stage.label}
              className="relative overflow-hidden rounded-2xl border border-theme-border/70 bg-theme-surface p-3.5 shadow-sm transition hover:border-whatsapp-500/30"
            >
              <div className="flex items-center justify-between">
                <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${stage.bg}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="rounded-full bg-theme-subtle px-2 py-0.5 text-[11px] font-black tabular-nums text-theme-fg">
                  {stage.pct}%
                </span>
              </div>

              <div className="mt-3">
                <p className="text-[11px] font-bold text-theme-muted uppercase tracking-wider">
                  {idx + 1}. {stage.label}
                </p>
                <p className="mt-0.5 text-lg font-black tabular-nums tracking-tight text-theme-fg">
                  {stage.count.toLocaleString()}
                </p>
              </div>

              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-theme-subtle">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${stage.gradient} transition-all duration-700`}
                  style={{ width: `${stage.pct}%` }}
                />
              </div>

              {stage.dropOff && (
                <p className="mt-1.5 text-[10px] font-medium text-rose-600/80 dark:text-rose-400/80">
                  {stage.dropOff}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

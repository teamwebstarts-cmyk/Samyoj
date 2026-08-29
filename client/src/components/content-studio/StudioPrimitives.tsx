import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { WhatsAppChatSurface, WhatsAppBubble } from '../inbox/WhatsAppPreview';
import { useWhatsAppPreviewIdentity } from '../../hooks/useWhatsAppPreviewIdentity';

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === 'APPROVED' || status === 'READY' || status === 'COMPLETED' || status === 'SUCCEEDED' || status === 'PUBLISHED'
      ? 'bg-emerald-500/10 text-emerald-700 ring-emerald-500/20 dark:text-emerald-300'
      : status === 'FAILED' || status === 'REJECTED' || status === 'BLOCKED'
        ? 'bg-rose-500/10 text-rose-700 ring-rose-500/20 dark:text-rose-300'
        : 'bg-amber-500/10 text-amber-700 ring-amber-500/20 dark:text-amber-300';

  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${tone}`}>
      {status.replace(/_/g, ' ').toLowerCase()}
    </span>
  );
}

export function StudioSection({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[14px] font-extrabold tracking-tight text-theme-fg">{title}</h3>
          {subtitle && <p className="mt-0.5 text-[12px] text-theme-secondary">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function ListShell({ children }: { children: ReactNode }) {
  return (
    <div className="divide-y divide-theme-border overflow-hidden rounded-xl border border-theme-border bg-theme-surface">
      {children}
    </div>
  );
}

export function StudioEmpty({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="studio-grain overflow-hidden rounded-2xl border border-theme-border px-5 py-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700 ring-1 ring-emerald-500/20 dark:text-emerald-300">
        <Icon className="h-6 w-6" strokeWidth={2.1} />
      </div>
      <p className="mt-4 text-[16px] font-extrabold tracking-tight text-theme-fg">{title}</p>
      <p className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-theme-secondary">{description}</p>
      <div className="mx-auto my-4 h-px max-w-[12rem] bg-theme-border" />
      {action}
    </div>
  );
}

export function WhatsAppPreview({
  brandName,
  body,
}: {
  brandName: string;
  color?: string;
  body: string;
}) {
  const identity = useWhatsAppPreviewIdentity({ companyName: brandName || undefined });

  return (
    <div className="studio-grain overflow-hidden rounded-2xl border border-theme-border p-4">
      <div className="mx-auto max-w-[280px]">
        <WhatsAppChatSurface compact identity={identity}>
          <WhatsAppBubble direction="outbound" content={body} compact status="read" />
        </WhatsAppChatSurface>
        <p className="mt-2 text-center text-[11px] font-medium text-theme-muted">Live preview</p>
      </div>
    </div>
  );
}

export interface CreditKind {
  used: number;
  softLimit: number;
  hardLimit: number;
}

export function CreditsBar({
  plan,
  credits,
}: {
  plan?: string;
  credits?: Record<string, CreditKind>;
}) {
  if (!credits) return null;

  const meters: Array<{ key: string; label: string }> = [
    { key: 'TEXT_TOKENS', label: 'Text' },
    { key: 'IMAGES', label: 'Images' },
    { key: 'VIDEO_SECONDS', label: 'Video' },
    { key: 'VOICE_MINUTES', label: 'Voice' },
  ];
  const visible = meters.filter((meter) => credits[meter.key]);
  if (visible.length === 0) return null;

  const pct = (used: number, hard: number) =>
    hard <= 0 ? (used > 0 ? 100 : 0) : Math.min(100, Math.round((used / hard) * 100));

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-theme-border bg-theme-subtle/40 px-3.5 py-2.5">
      <p className="text-[11px] font-bold uppercase tracking-wide text-theme-muted">
        Today · {plan || 'starter'}
      </p>
      {visible.map(({ key, label }) => {
        const item = credits[key];
        return (
          <CreditMeter
            key={key}
            label={label}
            used={item.used}
            hard={item.hardLimit}
            pct={pct(item.used, item.hardLimit)}
          />
        );
      })}
    </div>
  );
}

function CreditMeter({
  label,
  used,
  hard,
  pct,
}: {
  label: string;
  used: number;
  hard: number;
  pct: number;
}) {
  return (
    <div className="min-w-[140px] flex-1">
      <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-theme-secondary">
        <span>{label}</span>
        <span className="tabular-nums">
          {used.toLocaleString()} / {hard.toLocaleString()}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-theme-subtle">
        <div
          className={`h-full rounded-full ${pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

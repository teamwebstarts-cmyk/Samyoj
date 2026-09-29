import { Link } from 'react-router-dom';
import { Lock, Mail, Send, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface EmailQuickActionItem {
  to: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  tone: 'pink' | 'blue' | 'violet' | 'green';
}

/** Quick actions grid — mockup 1 (image.png). */
export default function EmailQuickActions({
  actions,
  showMultiSendLocked = false,
}: {
  actions: EmailQuickActionItem[];
  showMultiSendLocked?: boolean;
}) {
  return (
    <section className="ema-card">
      <div className="ema-card__head">
        <div>
          <div className="ema-card__title">Quick actions</div>
          <p className="ema-card__sub">Start sending emails and manage your content</p>
        </div>
      </div>
      <div className="ema-actions" style={{ padding: '12px 16px 16px' }}>
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Link key={action.to} to={action.to} className="ema-action">
              <span className={`ema-action__icon ema-action__icon--${action.tone}`}>
                <Icon className="h-[17px] w-[17px]" strokeWidth={2.1} />
              </span>
              <span className="min-w-0">
                <strong>{action.label}</strong>
                <span>{action.desc}</span>
              </span>
            </Link>
          );
        })}
        {showMultiSendLocked && <MultiSendLockedCard />}
      </div>
    </section>
  );
}

/** Default actions used by the dashboard (exported for the page). */
export const DASHBOARD_QUICK_ACTIONS: EmailQuickActionItem[] = [
  { to: '/email/compose', label: 'Compose email', desc: 'Send a one-time email to a contact', icon: Send, tone: 'pink' },
  { to: '/email/compose', label: 'Send to multiple contacts', desc: 'Select contacts and send emails', icon: Users, tone: 'blue' },
  { to: '/email/templates', label: 'Manage templates', desc: 'Create and reuse email templates', icon: Mail, tone: 'violet' },
];

/** Multi-send is a gated Phase 2 feature — rendered locked, never active (recheck Correction 4). */
export function MultiSendLockedCard() {
  return (
    <div
      className="ema-action cursor-not-allowed opacity-70"
      role="note"
      aria-label="Sending to multiple contacts is coming later"
      title="Coming later — needs consent, unsubscribe and throttle controls first"
    >
      <span className="ema-action__icon ema-action__icon--blue">
        <Lock className="h-[17px] w-[17px]" strokeWidth={2.1} />
      </span>
      <span className="min-w-0">
        <strong>Send to multiple contacts</strong>
        <span>Coming later — compliance gates first</span>
      </span>
    </div>
  );
}

import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useWhatsAppNumber } from '../../contexts/WhatsAppNumberContext';
import { formatPhoneDisplay } from '../../utils/formatPhone';

interface WhatsAppStatusCardProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

/** Compact WhatsApp-style glyph (stroke mark, not Meta brand kit). */
function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M12 3.5c-4.6 0-8.3 3.6-8.3 8.1 0 1.4.4 2.8 1.1 4L3.5 20l4.5-1.2c1.1.6 2.4.9 3.7.9 4.6 0 8.3-3.6 8.3-8.1S16.6 3.5 12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M9.2 9.3c.2-.4.4-.4.6-.4h.5c.2 0 .3 0 .5.4l.7 1.6c.1.2 0 .4-.1.5l-.4.5c-.1.1-.1.3 0 .4.3.5.9 1.1 1.5 1.4.2.1.4.1.5 0l.6-.4c.2-.1.4-.1.5 0l1.5.8c.2.1.3.3.2.5-.2.5-.8 1.1-1.3 1.2-.4.1-1 0-2.1-.4-1.4-.6-2.5-1.6-3.4-2.9-.4-.6-.8-1.4-.9-1.9-.1-.5 0-1 .3-1.3Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function WhatsAppStatusCard({ collapsed = false, onNavigate }: WhatsAppStatusCardProps) {
  const { activeNumber, hasConnectedNumber, loading } = useWhatsAppNumber();

  if (collapsed) {
    if (loading) {
      return (
        <div
          className="mx-auto h-10 w-10 animate-pulse rounded-full bg-theme-subtle"
          aria-hidden
        />
      );
    }

    return (
      <Link
        to="/settings?tab=whatsapp"
        onClick={onNavigate}
        title={hasConnectedNumber ? 'WhatsApp connected — Manage' : 'Connect WhatsApp'}
        className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full transition duration-200 ${
          hasConnectedNumber
            ? 'bg-gradient-to-br from-whatsapp-500 to-emerald-600 text-white shadow-[0_8px_24px_rgba(0,180,90,0.18)]'
            : 'border border-theme-border bg-theme-surface text-theme-secondary hover:bg-theme-subtle'
        }`}
      >
        <WhatsAppGlyph className="h-[18px] w-[18px]" />
      </Link>
    );
  }

  if (loading) {
    return (
      <div className="sidebar-wa-card animate-pulse space-y-3 p-4">
        <div className="h-3 w-28 rounded bg-theme-subtle" />
        <div className="h-3 w-36 rounded bg-theme-subtle" />
        <div className="h-8 w-full rounded-xl bg-theme-subtle" />
      </div>
    );
  }

  if (hasConnectedNumber && activeNumber) {
    return (
      <div className="sidebar-wa-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-whatsapp-500 to-emerald-600 text-white shadow-[0_4px_12px_rgba(0,180,90,0.2)]">
            <WhatsAppGlyph className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-semibold text-theme-fg">WhatsApp Connected</p>
            <p className="mt-0.5 truncate text-[12px] font-medium text-theme-secondary">
              {formatPhoneDisplay(activeNumber.phoneNumber)}
            </p>
            <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]" aria-hidden />
              Connected
            </p>
          </div>
        </div>
        <Link
          to="/settings?tab=whatsapp"
          onClick={onNavigate}
          className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-[#D8F4E5] bg-white/80 text-[13px] font-semibold text-[#0F7A45] transition duration-200 hover:bg-white dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/15"
        >
          Manage
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      </div>
    );
  }

  return (
    <div className="sidebar-wa-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-theme-subtle text-emerald-600 ring-1 ring-theme-border dark:text-emerald-400">
          <WhatsAppGlyph className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-theme-fg">Connect WhatsApp</p>
          <p className="mt-0.5 text-[12px] font-medium leading-snug text-theme-secondary">
            Link your business number to start chatting.
          </p>
        </div>
      </div>
      <Link
        to="/settings?tab=whatsapp"
        onClick={onNavigate}
        className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-whatsapp-500 to-emerald-600 text-[13px] font-semibold text-white shadow-[0_8px_24px_rgba(0,180,90,0.18)] transition duration-200 hover:brightness-105"
      >
        Connect
        <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
      </Link>
    </div>
  );
}

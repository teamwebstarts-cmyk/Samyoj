import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { useWhatsAppNumber } from '../../contexts/WhatsAppNumberContext';
import { formatPhoneDisplay } from '../../utils/formatPhone';
import { tipProps } from './SidebarFlyoutTip';

interface WhatsAppStatusCardProps {
  collapsed?: boolean;
  onNavigate?: () => void;
  onShowTip?: (text: string, el: HTMLElement) => void;
  onHideTip?: () => void;
}

function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden>
      <path
        fill="currentColor"
        d="M19.05 4.91A9.82 9.82 0 0 0 12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01Zm-7.01 15.24c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.26 8.26 0 0 1-1.26-4.38c0-4.54 3.7-8.24 8.25-8.24 2.2 0 4.27.86 5.83 2.42a8.2 8.2 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23Zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.35-.76-1.84-.2-.48-.4-.42-.56-.42h-.48c-.17 0-.43.06-.66.31-.22.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74 1.76.76 2.12.83 2.88.7.46-.08 1.47-.6 1.67-1.18.21-.58.21-1.07.14-1.18-.07-.1-.25-.17-.5-.29Z"
      />
    </svg>
  );
}

export default function WhatsAppStatusCard({
  collapsed = false,
  onNavigate,
  onShowTip,
  onHideTip,
}: WhatsAppStatusCardProps) {
  const { activeNumber, hasConnectedNumber, loading } = useWhatsAppNumber();
  const href = '/settings?tab=whatsapp';

  if (loading) {
    return (
      <div className={`sidebar-wa-card ${collapsed ? 'sidebar-wa-card--collapsed' : ''}`}>
        <div className="flex items-center gap-2.5 p-2">
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-emerald-100/80 dark:bg-emerald-500/20" />
          <div
            className={`min-w-0 flex-1 space-y-1.5 overflow-hidden transition-[opacity,max-width] duration-200 ${
              collapsed ? 'max-w-0 opacity-0' : 'opacity-100'
            }`}
          >
            <div className="h-2.5 w-24 rounded bg-theme-subtle" />
            <div className="h-2.5 w-16 rounded bg-theme-subtle" />
          </div>
        </div>
      </div>
    );
  }

  if (collapsed) {
    const tipText = hasConnectedNumber
      ? activeNumber
        ? `${formatPhoneDisplay(activeNumber.phoneNumber)} · Connected`
        : 'WhatsApp connected'
      : 'Connect WhatsApp';
    const flyout =
      onShowTip && onHideTip ? tipProps(true, tipText, onShowTip, onHideTip) : {};

    return (
      <Link
        to={href}
        onClick={() => {
          onHideTip?.();
          onNavigate?.();
        }}
        {...flyout}
        className="sidebar-wa-card sidebar-wa-card--collapsed group relative flex items-center justify-center p-1.5"
      >
        <span
          className={`relative flex h-9 w-9 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-[1.04] ${
            hasConnectedNumber
              ? 'bg-[#25D366] text-white shadow-[0_6px_16px_rgba(37,211,102,0.35)]'
              : 'bg-white text-[#25D366] ring-1 ring-emerald-200 dark:bg-emerald-500/15 dark:ring-emerald-500/30'
          }`}
        >
          <WhatsAppGlyph className="h-[18px] w-[18px]" />
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-[rgb(21,29,43)] ${
              hasConnectedNumber ? 'bg-emerald-400' : 'bg-amber-400'
            }`}
          />
        </span>
      </Link>
    );
  }

  if (hasConnectedNumber && activeNumber) {
    return (
      <Link
        to={href}
        onClick={onNavigate}
        className="sidebar-wa-card sidebar-wa-card--connected group block p-2.5"
      >
        <div className="flex items-center gap-2.5">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_6px_16px_rgba(37,211,102,0.28)] transition-transform duration-200 group-hover:scale-[1.03]">
            <WhatsAppGlyph className="h-5 w-5" />
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)] dark:border-[#0f1a14]" />
          </span>

          <span className="min-w-0 flex-1 overflow-hidden">
            <span className="block truncate text-[12.5px] font-bold tracking-tight text-theme-fg">
              {formatPhoneDisplay(activeNumber.phoneNumber)}
            </span>
            <span className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
              Connected
            </span>
          </span>

          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/80 text-emerald-700 ring-1 ring-emerald-200/80 transition duration-200 group-hover:bg-white group-hover:text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/25">
            <ChevronRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2} />
          </span>
        </div>
      </Link>
    );
  }

  return (
    <div className="sidebar-wa-card sidebar-wa-card--setup p-3.5 text-center">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#25D366] shadow-[0_6px_18px_rgba(37,211,102,0.2)] ring-1 ring-emerald-100 dark:bg-emerald-500/10 dark:ring-emerald-500/25">
        <WhatsAppGlyph className="h-5 w-5" />
      </div>
      <p className="mt-2.5 text-[13px] font-bold tracking-tight text-theme-fg">
        Need help getting started?
      </p>
      <p className="mt-1 text-[11.5px] font-medium leading-snug text-theme-secondary">
        Connect WhatsApp and automate in minutes.
      </p>
      <Link
        to={href}
        onClick={onNavigate}
        className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-[#1fa855] to-[#128C7E] text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(18,140,126,0.28)] transition duration-200 hover:brightness-105"
      >
        Get Started
        <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.25} />
      </Link>
    </div>
  );
}

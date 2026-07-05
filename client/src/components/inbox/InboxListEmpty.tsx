import { Link } from 'react-router-dom';
import { MessageSquarePlus, Search } from 'lucide-react';
import AppButton from '../ui/AppButton';
import InboxEmptyIcon from './InboxEmptyIcon';
import { useWhatsAppNumber } from '../../contexts/WhatsAppNumberContext';

interface InboxListEmptyProps {
  filtered?: boolean;
  onNewChat?: () => void;
}

export default function InboxListEmpty({ filtered, onNewChat }: InboxListEmptyProps) {
  const { hasConnectedNumber, loading } = useWhatsAppNumber();
  const whatsappConnected = hasConnectedNumber;

  if (filtered) {
    return (
      <div className="flex flex-col items-center px-6 py-14 text-center">
        <InboxEmptyIcon icon={Search} tone="muted" size="md" />
        <h3 className="mt-5 text-[15px] font-bold tracking-tight text-theme-fg">No chats match</h3>
        <p className="mt-2 max-w-[240px] text-[13px] leading-relaxed text-theme-secondary">
          Try a different search term or clear your filters to see all conversations.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <InboxEmptyIcon icon={MessageSquarePlus} size="md" />
      <h3 className="mt-5 text-[15px] font-bold tracking-tight text-theme-fg">No conversations yet</h3>
      <p className="mt-2 max-w-[260px] text-[13px] leading-relaxed text-theme-secondary">
        {whatsappConnected
          ? 'Start a chat or wait for customers to message you.'
          : 'Connect WhatsApp to start receiving customer messages.'}
      </p>

      {!loading && (
        <div className="mt-5 w-full max-w-[220px]">
          {!whatsappConnected ? (
            <Link to="/settings?tab=whatsapp">
              <AppButton fullWidth size="sm">
                Connect WhatsApp
              </AppButton>
            </Link>
          ) : (
            <AppButton fullWidth size="sm" onClick={onNewChat}>
              Start new chat
            </AppButton>
          )}
        </div>
      )}

      {!loading && whatsappConnected && (
        <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-200/60 bg-emerald-50/80 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-950/40 dark:text-emerald-400">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-whatsapp-400 opacity-50" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-whatsapp-500" />
          </span>
          Live updates on
        </p>
      )}
    </div>
  );
}

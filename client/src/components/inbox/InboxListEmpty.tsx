import { Link } from 'react-router-dom';
import { MessageSquarePlus, Search } from 'lucide-react';
import AppButton from '../ui/AppButton';
import InboxEmptyIcon from './InboxEmptyIcon';
import { useWhatsAppNumber } from '../../contexts/WhatsAppNumberContext';
import { whatsappNotConnectedCopy } from '../../utils/whatsappConnectionCopy';

interface InboxListEmptyProps {
  filtered?: boolean;
  onNewChat?: () => void;
  variant?: 'whatsapp' | 'messenger' | 'instagram';
  connected?: boolean;
}

export default function InboxListEmpty({
  filtered,
  onNewChat,
  variant = 'whatsapp',
  connected,
}: InboxListEmptyProps) {
  const { hasConnectedNumber, loading, disconnectedNumbers } = useWhatsAppNumber();
  const whatsappConnected = hasConnectedNumber;
  const disconnectedCopy = whatsappNotConnectedCopy(disconnectedNumbers, {
    task: 'start receiving customer messages',
  });
  const isMessenger = variant === 'messenger';
  const isInstagram = variant === 'instagram';
  const pageConnected = connected !== false;

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

  if (isInstagram) {
    return (
      <div className="flex flex-col items-center px-6 py-12 text-center">
        <InboxEmptyIcon icon={MessageSquarePlus} size="md" />
        <h3 className="mt-5 text-[15px] font-bold tracking-tight text-theme-fg">
          {pageConnected ? 'No Instagram chats yet.' : 'Connect Instagram'}
        </h3>
        <p className="mt-2 max-w-[260px] text-[13px] leading-relaxed text-theme-secondary">
          {pageConnected
            ? 'When someone DMs your professional account, it shows up here.'
            : 'Connect Instagram in Settings. It uses the Facebook Page already linked.'}
        </p>
        {!pageConnected && (
          <div className="mt-5 w-full max-w-[220px]">
            <Link to="/settings?tab=instagram">
              <AppButton fullWidth size="sm">
                Connect Instagram
              </AppButton>
            </Link>
          </div>
        )}
      </div>
    );
  }

  if (isMessenger) {
    return (
      <div className="flex flex-col items-center px-6 py-12 text-center">
        <InboxEmptyIcon icon={MessageSquarePlus} size="md" />
        <h3 className="mt-5 text-[15px] font-bold tracking-tight text-theme-fg">
          {pageConnected ? 'No Messenger chats yet.' : 'Connect a Facebook Page'}
        </h3>
        <p className="mt-2 max-w-[260px] text-[13px] leading-relaxed text-theme-secondary">
          {pageConnected
            ? 'When someone messages your Page, it shows up here.'
            : 'Connect a Page in Settings to receive Messenger chats.'}
        </p>
        {!pageConnected && (
          <div className="mt-5 w-full max-w-[220px]">
            <Link to="/settings?tab=facebook">
              <AppButton fullWidth size="sm">
                Connect Page
              </AppButton>
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <InboxEmptyIcon icon={MessageSquarePlus} size="md" />
      <h3 className="mt-5 text-[15px] font-bold tracking-tight text-theme-fg">
        {whatsappConnected ? 'No conversations yet' : disconnectedCopy.title}
      </h3>
      <p className="mt-2 max-w-[260px] text-[13px] leading-relaxed text-theme-secondary">
        {whatsappConnected
          ? 'Start a chat or wait for customers to message you.'
          : disconnectedCopy.description}
      </p>

      {!loading && (
        <div className="mt-5 w-full max-w-[220px]">
          {!whatsappConnected ? (
            <Link to="/settings?tab=whatsapp">
              <AppButton fullWidth size="sm">
                {disconnectedCopy.cta}
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

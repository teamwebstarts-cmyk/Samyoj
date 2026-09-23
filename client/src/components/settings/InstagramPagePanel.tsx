import { Link } from 'react-router-dom';
import { Instagram, LogOut, Plus, CheckCircle2 } from 'lucide-react';
import SettingsPanel from './SettingsPanel';
import AppButton from '../ui/AppButton';
import { SettingsTabSkeleton } from './SettingsSkeleton';

export type InstagramAccountSummary = {
  channelId: string;
  igUserId: string;
  username: string | null;
};

interface InstagramPagePanelProps {
  account: InstagramAccountSummary | null;
  loading?: boolean;
  connecting: boolean;
  disconnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  canEdit: boolean;
}

export default function InstagramPagePanel({
  account,
  loading = false,
  connecting,
  disconnecting,
  onConnect,
  onDisconnect,
  canEdit,
}: InstagramPagePanelProps) {
  if (loading) return <SettingsTabSkeleton variant="compact" />;

  return (
    <div className="space-y-4">
      <p className="text-[13px] font-medium text-theme-secondary">
        Instagram uses the Facebook Page already connected.{' '}
        <Link to="/instagram/inbox" className="font-semibold text-[#E4405F] hover:underline">
          Open Inbox →
        </Link>
      </p>
      <SettingsPanel
        title="Instagram"
        description="Link the professional account attached to your Page. DMs and comments stay out of WhatsApp Inbox."
        icon={Instagram}
      >
        {account ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-pink-200/70 bg-gradient-to-r from-pink-50/80 via-[#E4405F]/[0.04] to-theme-surface px-3.5 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E4405F] text-white">
                <Instagram className="h-[18px] w-[18px]" strokeWidth={2.25} />
              </div>
              <div className="min-w-0">
                <p className="truncate font-bold text-[14px] text-theme-fg">
                  {account.username ? `@${account.username}` : account.igUserId}
                </p>
                <p className="mt-0.5 flex items-center gap-1 text-[11px] font-semibold text-pink-700">
                  <CheckCircle2 className="h-3 w-3 shrink-0" />
                  Connected
                </p>
              </div>
            </div>
            <AppButton
              variant="danger"
              size="sm"
              icon={<LogOut className="h-3.5 w-3.5" />}
              onClick={onDisconnect}
              loading={disconnecting}
              disabled={disconnecting || !canEdit}
            >
              Disconnect
            </AppButton>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[#E4405F]/30 px-4 py-8 text-center">
            <p className="text-[14px] font-semibold text-theme-fg">Connect the Instagram account linked to your Page.</p>
            <p className="mt-1 text-[12px] text-theme-secondary">
              Connect Facebook Page first if you have not. Then link Instagram here. No App ID in Settings.
            </p>
            <div className="mt-4">
              <AppButton
                onClick={onConnect}
                disabled={connecting || !canEdit}
                loading={connecting}
                icon={<Plus className="h-4 w-4" />}
              >
                Connect Instagram
              </AppButton>
            </div>
          </div>
        )}
      </SettingsPanel>
    </div>
  );
}

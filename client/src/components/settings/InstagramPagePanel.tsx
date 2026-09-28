import { Link } from 'react-router-dom';
import { Image, LogOut, MessageCircle, MessageSquare, Plus } from 'lucide-react';
import AppButton from '../ui/AppButton';
import { SettingsTabSkeleton } from './SettingsSkeleton';
import InstagramGlyph from '../dashboard/icons/InstagramGlyph';

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
    <section className="settings-channel-card settings-channel-card--instagram">
      <div className="settings-channel-card__header">
        <div className="settings-channel-card__identity">
          <span className="settings-channel-card__brand settings-channel-card__brand--instagram">
            <InstagramGlyph className="h-[19px] w-[19px]" />
          </span>
          <div className="min-w-0">
            <div className="settings-channel-card__title-row">
              <h2>Instagram</h2>
              {account ? <span className="settings-channel-status"><i /> Connected</span> : null}
            </div>
            <p>{account ? `@${account.username || account.igUserId} · Professional account` : 'Connect a professional account'}</p>
          </div>
        </div>
        <div className="settings-channel-card__actions">
          {account ? (
            <button type="button" className="settings-channel-action settings-channel-action--danger" onClick={onDisconnect} disabled={disconnecting || !canEdit}>
              <LogOut className="h-3 w-3" /> Disconnect
            </button>
          ) : (
            <AppButton size="sm" onClick={onConnect} disabled={connecting || !canEdit} loading={connecting} icon={<Plus className="h-3.5 w-3.5" />}>Connect</AppButton>
          )}
        </div>
      </div>
      {account ? (
        <div className="settings-channel-card__features">
          <Link to="/instagram/inbox" className="settings-channel-feature">
            <span className="settings-channel-feature__icon settings-channel-feature__icon--pink"><MessageCircle /></span>
            <span><b>Instagram Inbox</b><small>Manage DMs</small></span>
          </Link>
          <Link to="/instagram/comments" className="settings-channel-feature">
            <span className="settings-channel-feature__icon settings-channel-feature__icon--pink"><MessageSquare /></span>
            <span><b>Comments</b><small>View & reply to comments</small></span>
          </Link>
          <Link to="/instagram/posts" className="settings-channel-feature">
            <span className="settings-channel-feature__icon settings-channel-feature__icon--pink"><Image /></span>
            <span><b>Posts</b><small>Create, schedule and manage posts</small></span>
          </Link>
        </div>
      ) : (
        <div className="settings-channel-empty">
          <p>Connect the Instagram account linked to your Page.</p>
          <small>Connect Facebook Page first if you have not. No App ID in Settings.</small>
        </div>
      )}
      <p className="settings-channel-footnote">ⓘ Instagram uses the Facebook Page already connected.</p>
    </section>
  );
}

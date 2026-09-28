import { Link } from 'react-router-dom';
import { BarChart3, LogOut, MessageCircle, Plus } from 'lucide-react';
import AppButton from '../ui/AppButton';
import { SettingsTabSkeleton } from './SettingsSkeleton';
import FacebookGlyph from '../dashboard/icons/FacebookGlyph';

export type FacebookPageSummary = {
  channelId: string;
  pageId: string;
  name: string;
};

interface FacebookPagePanelProps {
  page: FacebookPageSummary | null;
  loading?: boolean;
  connecting: boolean;
  disconnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  canEdit: boolean;
}

/** Settings card cloned from WhatsApp numbers — Connect Page only. No App ID/Secret. */
export default function FacebookPagePanel({
  page,
  loading = false,
  connecting,
  disconnecting,
  onConnect,
  onDisconnect,
  canEdit,
}: FacebookPagePanelProps) {
  if (loading) return <SettingsTabSkeleton variant="compact" />;

  return (
    <section className="settings-channel-card settings-channel-card--facebook">
      <div className="settings-channel-card__header">
        <div className="settings-channel-card__identity">
          <span className="settings-channel-card__brand settings-channel-card__brand--facebook">
            <FacebookGlyph className="h-[19px] w-[19px]" />
          </span>
          <div className="min-w-0">
            <div className="settings-channel-card__title-row">
              <h2>Facebook</h2>
              {page ? <span className="settings-channel-status"><i /> Connected</span> : null}
            </div>
            <p>{page ? `${page.name} · Facebook Page` : 'Connect a Facebook Page'}</p>
          </div>
        </div>
        <div className="settings-channel-card__actions">
          {page ? (
            <button type="button" className="settings-channel-action settings-channel-action--danger" onClick={onDisconnect} disabled={disconnecting || !canEdit}>
              <LogOut className="h-3 w-3" /> Disconnect
            </button>
          ) : (
            <AppButton size="sm" onClick={onConnect} disabled={connecting || !canEdit} loading={connecting} icon={<Plus className="h-3.5 w-3.5" />}>Connect</AppButton>
          )}
        </div>
      </div>
      {page ? (
        <div className="settings-channel-card__features">
          <Link to="/facebook/inbox" className="settings-channel-feature">
            <span className="settings-channel-feature__icon settings-channel-feature__icon--blue"><MessageCircle /></span>
            <span><b>Messenger</b><small>Receive & reply to messages</small></span>
          </Link>
          <Link to="/facebook/ads" className="settings-channel-feature">
            <span className="settings-channel-feature__icon settings-channel-feature__icon--blue"><BarChart3 /></span>
            <span><b>Ads insights</b><small>View insights (read only)</small></span>
          </Link>
        </div>
      ) : (
        <div className="settings-channel-empty">
          <p>Connect a Page for Instant Form leads and Messenger.</p>
          <small>Sign in with Facebook and pick your Page. No App ID in Settings.</small>
        </div>
      )}
    </section>
  );
}

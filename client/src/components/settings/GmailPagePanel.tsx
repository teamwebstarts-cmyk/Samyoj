import { useEffect, useState } from 'react';
import { LogOut, Link2, MailPlus, LayoutTemplate, AlertCircle, LoaderCircle } from 'lucide-react';
import AppButton from '../ui/AppButton';
import GmailGlyph from '../email/GmailGlyph';
import { gmailApi, type GmailStatus } from '../../services/api';
import { getErrorMessage } from '../../utils/errors';

export default function GmailPagePanel({ canEdit }: { canEdit: boolean }) {
  const [status, setStatus] = useState<GmailStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const loadStatus = async () => {
    setLoading(true);
    try {
      setStatus((await gmailApi.status()).data.data);
      setError('');
    } catch (cause) {
      setError(getErrorMessage(cause, 'Could not load Gmail connection status.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const connect = async () => {
    setWorking(true);
    setError('');
    try {
      const response = await gmailApi.connect();
      window.location.assign(response.data.data.url);
    } catch (cause) {
      setError(getErrorMessage(cause, 'Gmail could not start connecting.'));
      setWorking(false);
    }
  };

  const disconnect = async () => {
    setWorking(true);
    setError('');
    try {
      await gmailApi.disconnect();
      setStatus({ connected: false, email: null, status: 'disconnected', reconnectReason: null, scopes: [] });
    } catch (cause) {
      setError(getErrorMessage(cause, 'Could not disconnect Gmail.'));
    } finally {
      setWorking(false);
    }
  };

  const connected = status?.status === 'connected';
  const reconnectRequired = status?.status === 'reconnect-required';

  if (loading) {
    return (
      <section className="settings-channel-card settings-channel-card--gmail">
        <div className="settings-channel-empty">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          <p>Checking Gmail connection…</p>
        </div>
      </section>
    );
  }

  if (reconnectRequired) {
    return (
      <section className="settings-channel-card settings-channel-card--gmail">
        <div className="settings-channel-card__header">
          <div className="settings-channel-card__identity">
            <span className="settings-channel-card__brand settings-channel-card__brand--gmail">
              <GmailGlyph className="h-[19px] w-[19px]" />
            </span>
            <div className="min-w-0">
              <div className="settings-channel-card__title-row">
                <h2>Gmail</h2>
                <span className="settings-channel-status settings-channel-status--warn">
                  <i /> Reconnect required
                </span>
              </div>
              <p>Google no longer allows sending from this mailbox.</p>
            </div>
          </div>
          <div className="settings-channel-card__actions">
            <AppButton size="sm" disabled={!canEdit || working} onClick={() => void connect()}>
              <Link2 className="h-3.5 w-3.5" /> {working ? 'Opening…' : 'Connect Gmail'}
            </AppButton>
          </div>
        </div>
        <div className="settings-channel-empty">
          <p>Google access was revoked. Reconnect to start sending again.</p>
          <small>Sent history stays. Nothing was deleted.</small>
        </div>
        {error ? <p className="px-4 pb-3 text-xs text-red-600" role="alert">{error}</p> : null}
      </section>
    );
  }

  if (connected) {
    return (
      <section className="settings-channel-card settings-channel-card--gmail">
        <div className="settings-channel-card__header">
          <div className="settings-channel-card__identity">
            <span className="settings-channel-card__brand settings-channel-card__brand--gmail">
              <GmailGlyph className="h-[19px] w-[19px]" />
            </span>
            <div className="min-w-0">
              <div className="settings-channel-card__title-row">
                <h2>Gmail</h2>
                <span className="settings-channel-status"><i /> Connected</span>
              </div>
              <p>{status?.email || 'Connected mailbox'} · Gmail mailbox</p>
            </div>
          </div>
          <div className="settings-channel-card__actions">
            <button
              type="button"
              className="settings-channel-action settings-channel-action--danger"
              disabled={!canEdit || working}
              onClick={() => void disconnect()}
            >
              <LogOut className="h-3 w-3" /> {working ? 'Disconnecting…' : 'Disconnect'}
            </button>
          </div>
        </div>
        {error ? <p className="px-4 pb-3 text-xs text-red-600" role="alert">{error}</p> : null}
        <div className="settings-channel-card__features">
          <a href="/email/compose" className="settings-channel-feature">
            <span className="settings-channel-feature__icon settings-channel-feature__icon--pink">
              <MailPlus />
            </span>
            <span>
              <b>Compose</b>
              <small>Send a one-time email to a contact</small>
            </span>
          </a>
          <a href="/email/templates" className="settings-channel-feature">
            <span className="settings-channel-feature__icon settings-channel-feature__icon--pink">
              <LayoutTemplate />
            </span>
            <span>
              <b>Templates</b>
              <small>Save and reuse email templates</small>
            </span>
          </a>
        </div>
        <div className="settings-channel-card__footer">
          <p className="settings-channel-card__limits">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>
              Google limits this mailbox — about 500 emails a day on free Gmail, about 2,000 a day on paid
              Workspace. If sending stops, wait up to 24 hours.
            </span>
          </p>
        </div>
      </section>
    );
  }

  // Not connected
  return (
    <section className="settings-channel-card settings-channel-card--gmail">
      <div className="settings-channel-card__header">
        <div className="settings-channel-card__identity">
          <span className="settings-channel-card__brand settings-channel-card__brand--gmail">
            <GmailGlyph className="h-[19px] w-[19px]" />
          </span>
          <div className="min-w-0">
            <div className="settings-channel-card__title-row">
              <h2>Gmail</h2>
            </div>
            <p>Connect your Gmail mailbox</p>
          </div>
        </div>
        <div className="settings-channel-card__actions">
          <AppButton size="sm" disabled={!canEdit || working} onClick={() => void connect()}>
            <Link2 className="h-3.5 w-3.5" /> {working ? 'Opening…' : 'Connect Gmail'}
          </AppButton>
        </div>
      </div>
      <div className="settings-channel-empty">
        {canEdit ? (
          <>
            <p>Send email as your Gmail or Google Workspace mailbox. Samyoj does not read your inbox.</p>
            <small>Only owners or admins can connect Gmail.</small>
          </>
        ) : (
          <>
            <p>Ask an admin to connect Gmail.</p>
            <small>Only owners or admins can connect the mailbox.</small>
          </>
        )}
      </div>
      {error ? <p className="px-4 pb-3 text-xs text-red-600" role="alert">{error}</p> : null}
    </section>
  );
}

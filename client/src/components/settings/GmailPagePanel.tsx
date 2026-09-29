import { LogOut, Link2, MailPlus, LayoutTemplate, AlertCircle } from 'lucide-react';
import AppButton from '../ui/AppButton';
import GmailGlyph from '../email/GmailGlyph';
import { useMetaMock } from '../../contexts/MetaMockContext';
import { MOCK_MAILBOX } from '../../pages/email/mockData';

export default function GmailPagePanel({ canEdit }: { canEdit: boolean }) {
  const { enabled: connected } = useMetaMock();
  const mailbox = MOCK_MAILBOX.email;
  const reconnectRequired = false;
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
            <AppButton size="sm" disabled={!canEdit}>
              <Link2 className="h-3.5 w-3.5" /> Connect Gmail
            </AppButton>
          </div>
        </div>
        <div className="settings-channel-empty">
          <p>Google access was revoked. Reconnect to start sending again.</p>
          <small>Sent history stays. Nothing was deleted.</small>
        </div>
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
              <p>{mailbox} · Gmail mailbox</p>
            </div>
          </div>
          <div className="settings-channel-card__actions">
            <button
              type="button"
              className="settings-channel-action settings-channel-action--danger"
              disabled={!canEdit}
            >
              <LogOut className="h-3 w-3" /> Disconnect
            </button>
          </div>
        </div>
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
          <AppButton size="sm" disabled={!canEdit}>
            <Link2 className="h-3.5 w-3.5" /> Connect Gmail
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
    </section>
  );
}

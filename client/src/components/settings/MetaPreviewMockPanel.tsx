import { FlaskConical } from 'lucide-react';
import SettingsPanel from './SettingsPanel';
import { useMetaMock } from '../../contexts/MetaMockContext';

export default function MetaPreviewMockPanel() {
  const { enabled, setEnabled } = useMetaMock();

  return (
    <SettingsPanel
      title="Channel preview data"
      description="Sample rows for Messenger, Ads, Instagram, Email, and the notification bell (dashboard, compose, templates). Default is off. Live data still loads when a channel is really connected."
      icon={FlaskConical}
    >
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setEnabled(false)}
          className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
            !enabled
              ? 'bg-[#178A48] text-white'
              : 'border border-theme-border bg-theme-surface text-theme-muted hover:text-theme-fg'
          }`}
        >
          Without mock data
        </button>
        <button
          type="button"
          onClick={() => setEnabled(true)}
          className={`rounded-full px-4 py-2 text-[13px] font-semibold transition-colors ${
            enabled
              ? 'bg-[#1877F2] text-white'
              : 'border border-theme-border bg-theme-surface text-theme-muted hover:text-theme-fg'
          }`}
        >
          With mock data
        </button>
      </div>
      <p className="mt-3 text-[12.5px] leading-relaxed text-theme-muted">
        {enabled
          ? 'Sample threads, metrics, the Email mailbox, and notification drawer alerts are shown. Turn this off to see empty production screens.'
          : 'Production behaviour. Email stays disconnected until Gmail is connected. The bell shows only real alerts.'}
      </p>
    </SettingsPanel>
  );
}

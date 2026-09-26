import { FlaskConical } from 'lucide-react';
import SettingsPanel from './SettingsPanel';
import { useMetaMock } from '../../contexts/MetaMockContext';

export default function MetaPreviewMockPanel() {
  const { enabled, setEnabled } = useMetaMock();

  return (
    <SettingsPanel
      title="Meta preview data"
      description="Sample rows on Messenger Inbox, Ads (KPIs + campaigns), Instagram Inbox, and Comments. Live Meta data still loads and appears together."
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
          ? 'Sample threads and metrics are mixed with anything Meta sends. New real messages and comments stay in the same lists.'
          : 'Only production behaviour — empty states and guides when Meta has not returned data yet.'}
      </p>
    </SettingsPanel>
  );
}

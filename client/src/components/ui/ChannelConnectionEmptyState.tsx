import { Settings2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import AppButton from './AppButton';
import EmptyState from './EmptyState';

/** Empty body when no WhatsApp / Facebook / Instagram channel is connected. */
export default function ChannelConnectionEmptyState({ task }: { task: string }) {
  return (
    <div className="p-4 sm:p-6">
      <EmptyState
        icon={Settings2}
        title="Connect a channel first"
        description={`Connect WhatsApp, a Facebook Page, or Instagram to ${task}.`}
        steps={[
          'Open Settings',
          'Connect WhatsApp or a Facebook Page',
          'Instagram can connect after the Page',
        ]}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Link to="/settings?tab=whatsapp">
              <AppButton icon={<Settings2 size={16} />}>Connect WhatsApp</AppButton>
            </Link>
            <Link to="/settings?tab=facebook">
              <AppButton variant="secondary">Connect Facebook Page</AppButton>
            </Link>
          </div>
        }
      />
    </div>
  );
}

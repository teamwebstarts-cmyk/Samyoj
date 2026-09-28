import PreConnectHero from './PreConnectHero';
import PreConnectSteps from './PreConnectSteps';
import { useWhatsAppConnectPicker } from '../../hooks/useWhatsAppConnectPicker';
import { useMetaChannelConnect } from '../layout/MetaChannelChips';
import WhatsAppConnectModeModal from '../whatsapp/WhatsAppConnectModeModal';

/** Full Dashboard body when no WhatsApp, Facebook, or Instagram channel is connected. */
export default function PreConnectDashboard() {
  const {
    pickerOpen,
    openPicker,
    closePicker,
    connectStandard,
    connectCoexistence,
    connecting,
  } = useWhatsAppConnectPicker({ returnPath: '/' });
  const { canConnect, busy, startFacebookConnect, startInstagramConnect } = useMetaChannelConnect();

  return (
    <div className="dashboard-stack pb-4 sm:pb-2">
      <PreConnectHero
        connecting={connecting}
        facebookConnecting={busy === 'fb'}
        instagramConnecting={busy === 'ig'}
        onConnect={openPicker}
        onConnectFacebook={canConnect ? () => void startFacebookConnect() : undefined}
        onConnectInstagram={canConnect ? () => void startInstagramConnect() : undefined}
      />
      <PreConnectSteps
        connecting={connecting}
        facebookConnecting={busy === 'fb'}
        instagramConnecting={busy === 'ig'}
        onConnect={openPicker}
        onConnectFacebook={canConnect ? () => void startFacebookConnect() : undefined}
        onConnectInstagram={canConnect ? () => void startInstagramConnect() : undefined}
      />

      <WhatsAppConnectModeModal
        open={pickerOpen}
        onClose={closePicker}
        onConnectStandard={connectStandard}
        onConnectCoexistence={connectCoexistence}
        connecting={connecting}
      />
    </div>
  );
}

export function PreConnectSkeleton() {
  return (
    <div className="dashboard-stack animate-pulse">
      <div className="h-[220px] rounded-2xl bg-neutral-100/90 sm:h-[280px] sm:rounded-[1.25rem]" />
      <div>
        <div className="mb-[var(--card-gap)] h-5 w-52 rounded bg-neutral-100" />
        <div className="card-grid grid grid-cols-1 min-[640px]:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-44 rounded-2xl bg-neutral-100/90" />
          ))}
        </div>
      </div>
    </div>
  );
}

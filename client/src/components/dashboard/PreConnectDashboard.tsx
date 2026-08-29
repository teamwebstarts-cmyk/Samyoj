import { useState, useCallback } from 'react';
import PreConnectHero from './PreConnectHero';
import PreConnectSteps from './PreConnectSteps';
import PreConnectVideoModal from './PreConnectVideoModal';
import WhatsAppConnectModeModal from '../whatsapp/WhatsAppConnectModeModal';
import { useWhatsAppConnectPicker } from '../../hooks/useWhatsAppConnectPicker';
import { getPreconnectVideoUrl } from '../../utils/preconnectVideos';

const INTRO_VIDEO_URL = getPreconnectVideoUrl('intro');

/** Full Dashboard body when WhatsApp is not connected. */
export default function PreConnectDashboard() {
  const {
    pickerOpen,
    openPicker,
    closePicker,
    connectStandard,
    connectCoexistence,
    connecting,
  } = useWhatsAppConnectPicker({ returnPath: '/' });
  const [videoOpen, setVideoOpen] = useState(false);

  const openVideo = useCallback(() => setVideoOpen(true), []);
  const closeVideo = useCallback(() => setVideoOpen(false), []);

  return (
    <div className="dashboard-stack pb-4 sm:pb-2">
      <PreConnectHero connecting={connecting} onConnect={openPicker} onWatchVideo={INTRO_VIDEO_URL ? openVideo : undefined} />
      <PreConnectSteps connecting={connecting} onConnect={openPicker} />

      <PreConnectVideoModal
        open={videoOpen}
        title="Watch Setup Video"
        videoUrl={INTRO_VIDEO_URL}
        onClose={closeVideo}
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

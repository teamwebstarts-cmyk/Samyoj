import { useState, useCallback } from 'react';
import PreConnectHero from './PreConnectHero';
import PreConnectSteps from './PreConnectSteps';
import PreConnectFeatures from './PreConnectFeatures';
import PreConnectProTip from './PreConnectProTip';
import PreConnectVideoModal from './PreConnectVideoModal';
import { useWhatsAppConnectOAuth } from '../../hooks/useWhatsAppConnectOAuth';
import { getPreconnectVideoUrl } from '../../utils/preconnectVideos';

const INTRO_VIDEO_URL = getPreconnectVideoUrl('intro');

/** Full Dashboard body when WhatsApp is not connected. */
export default function PreConnectDashboard() {
  const { connect, connecting } = useWhatsAppConnectOAuth({ returnPath: '/' });
  const [videoOpen, setVideoOpen] = useState(false);

  const openVideo = useCallback(() => setVideoOpen(true), []);
  const closeVideo = useCallback(() => setVideoOpen(false), []);

  const scrollToFeatures = useCallback(() => {
    document.getElementById('preconnect-features')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, []);

  const scrollToSteps = useCallback(() => {
    document.getElementById('preconnect-steps')?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, []);

  return (
    <div className="space-y-5 pb-4 sm:space-y-7 sm:pb-2 lg:space-y-8">
      <PreConnectHero
        connecting={connecting}
        onConnect={connect}
        onWatchVideo={openVideo}
        onExploreFeatures={scrollToFeatures}
      />
      <PreConnectSteps connecting={connecting} onConnect={connect} onWatchVideo={openVideo} />
      <PreConnectFeatures />
      <PreConnectProTip onGetStarted={scrollToSteps} />

      <PreConnectVideoModal
        open={videoOpen}
        title="Watch Setup Video"
        videoUrl={INTRO_VIDEO_URL}
        onClose={closeVideo}
      />
    </div>
  );
}

export function PreConnectSkeleton() {
  return (
    <div className="animate-pulse space-y-5 sm:space-y-7">
      <div className="h-[280px] rounded-2xl bg-neutral-100/90 sm:h-[340px] sm:rounded-[1.25rem]" />
      <div>
        <div className="mb-3 h-5 w-52 rounded bg-neutral-100 sm:mb-4" />
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_280px]">
          <div className="grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-44 rounded-2xl bg-neutral-100/90" />
            ))}
          </div>
          <div className="h-52 rounded-2xl bg-neutral-100/90" />
        </div>
      </div>
      <div>
        <div className="mb-3 h-5 w-64 rounded bg-neutral-100" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-36 rounded-2xl bg-neutral-100/80" />
          ))}
        </div>
      </div>
      <div className="h-16 rounded-2xl bg-emerald-50/80" />
    </div>
  );
}

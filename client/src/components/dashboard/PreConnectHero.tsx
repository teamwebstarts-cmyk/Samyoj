import { useState } from 'react';
import { ArrowRight, Play } from 'lucide-react';
import AppButton from '../ui/AppButton';
import WhatsAppGlyph from './icons/WhatsAppGlyph';
import { useWhatsAppConnectOAuth } from '../../hooks/useWhatsAppConnectOAuth';
import PreConnectVideoModal from './PreConnectVideoModal';
import {
  getPreconnectVideoUrl,
  isDirectMediaUrl,
  youtubePosterUrl,
} from '../../utils/preconnectVideos';

const INTRO_VIDEO_URL = getPreconnectVideoUrl('intro');

export default function PreConnectHero() {
  const { connect, connecting } = useWhatsAppConnectOAuth({ returnPath: '/' });
  const [videoOpen, setVideoOpen] = useState(false);

  const direct = INTRO_VIDEO_URL && isDirectMediaUrl(INTRO_VIDEO_URL) ? INTRO_VIDEO_URL : null;
  const ytPoster = INTRO_VIDEO_URL ? youtubePosterUrl(INTRO_VIDEO_URL) : null;

  return (
    <>
      <section
        aria-label="Welcome"
        className="relative overflow-hidden rounded-2xl border border-neutral-100/90 bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.06)] sm:rounded-[1.75rem] sm:p-5 md:rounded-[2rem] md:p-6 lg:p-7"
      >
        <span className="pointer-events-none absolute right-[12%] top-8 h-1.5 w-1.5 rotate-45 bg-emerald-200/90 sm:right-[38%]" aria-hidden />

        <div className="relative grid grid-cols-1 items-center gap-4 sm:gap-5 lg:grid-cols-2 lg:gap-8">
          <div className="order-1 min-w-0">
            <p className="text-[12.5px] font-semibold text-neutral-500 sm:text-[13.5px]">
              Welcome to Samyoj <span aria-hidden>👋</span>
            </p>
            <h2 className="mt-1 max-w-md text-[21px] font-bold leading-[1.25] tracking-tight text-neutral-900 sm:mt-1.5 sm:text-[28px] lg:text-[30px]">
              Let&apos;s set up WhatsApp{' '}
              <span className="text-[#25D366]">Business and grow together</span>
            </h2>
            <p className="mt-2 max-w-md text-[13px] font-medium leading-relaxed text-neutral-500 sm:text-[14px]">
              Learn, connect and start engaging with your customers.
            </p>

            <div className="mt-4 flex w-full flex-col items-stretch gap-2 sm:mt-5 sm:max-w-sm sm:items-start">
              <AppButton
                type="button"
                size="lg"
                loading={connecting}
                disabled={connecting}
                onClick={connect}
                icon={<WhatsAppGlyph className="h-5 w-5 text-white" />}
                className="!h-11 !min-h-[44px] !w-full !rounded-xl !bg-none ![background:#25D366] !px-5 !text-[14px] !font-bold hover:![background:#1ebe57] hover:![filter:none] sm:!w-auto"
              >
                Connect WhatsApp
              </AppButton>

              <button
                type="button"
                onClick={() => setVideoOpen(true)}
                className="group inline-flex min-h-[40px] items-center gap-2 rounded-xl px-1 py-1.5 text-left text-[13px] font-semibold text-neutral-700 transition hover:text-neutral-900 sm:text-[13.5px]"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#25D366] text-white shadow-sm transition group-hover:bg-[#1ebe57]">
                  <Play className="h-3 w-3" fill="currentColor" strokeWidth={0} />
                </span>
                <span className="min-w-0">Watch introductory video</span>
                <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#25D366] transition group-hover:translate-x-0.5 group-hover:text-[#1ebe57]" strokeWidth={2.25} />
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setVideoOpen(true)}
            className="group relative order-2 mx-auto w-full max-w-[400px] overflow-hidden rounded-xl text-left outline-none ring-offset-2 transition hover:shadow-lg focus-visible:ring-2 focus-visible:ring-emerald-500/60 sm:max-w-[440px] sm:rounded-2xl lg:mx-0 lg:max-w-[460px] lg:justify-self-end"
            aria-label="Play introductory video"
          >
            {direct ? (
              <video
                src={direct}
                muted
                playsInline
                preload="metadata"
                className="h-[200px] w-full object-cover sm:h-[250px] lg:h-[280px]"
                aria-hidden
              />
            ) : ytPoster ? (
              <div className="relative h-[200px] w-full overflow-hidden bg-neutral-900 sm:h-[250px] lg:h-[280px]">
                <img
                  src={ytPoster}
                  alt=""
                  className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100"
                  draggable={false}
                />
              </div>
            ) : (
              <img
                src="/dashboard/preconnect-hero.svg"
                alt=""
                className="h-[200px] w-full select-none object-contain object-center sm:h-[250px] lg:h-[280px]"
                draggable={false}
              />
            )}

            <span
              className="pointer-events-none absolute inset-0 flex items-center justify-center bg-gradient-to-t from-neutral-900/10 via-transparent to-transparent"
              aria-hidden
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/95 text-[#25D366] shadow-[0_8px_28px_rgba(15,23,42,0.22)] ring-1 ring-black/5 transition duration-200 group-hover:scale-105 group-hover:bg-white sm:h-12 sm:w-12">
                <Play className="ml-0.5 h-4 w-4 sm:h-5 sm:w-5" fill="currentColor" strokeWidth={0} />
              </span>
            </span>
          </button>
        </div>
      </section>

      <PreConnectVideoModal
        open={videoOpen}
        title="What is WhatsApp Business API?"
        videoUrl={INTRO_VIDEO_URL}
        onClose={() => setVideoOpen(false)}
      />
    </>
  );
}

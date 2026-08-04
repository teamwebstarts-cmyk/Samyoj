import { useState } from 'react';
import { ArrowRight, Play } from 'lucide-react';
import AppButton from '../ui/AppButton';
import WhatsAppGlyph from './icons/WhatsAppGlyph';
import { useWhatsAppConnectOAuth } from '../../hooks/useWhatsAppConnectOAuth';
import PreConnectVideoModal from './PreConnectVideoModal';

const INTRO_VIDEO_URL = import.meta.env.VITE_PRECONNECT_VIDEO_URL as string | undefined;

export default function PreConnectHero() {
  const { connect, connecting } = useWhatsAppConnectOAuth({ returnPath: '/' });
  const [videoOpen, setVideoOpen] = useState(false);

  return (
    <>
      <section
        aria-label="Welcome"
        className="relative overflow-hidden rounded-[1.75rem] border border-neutral-100/90 bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.06)] sm:rounded-[2rem] sm:p-8 lg:p-10"
      >
        {/* Sparkles */}
        <span className="pointer-events-none absolute left-[42%] top-8 h-2 w-2 rotate-45 bg-teal-200/80 sm:left-[48%]" aria-hidden />
        <span className="pointer-events-none absolute right-[38%] top-16 h-1.5 w-1.5 rotate-45 bg-emerald-200/90 sm:right-[42%]" aria-hidden />
        <span className="pointer-events-none absolute bottom-24 left-[40%] hidden h-2 w-2 rotate-45 bg-teal-100 sm:block" aria-hidden />

        <div className="relative grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-10">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-neutral-500 sm:text-[14px]">
              Welcome to Samyoj <span aria-hidden>👋</span>
            </p>
            <h2 className="mt-2 max-w-md text-[26px] font-bold leading-[1.2] tracking-tight text-neutral-900 sm:text-[32px] lg:text-[34px]">
              Let&apos;s set up WhatsApp{' '}
              <span className="text-whatsapp-600">Business and grow together</span>
            </h2>
            <p className="mt-3 max-w-md text-[14px] font-medium leading-relaxed text-neutral-500 sm:text-[15px]">
              Learn, connect and start engaging with your customers.
            </p>

            <div className="mt-6 flex flex-col items-start gap-3 sm:mt-7">
              <AppButton
                type="button"
                size="lg"
                loading={connecting}
                disabled={connecting}
                onClick={connect}
                icon={<WhatsAppGlyph className="h-5 w-5 text-white" />}
                className="!min-h-[48px] !rounded-xl !bg-[#22C55E] !px-5 !text-[14px] !font-bold hover:!bg-[#16A34A]"
              >
                Connect WhatsApp
              </AppButton>

              <button
                type="button"
                onClick={() => setVideoOpen(true)}
                className="group inline-flex w-full max-w-sm items-center gap-2.5 rounded-xl px-1 py-2 text-left text-[13.5px] font-semibold text-neutral-700 transition hover:text-neutral-900 sm:text-[14px]"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-600 shadow-sm transition group-hover:border-emerald-200 group-hover:text-emerald-700">
                  <Play className="h-3.5 w-3.5" fill="currentColor" strokeWidth={0} />
                </span>
                <span className="flex-1">Watch introductory video</span>
                <ArrowRight className="h-4 w-4 shrink-0 text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-neutral-700" strokeWidth={2.25} />
              </button>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[440px] lg:mx-0 lg:justify-self-end">
            <img
              src="/dashboard/preconnect-hero.svg"
              alt=""
              className="h-auto w-full select-none"
              draggable={false}
            />
          </div>
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

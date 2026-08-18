import { Play } from 'lucide-react';
import AppButton from '../ui/AppButton';
import WhatsAppGlyph from './icons/WhatsAppGlyph';
import { useAuth } from '../../contexts/AuthContext';

interface PreConnectHeroProps {
  connecting: boolean;
  onConnect: () => void;
  onWatchVideo?: () => void;
}

function firstName(name: string | undefined | null): string {
  if (!name?.trim()) return '';
  return name.trim().split(/\s+/)[0] || '';
}

export default function PreConnectHero({
  connecting,
  onConnect,
  onWatchVideo,
}: PreConnectHeroProps) {
  const { user } = useAuth();
  const name = firstName(user?.name);

  return (
    <section
      aria-label="Welcome"
      className="relative overflow-hidden rounded-2xl border border-neutral-100/90 px-6 py-5 shadow-[0_12px_40px_rgba(15,23,42,0.06)] sm:rounded-[1.25rem] sm:px-8 sm:py-6 lg:px-10 lg:py-7"
      style={{
        background:
          'linear-gradient(115deg, #f0fdf6 0%, #ffffff 38%, #faf5ff 72%, #fff1f2 100%)',
      }}
    >
      <span
        className="pointer-events-none absolute -left-20 top-6 h-64 w-64 rounded-full bg-emerald-200/30 blur-3xl"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute bottom-[-40px] right-[-20px] h-72 w-72 rounded-full bg-rose-200/35 blur-3xl"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute right-[8%] top-[-30px] h-56 w-56 rounded-full bg-fuchsia-200/25 blur-3xl"
        aria-hidden
      />

      <div className="relative grid grid-cols-1 items-center gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(280px,1fr)] lg:gap-8">
        <div className="flex min-w-0 flex-col justify-center py-1 sm:py-2">
          <p className="text-[14px] font-semibold text-neutral-600 sm:text-[15px]">
            Welcome to Samyoj{name ? `, ${name}` : ''}! <span aria-hidden>👋</span>
          </p>
          <h2 className="mt-2.5 max-w-lg text-[24px] font-bold leading-[1.28] tracking-tight text-neutral-900 sm:mt-3 sm:text-[30px] lg:text-[32px]">
            Let&apos;s set up your WhatsApp Business and{' '}
            <span className="text-[#25D366]">grow together</span>
          </h2>
          <p className="mt-2 max-w-md text-[13px] font-medium leading-relaxed text-neutral-500 sm:text-[14px]">
            Automate, engage and convert — all in one place.
          </p>

          <div className="mt-4 flex w-full flex-col gap-2.5 sm:mt-5 sm:flex-row sm:flex-wrap sm:items-center">
            <AppButton
              type="button"
              size="lg"
              loading={connecting}
              disabled={connecting}
              onClick={onConnect}
              icon={<WhatsAppGlyph className="h-5 w-5 text-white" />}
              className="!h-11 !min-h-[44px] !w-full !rounded-xl !bg-none ![background:#25D366] !px-5 !text-[14px] !font-bold hover:![background:#1ebe57] hover:![filter:none] sm:!w-auto"
            >
              Connect WhatsApp
            </AppButton>

            {onWatchVideo && (
              <button
                type="button"
                onClick={onWatchVideo}
                className="inline-flex h-11 min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 text-[13.5px] font-semibold text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50 sm:w-auto sm:text-[14px]"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-neutral-200 text-neutral-600">
                  <Play className="ml-0.5 h-2.5 w-2.5" fill="currentColor" strokeWidth={0} />
                </span>
                Watch Setup Video
              </button>
            )}
          </div>
        </div>

        <div className="relative flex items-center justify-center self-stretch py-1 lg:py-0">
          <span
            className="pointer-events-none absolute left-1/2 top-1/2 h-[88%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-100/55 blur-2xl"
            aria-hidden
          />
          {onWatchVideo ? (
            <button
              type="button"
              onClick={onWatchVideo}
              aria-label="Watch Setup Video"
              className="group relative w-full max-w-[520px] rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]/60 focus-visible:ring-offset-2 lg:max-w-none"
            >
              <div
                className="relative w-full"
                style={{
                  WebkitMaskImage:
                    'radial-gradient(ellipse 72% 78% at 50% 48%, #000 52%, rgba(0,0,0,0.85) 68%, transparent 92%)',
                  maskImage:
                    'radial-gradient(ellipse 72% 78% at 50% 48%, #000 52%, rgba(0,0,0,0.85) 68%, transparent 92%)',
                }}
              >
                <img
                  src="/dashboard/preconnect-hero-photo.png"
                  alt=""
                  className="mx-auto h-auto w-full max-h-[300px] select-none object-contain object-center sm:max-h-[360px] lg:max-h-[400px] xl:max-h-[440px]"
                  draggable={false}
                  onError={(e) => {
                    const el = e.currentTarget;
                    if (el.getAttribute('data-fallback') === '1') return;
                    el.setAttribute('data-fallback', '1');
                    el.src = '/dashboard/preconnect-hero.svg';
                  }}
                />
              </div>
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_12px_36px_rgba(37,211,102,0.45)] ring-[6px] ring-white/80 transition motion-safe:group-hover:scale-105 sm:h-16 sm:w-16">
                  <Play className="ml-0.5 h-6 w-6 sm:h-7 sm:w-7" fill="currentColor" strokeWidth={0} />
                </span>
              </span>
            </button>
          ) : (
            <div className="relative w-full max-w-[520px] lg:max-w-none">
              <div
                className="relative w-full"
                style={{
                  WebkitMaskImage:
                    'radial-gradient(ellipse 72% 78% at 50% 48%, #000 52%, rgba(0,0,0,0.85) 68%, transparent 92%)',
                  maskImage:
                    'radial-gradient(ellipse 72% 78% at 50% 48%, #000 52%, rgba(0,0,0,0.85) 68%, transparent 92%)',
                }}
              >
                <img
                  src="/dashboard/preconnect-hero-photo.png"
                  alt=""
                  className="mx-auto h-auto w-full max-h-[300px] select-none object-contain object-center sm:max-h-[360px] lg:max-h-[400px] xl:max-h-[440px]"
                  draggable={false}
                  onError={(e) => {
                    const el = e.currentTarget;
                    if (el.getAttribute('data-fallback') === '1') return;
                    el.setAttribute('data-fallback', '1');
                    el.src = '/dashboard/preconnect-hero.svg';
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

import { Headphones, Lightbulb, Play, ShieldCheck } from 'lucide-react';
import AppButton from '../ui/AppButton';
import WhatsAppGlyph from './icons/WhatsAppGlyph';
import { useAuth } from '../../contexts/AuthContext';
import PreConnectQuickActions from './PreConnectQuickActions';

interface PreConnectHeroProps {
  connecting: boolean;
  onConnect: () => void;
  onWatchVideo: () => void;
  onExploreFeatures: () => void;
}

function firstName(name: string | undefined | null): string {
  if (!name?.trim()) return '';
  return name.trim().split(/\s+/)[0] || '';
}

const TRUST = [
  {
    id: 'easy',
    title: 'Easy to Use',
    desc: 'Beginner friendly',
    icon: Lightbulb,
    well: 'bg-emerald-100 text-emerald-700',
  },
  {
    id: 'secure',
    title: 'Secure & Reliable',
    desc: 'Enterprise grade security',
    icon: ShieldCheck,
    well: 'bg-sky-100 text-sky-700',
  },
  {
    id: 'support',
    title: '24/7 Support',
    desc: "We're always here",
    icon: Headphones,
    well: 'bg-violet-100 text-violet-700',
  },
] as const;

export default function PreConnectHero({
  connecting,
  onConnect,
  onWatchVideo,
  onExploreFeatures,
}: PreConnectHeroProps) {
  const { user } = useAuth();
  const name = firstName(user?.name);

  return (
    <section
      aria-label="Welcome"
      className="relative overflow-hidden rounded-2xl border border-neutral-100/90 p-3 shadow-[0_12px_40px_rgba(15,23,42,0.06)] sm:rounded-[1.25rem] sm:p-4 md:rounded-2xl md:p-5 lg:p-4 xl:p-5"
      style={{
        background:
          'linear-gradient(115deg, #f0fdf6 0%, #ffffff 38%, #faf5ff 72%, #fff1f2 100%)',
      }}
    >
      {/* Soft field glows */}
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
      <span
        className="pointer-events-none absolute right-[42%] top-12 h-1.5 w-1.5 rounded-full bg-emerald-300/80"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute right-[48%] top-28 h-1 w-1 rounded-full bg-violet-300/70"
        aria-hidden
      />

      <div className="relative grid grid-cols-1 gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(260px,1.05fr)_minmax(260px,300px)] lg:items-center lg:gap-1 xl:gap-1.5">
        <div className="flex min-w-0 flex-col justify-center py-2 sm:py-2.5 lg:py-3">
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
          </div>

          <ul className="mt-8 grid grid-cols-1 gap-4 min-[420px]:grid-cols-3 sm:mt-9 sm:gap-5 lg:mt-10">
            {TRUST.map((t) => {
              const Icon = t.icon;
              return (
                <li key={t.id} className="flex items-start gap-3">
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${t.well}`}
                  >
                    <Icon className="h-[18px] w-[18px]" strokeWidth={2.1} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-bold text-neutral-900 sm:text-[13.5px]">
                      {t.title}
                    </span>
                    <span className="mt-0.5 block text-[12px] font-medium leading-snug text-neutral-500 sm:text-[12.5px]">
                      {t.desc}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="grid grid-cols-1 gap-1.5 min-[720px]:grid-cols-2 lg:contents">
          {/* Hero image — taller + soft merge into card bg */}
          <div className="relative flex items-center justify-center self-stretch py-1 lg:py-0">
            <span
              className="pointer-events-none absolute left-1/2 top-1/2 h-[88%] w-[78%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-100/55 blur-2xl"
              aria-hidden
            />
            <span
              className="pointer-events-none absolute left-1/2 top-[48%] h-[70%] w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/40 blur-xl"
              aria-hidden
            />
            <div
              className="relative w-full max-w-[520px] lg:max-w-none"
              style={{
                WebkitMaskImage:
                  'radial-gradient(ellipse 72% 78% at 50% 48%, #000 52%, rgba(0,0,0,0.85) 68%, transparent 92%)',
                maskImage:
                  'radial-gradient(ellipse 72% 78% at 50% 48%, #000 52%, rgba(0,0,0,0.85) 68%, transparent 92%)',
              }}
            >
              <img
                src="/dashboard/preconnect-hero-photo.png"
                alt="Professional using Samyoj on a laptop"
                className="mx-auto h-auto w-full max-h-[300px] select-none object-contain object-center sm:max-h-[360px] lg:max-h-[420px] xl:max-h-[460px]"
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

          {/* Quick Actions — soft pink glow behind; align top */}
          <div className="relative min-w-0 self-start pt-0 lg:pt-0">
            <span
              className="pointer-events-none absolute -inset-2 rounded-[1.75rem] bg-gradient-to-br from-rose-200/40 via-fuchsia-100/30 to-orange-100/25 blur-xl"
              aria-hidden
            />
            <span
              className="pointer-events-none absolute -right-2 top-1/2 h-32 w-32 -translate-y-1/2 rounded-full bg-rose-200/30 blur-2xl"
              aria-hidden
            />
            <div className="relative">
              <PreConnectQuickActions onExploreFeatures={onExploreFeatures} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

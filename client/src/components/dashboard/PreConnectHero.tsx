import { Facebook, Instagram } from 'lucide-react';
import AppButton from '../ui/AppButton';
import WhatsAppGlyph from './icons/WhatsAppGlyph';
import PreConnectScene from './PreConnectScene';
import { useAuth } from '../../contexts/AuthContext';

interface PreConnectHeroProps {
  connecting: boolean;
  facebookConnecting?: boolean;
  instagramConnecting?: boolean;
  onConnect: () => void;
  onConnectFacebook?: () => void;
  onConnectInstagram?: () => void;
}

function firstName(name: string | undefined | null): string {
  if (!name?.trim()) return '';
  return name.trim().split(/\s+/)[0] || '';
}

export default function PreConnectHero({
  connecting,
  facebookConnecting = false,
  instagramConnecting = false,
  onConnect,
  onConnectFacebook,
  onConnectInstagram,
}: PreConnectHeroProps) {
  const { user } = useAuth();
  const name = firstName(user?.name);
  const busy = connecting || facebookConnecting || instagramConnecting;

  return (
    <section
      aria-label="Welcome"
      className="relative overflow-hidden rounded-2xl border border-emerald-100/50 px-5 py-6 shadow-[0_12px_40px_rgba(15,23,42,0.05)] sm:rounded-[1.25rem] sm:px-7 sm:py-7 lg:min-h-[300px] lg:px-9 lg:py-8 xl:min-h-[320px]"
      style={{
        background:
          'radial-gradient(ellipse 70% 80% at 0% 20%, rgba(37, 211, 102, 0.09), transparent 55%), radial-gradient(ellipse 55% 70% at 100% 80%, rgba(244, 114, 182, 0.07), transparent 50%), linear-gradient(165deg, #ffffff 0%, #f7fef9 36%, #faf5ff 68%, #fff8f8 100%)',
      }}
    >
      <span
        className="pointer-events-none absolute -left-20 top-8 h-56 w-56 rounded-full bg-emerald-200/20 blur-3xl"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute bottom-[-40px] right-[-20px] h-64 w-64 rounded-full bg-rose-200/20 blur-3xl"
        aria-hidden
      />
      <span
        className="pointer-events-none absolute right-[8%] top-[-30px] h-52 w-52 rounded-full bg-fuchsia-200/15 blur-3xl"
        aria-hidden
      />

      <div className="relative grid grid-cols-1 items-center gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,1.05fr)] lg:gap-7">
        <div className="flex min-w-0 flex-col justify-center py-1 lg:py-0">
          <p className="text-[12px] font-semibold text-neutral-600 sm:text-[13px]">
            Welcome to Samyoj{name ? `, ${name}` : ''}! <span aria-hidden>👋</span>
          </p>
          <h2 className="mt-2 max-w-[34rem] text-[27px] font-black leading-[1.08] tracking-tight text-neutral-900 sm:text-[30px]">
            Connect. Automate. Grow<br className="hidden sm:block" /> across{' '}
            <span className="text-[#25D366]">WhatsApp</span>, <span className="text-[#1877F2]">Facebook</span>{' '}
            <span className="text-[#C13584]">&amp; Instagram</span>
          </h2>
          <p className="mt-2.5 max-w-[31rem] text-[11px] font-medium leading-[1.45] text-neutral-500 sm:text-[12px]">
            Manage conversations, automate replies, run campaigns and track performance — all from one place.
          </p>

          <div className="mt-4 flex w-full flex-wrap items-center gap-2.5">
            <AppButton
              type="button"
              size="lg"
              loading={connecting}
              disabled={busy}
              onClick={onConnect}
              icon={<WhatsAppGlyph className="h-3.5 w-3.5 text-white" />}
              className="!h-10 !min-h-10 !w-auto !rounded-lg !bg-none ![background:#25D366] !px-4 !text-[11px] !font-bold hover:![background:#1ebe57] hover:![filter:none] sm:!text-[12px]"
            >
              Connect WhatsApp
            </AppButton>

            {onConnectFacebook ? (
              <AppButton
                type="button"
                size="lg"
                loading={facebookConnecting}
                disabled={busy}
                onClick={onConnectFacebook}
                icon={<Facebook className="h-3.5 w-3.5 text-white" />}
                className="!h-10 !min-h-10 !w-auto !rounded-lg !bg-none ![background:#1877F2] !px-4 !text-[11px] !font-bold hover:![background:#166fe5] hover:![filter:none] sm:!text-[12px]"
              >
                Connect Facebook
              </AppButton>
            ) : null}

            {onConnectInstagram ? (
              <AppButton
                type="button"
                size="lg"
                loading={instagramConnecting}
                disabled={busy}
                onClick={onConnectInstagram}
                icon={<Instagram className="h-3.5 w-3.5 text-white" />}
                className="!h-10 !min-h-10 !w-auto !rounded-lg !bg-none ![background:linear-gradient(90deg,#C13584,#F58529)] !px-4 !text-[11px] !font-bold hover:![filter:brightness(0.96)] sm:!text-[12px]"
              >
                Connect Instagram
              </AppButton>
            ) : null}
          </div>
        </div>

        <div className="relative flex min-h-[220px] items-center justify-center self-stretch sm:min-h-[260px] lg:min-h-0">
          <PreConnectScene />
        </div>
      </div>
    </section>
  );
}

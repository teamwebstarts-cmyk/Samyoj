import { Link } from 'react-router-dom';
import { ArrowRight, Bot, Instagram, Store } from 'lucide-react';
import WhatsAppGlyph from './icons/WhatsAppGlyph';

type StepTone = 'green' | 'blue' | 'pink' | 'purple';

interface StepDef {
  n: number;
  title: string;
  description: string;
  cta: string;
  tone: StepTone;
  kind: 'whatsapp' | 'facebook' | 'instagram' | 'link';
  to?: string;
}

const STEPS: StepDef[] = [
  {
    n: 1,
    title: 'Connect WhatsApp',
    description: 'Connect your WhatsApp Business account in just a few clicks.',
    cta: 'Connect Now',
    tone: 'green',
    kind: 'whatsapp',
  },
  {
    n: 2,
    title: 'Connect Facebook',
    description: 'Link your Facebook Page to manage Messenger and view ad performance.',
    cta: 'Connect Now',
    tone: 'blue',
    kind: 'facebook',
  },
  {
    n: 3,
    title: 'Connect Instagram',
    description: 'Connect your Instagram Business account to manage DMs and comments.',
    cta: 'Connect Now',
    tone: 'pink',
    kind: 'instagram',
  },
  {
    n: 4,
    title: 'Set Up Your First Bot',
    description: 'Automate conversations and support with AI-powered bots.',
    cta: 'Create Bot',
    tone: 'purple',
    kind: 'link',
    to: '/ai-bot',
  },
];

const TONE = {
  green: {
    badge: 'bg-emerald-100/70 text-[#159447]',
    iconWell: 'bg-[#25D366] text-white',
    card: 'border-emerald-100/80 bg-emerald-50/25',
    btn: 'bg-emerald-50 text-[#159447] hover:bg-emerald-100',
  },
  blue: {
    badge: 'bg-blue-100/70 text-[#2563eb]',
    iconWell: 'bg-[#1877F2] text-white',
    card: 'border-blue-100/80 bg-blue-50/20',
    btn: 'bg-blue-50 text-[#2563eb] hover:bg-blue-100',
  },
  pink: {
    badge: 'bg-pink-100/70 text-[#d6294a]',
    iconWell: 'bg-[linear-gradient(135deg,#C13584,#F58529)] text-white',
    card: 'border-pink-100/80 bg-pink-50/20',
    btn: 'bg-pink-50 text-[#d6294a] hover:bg-pink-100',
  },
  purple: {
    badge: 'bg-violet-100/70 text-[#7c4fe0]',
    iconWell: 'bg-violet-500 text-white',
    card: 'border-violet-100/80 bg-violet-50/20',
    btn: 'bg-violet-50 text-[#7c4fe0] hover:bg-violet-100',
  },
} as const;

function StepIcon({ tone }: { tone: StepTone }) {
  const cls = 'h-5 w-5 sm:h-[22px] sm:w-[22px]';
  if (tone === 'green') return <WhatsAppGlyph className={cls} />;
  if (tone === 'blue') return <span className="font-black text-[19px]">f</span>;
  if (tone === 'pink') return <Instagram className={cls} strokeWidth={2.1} />;
  if (tone === 'purple') return <Bot className={cls} strokeWidth={2.1} />;
  return <Store className={cls} strokeWidth={2.1} />;
}

interface PreConnectStepsProps {
  connecting: boolean;
  facebookConnecting?: boolean;
  instagramConnecting?: boolean;
  onConnect: () => void;
  onConnectFacebook?: () => void;
  onConnectInstagram?: () => void;
}

export default function PreConnectSteps({
  connecting,
  facebookConnecting = false,
  instagramConnecting = false,
  onConnect,
  onConnectFacebook,
  onConnectInstagram,
}: PreConnectStepsProps) {
  return (
    <section id="preconnect-steps" aria-label="Get started in 4 easy steps" className="scroll-mt-20">
      <div>
        <h3 className="text-[16px] font-extrabold tracking-tight text-neutral-900 sm:text-[17px]">
          Get started in 4 easy steps
        </h3>
        <p className="mt-1 text-[11px] font-medium text-neutral-500 sm:text-[12px]">
          Connect your channels and start engaging with your customers.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 min-[640px]:grid-cols-2 min-[900px]:grid-cols-4">
          {STEPS.map((step) => {
            const t = TONE[step.tone];
            const ctaClass = `mt-3 inline-flex w-auto max-w-full items-center justify-center gap-1 self-start rounded-lg px-3 py-1.5 text-[11px] font-bold transition sm:text-[12px] ${t.btn} disabled:opacity-60`;

            return (
              <div key={step.n} className="min-w-0">
                <article className={`relative z-10 flex min-h-[174px] h-full flex-col rounded-2xl border p-4 shadow-[0_6px_18px_rgba(15,23,42,0.03)] ${t.card}`}>
                  <div className="mb-3 flex items-center gap-2.5">
                    <span
                      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold sm:h-8 sm:w-8 sm:text-[12px] ${t.badge}`}
                    >
                      {step.n}
                    </span>
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-sm sm:h-10 sm:w-10 ${t.iconWell}`}
                    >
                      <StepIcon tone={step.tone} />
                    </span>
                  </div>
                  <h4 className="mt-0.5 text-[14px] font-extrabold leading-snug text-neutral-900 sm:text-[15px]">
                    {step.title}
                  </h4>
                  <p className="mt-1.5 line-clamp-3 text-[11px] font-medium leading-[1.45] text-neutral-500 sm:text-[12px]">
                    {step.description}
                  </p>
                  <div className="mt-auto flex items-start pt-1">
                    {step.kind === 'whatsapp' ? (
                        <button
                          type="button"
                          disabled={connecting || facebookConnecting || instagramConnecting}
                          onClick={onConnect}
                          className={ctaClass}
                        >
                          {connecting ? 'Connecting…' : step.cta}
                          {!connecting && <ArrowRight className="h-3 w-3" strokeWidth={2.5} />}
                        </button>
                    ) : step.kind === 'facebook' ? (
                      onConnectFacebook ? (
                        <button
                          type="button"
                          disabled={connecting || facebookConnecting || instagramConnecting}
                          onClick={onConnectFacebook}
                          className={ctaClass}
                        >
                          {facebookConnecting ? 'Connecting…' : step.cta}
                          {!facebookConnecting && <ArrowRight className="h-3 w-3" strokeWidth={2.5} />}
                        </button>
                      ) : null
                    ) : step.kind === 'instagram' ? (
                      onConnectInstagram ? (
                        <button
                          type="button"
                          disabled={connecting || facebookConnecting || instagramConnecting}
                          onClick={onConnectInstagram}
                          className={ctaClass}
                        >
                          {instagramConnecting ? 'Connecting…' : step.cta}
                          {!instagramConnecting && <ArrowRight className="h-3 w-3" strokeWidth={2.5} />}
                        </button>
                      ) : null
                    ) : (
                      <Link to={step.to!} className={ctaClass}>
                        {step.cta}
                        <ArrowRight className="h-3 w-3" strokeWidth={2.5} />
                      </Link>
                    )}
                  </div>
                </article>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

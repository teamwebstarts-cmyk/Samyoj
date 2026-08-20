import { Link } from 'react-router-dom';
import { ArrowRight, Bot, ChevronRight, Megaphone, Store } from 'lucide-react';
import WhatsAppGlyph from './icons/WhatsAppGlyph';

type StepTone = 'green' | 'purple' | 'blue' | 'orange';

interface StepDef {
  n: number;
  title: string;
  description: string;
  cta: string;
  tone: StepTone;
  kind: 'connect' | 'link';
  to?: string;
}

const STEPS: StepDef[] = [
  {
    n: 1,
    title: 'Connect WhatsApp',
    description: 'Connect your WhatsApp Business Account in just a few clicks.',
    cta: 'Connect Now',
    tone: 'green',
    kind: 'connect',
  },
  {
    n: 2,
    title: 'Set Up Your Profile',
    description: 'Add your business details and profile information to get started.',
    cta: 'Set Up Profile',
    tone: 'purple',
    kind: 'link',
    to: '/settings?tab=profile',
  },
  {
    n: 3,
    title: 'Create Your First Bot',
    description: 'Automate conversations and support with AI-powered bots.',
    cta: 'Create Bot',
    tone: 'blue',
    kind: 'link',
    to: '/ai-bot',
  },
  {
    n: 4,
    title: 'Send Your First Campaign',
    description: 'Reach your audience with your first campaign and grow your business.',
    cta: 'Create Campaign',
    tone: 'orange',
    kind: 'link',
    to: '/campaigns',
  },
];

const TONE = {
  green: {
    badge: 'bg-[#25D366] text-white',
    iconWell: 'bg-emerald-50 text-[#25D366]',
    btn: 'bg-[#25D366] hover:bg-[#1ebe57] text-white',
  },
  purple: {
    badge: 'bg-[#8B5CF6] text-white',
    iconWell: 'bg-violet-50 text-[#8B5CF6]',
    btn: 'bg-[#8B5CF6] hover:bg-[#7c4fe0] text-white',
  },
  blue: {
    badge: 'bg-[#3B82F6] text-white',
    iconWell: 'bg-sky-50 text-[#3B82F6]',
    btn: 'bg-[#3B82F6] hover:bg-[#2563eb] text-white',
  },
  orange: {
    badge: 'bg-[#F97316] text-white',
    iconWell: 'bg-orange-50 text-[#F97316]',
    btn: 'bg-[#F97316] hover:bg-[#ea580c] text-white',
  },
} as const;

function StepIcon({ tone }: { tone: StepTone }) {
  const cls = 'h-5 w-5 sm:h-[22px] sm:w-[22px]';
  if (tone === 'green') return <WhatsAppGlyph className={cls} />;
  if (tone === 'purple') return <Store className={cls} strokeWidth={2.1} />;
  if (tone === 'blue') return <Bot className={cls} strokeWidth={2.1} />;
  return <Megaphone className={cls} strokeWidth={2.1} />;
}

function StepConnector() {
  return (
    <div
      className="pointer-events-none absolute -right-2.5 top-10 z-20 hidden w-5 items-center justify-center lg:flex xl:-right-3 xl:w-6"
      aria-hidden
    >
      <span className="flex w-full items-center text-neutral-300">
        <span className="h-0 flex-1 border-t-2 border-dashed border-neutral-300" />
        <ChevronRight className="-ml-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
      </span>
    </div>
  );
}

interface PreConnectStepsProps {
  connecting: boolean;
  onConnect: () => void;
}

export default function PreConnectSteps({ connecting, onConnect }: PreConnectStepsProps) {
  return (
    <section id="preconnect-steps" aria-label="Get started in 4 easy steps" className="scroll-mt-20">
      <div className="rounded-2xl border border-neutral-100 bg-white p-[var(--card-pad)] shadow-[0_4px_12px_rgba(15,23,42,0.05)]">
        <h3 className="mb-[var(--card-gap)] text-[16px] font-bold tracking-tight text-neutral-900 sm:text-[18px]">
          Get started in 4 easy steps
        </h3>

        <div className="card-grid card-grid-auto">
          {STEPS.map((step, index) => {
            const t = TONE[step.tone];
            const ctaClass = `mt-3 inline-flex w-auto max-w-full items-center justify-center gap-1 self-start rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition sm:text-[11.5px] ${t.btn} disabled:opacity-60`;

            return (
              <div key={step.n} className="relative min-w-0">
                {index < STEPS.length - 1 && <StepConnector />}

                <article className="relative z-10 flex h-full flex-col rounded-xl border border-neutral-100/90 bg-neutral-50/40 p-2.5 sm:p-3">
                  <div className="mb-3 flex items-center gap-2.5">
                    <span
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12 ${t.iconWell}`}
                    >
                      <StepIcon tone={step.tone} />
                    </span>
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold sm:h-7 sm:w-7 sm:text-[12px] ${t.badge}`}
                    >
                      {step.n}
                    </span>
                  </div>
                  <h4 className="mt-0.5 text-[14px] font-extrabold leading-snug text-neutral-900 sm:text-[15px]">
                    {step.title}
                  </h4>
                  <p className="mt-1.5 line-clamp-3 text-[11.5px] font-medium leading-snug text-neutral-500 sm:text-[12px]">
                    {step.description}
                  </p>
                  <div className="mt-auto flex justify-start pt-1">
                    {step.kind === 'connect' ? (
                      <button
                        type="button"
                        disabled={connecting}
                        onClick={onConnect}
                        className={ctaClass}
                      >
                        {connecting ? 'Connecting…' : step.cta}
                        {!connecting && <ArrowRight className="h-3 w-3" strokeWidth={2.5} />}
                      </button>
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

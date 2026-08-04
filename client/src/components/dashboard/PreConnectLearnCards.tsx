import { useState } from 'react';
import { ArrowRight, Play } from 'lucide-react';
import PreConnectVideoModal from './PreConnectVideoModal';

type LearnTone = 'blue' | 'purple' | 'green' | 'orange';

interface LearnCard {
  id: string;
  n: string;
  title: string;
  description: string;
  tone: LearnTone;
  envKey?: string;
}

const CARDS: LearnCard[] = [
  {
    id: 'api',
    n: '01',
    title: 'What is WhatsApp Business API',
    description: 'Learn the basics in 2 minutes',
    tone: 'blue',
    envKey: 'VITE_PRECONNECT_VIDEO_API',
  },
  {
    id: 'how',
    n: '02',
    title: 'How it works',
    description: 'Understand how everything connects',
    tone: 'purple',
    envKey: 'VITE_PRECONNECT_VIDEO_HOW',
  },
  {
    id: 'benefits',
    n: '03',
    title: 'Key Benefits',
    description: 'Why businesses love using WhatsApp',
    tone: 'green',
    envKey: 'VITE_PRECONNECT_VIDEO_BENEFITS',
  },
  {
    id: 'next',
    n: '04',
    title: 'Next Steps',
    description: 'Connect and start your journey',
    tone: 'orange',
    envKey: 'VITE_PRECONNECT_VIDEO_NEXT',
  },
];

const TONE: Record<
  LearnTone,
  { card: string; badge: string; action: string; play: string }
> = {
  blue: {
    card: 'border-sky-100/80 bg-sky-50/50',
    badge: 'bg-sky-500 text-white',
    action: 'text-sky-600 hover:text-sky-700',
    play: 'bg-sky-100 text-sky-600',
  },
  purple: {
    card: 'border-violet-100/80 bg-violet-50/50',
    badge: 'bg-violet-500 text-white',
    action: 'text-violet-600 hover:text-violet-700',
    play: 'bg-violet-100 text-violet-600',
  },
  green: {
    card: 'border-emerald-100/80 bg-emerald-50/50',
    badge: 'bg-emerald-500 text-white',
    action: 'text-emerald-600 hover:text-emerald-700',
    play: 'bg-emerald-100 text-emerald-600',
  },
  orange: {
    card: 'border-orange-100/80 bg-orange-50/50',
    badge: 'bg-orange-500 text-white',
    action: 'text-orange-600 hover:text-orange-700',
    play: 'bg-orange-100 text-orange-600',
  },
};

function envVideo(key?: string): string | undefined {
  if (!key) return undefined;
  const v = (import.meta.env as Record<string, string | undefined>)[key];
  return v || undefined;
}

export default function PreConnectLearnCards() {
  const [active, setActive] = useState<LearnCard | null>(null);

  return (
    <section aria-label="Learn the basics" className="space-y-4">
      <h3 className="text-[17px] font-bold tracking-tight text-neutral-900 sm:text-[18px]">
        Learn the basics
      </h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:gap-3.5">
        {CARDS.map((card) => {
          const t = TONE[card.tone];
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => setActive(card)}
              className={`flex min-h-[168px] flex-col rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md sm:rounded-[1.25rem] sm:p-5 ${t.card}`}
            >
              <span
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-[12px] font-bold ${t.badge}`}
              >
                {card.n}
              </span>
              <p className="mt-3 text-[14px] font-bold leading-snug text-neutral-900 sm:text-[15px]">
                {card.title}
              </p>
              <p className="mt-1.5 text-[12.5px] font-medium leading-relaxed text-neutral-500">
                {card.description}
              </p>
              <span className={`mt-auto flex items-center gap-2 pt-4 text-[13px] font-bold ${t.action}`}>
                Watch now
                <span className={`flex h-6 w-6 items-center justify-center rounded-full ${t.play}`}>
                  <Play className="h-3 w-3" fill="currentColor" strokeWidth={0} />
                </span>
                <ArrowRight className="ml-auto h-4 w-4" strokeWidth={2.25} />
              </span>
            </button>
          );
        })}
      </div>

      <PreConnectVideoModal
        open={Boolean(active)}
        title={active?.title || 'Learn the basics'}
        videoUrl={envVideo(active?.envKey) || (import.meta.env.VITE_PRECONNECT_VIDEO_URL as string | undefined)}
        onClose={() => setActive(null)}
      />
    </section>
  );
}

import { useState } from 'react';
import { ArrowRight, Play } from 'lucide-react';
import PreConnectVideoModal from './PreConnectVideoModal';
import {
  getPreconnectVideoUrl,
  type PreconnectVideoId,
} from '../../utils/preconnectVideos';

type LearnTone = 'blue' | 'purple' | 'green' | 'orange';

interface LearnCard {
  id: PreconnectVideoId;
  n: string;
  title: string;
  description: string;
  tone: LearnTone;
}

const CARDS: LearnCard[] = [
  {
    id: 'api',
    n: '01',
    title: 'What is WhatsApp Business API',
    description: 'Learn the basics in 2 minutes',
    tone: 'blue',
  },
  {
    id: 'how',
    n: '02',
    title: 'How it works',
    description: 'Understand how everything connects',
    tone: 'purple',
  },
  {
    id: 'benefits',
    n: '03',
    title: 'Key Benefits',
    description: 'Why businesses love using WhatsApp',
    tone: 'green',
  },
  {
    id: 'next',
    n: '04',
    title: 'Next Steps',
    description: 'Connect and start your journey',
    tone: 'orange',
  },
];

const TONE: Record<
  LearnTone,
  { card: string; badge: string; action: string; play: string }
> = {
  blue: {
    card: 'border-sky-100/80 bg-sky-50/50 hover:border-sky-200/90 active:border-sky-200',
    badge: 'bg-sky-100 text-sky-700',
    action: 'text-sky-600',
    play: 'bg-sky-100 text-sky-600',
  },
  purple: {
    card: 'border-violet-100/80 bg-violet-50/50 hover:border-violet-200/90 active:border-violet-200',
    badge: 'bg-violet-100 text-violet-700',
    action: 'text-violet-600',
    play: 'bg-violet-100 text-violet-600',
  },
  green: {
    card: 'border-emerald-100/80 bg-emerald-50/50 hover:border-whatsapp-500/35 active:border-whatsapp-500/40',
    badge: 'bg-emerald-100 text-emerald-700',
    action: 'text-[#25D366]',
    play: 'bg-[#25D366] text-white',
  },
  orange: {
    card: 'border-orange-100/80 bg-orange-50/50 hover:border-orange-200/90 active:border-orange-200',
    badge: 'bg-orange-100 text-orange-700',
    action: 'text-orange-600',
    play: 'bg-orange-100 text-orange-600',
  },
};

export default function PreConnectLearnCards() {
  const [active, setActive] = useState<LearnCard | null>(null);
  const activeUrl = active ? getPreconnectVideoUrl(active.id) : undefined;

  return (
    <section aria-label="Learn the basics" className="space-y-3 sm:space-y-4">
      <h3 className="text-[16px] font-bold tracking-tight text-neutral-900 sm:text-[18px]">
        Learn the basics
      </h3>
      <div className="grid grid-cols-1 gap-2.5 min-[480px]:grid-cols-2 min-[480px]:gap-3 xl:grid-cols-4 xl:gap-3.5">
        {CARDS.map((card) => {
          const t = TONE[card.tone];

          return (
            <button
              key={card.id}
              type="button"
              onClick={() => setActive(card)}
              className={`flex min-h-[132px] flex-col rounded-2xl border p-3.5 text-left shadow-sm transition duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_12px_32px_-12px_rgba(15,23,42,0.14)] active:scale-[0.99] sm:min-h-[148px] sm:rounded-[1.25rem] sm:p-5 ${t.card}`}
            >
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-bold sm:h-8 sm:w-8 sm:text-[12px] ${t.badge}`}
              >
                {card.n}
              </span>
              <p className="mt-2.5 text-[13.5px] font-bold leading-snug text-neutral-900 sm:mt-3 sm:text-[15px]">
                {card.title}
              </p>
              <p className="mt-1 text-[12px] font-medium leading-relaxed text-neutral-500 sm:mt-1.5 sm:text-[12.5px]">
                {card.description}
              </p>
              <span className={`mt-auto flex items-center gap-1.5 pt-3 text-[12.5px] font-bold sm:gap-2 sm:pt-4 sm:text-[13px] ${t.action}`}>
                Watch now
                <span className={`flex h-5 w-5 items-center justify-center rounded-lg sm:h-6 sm:w-6 ${t.play}`}>
                  <Play className="h-2.5 w-2.5 sm:h-3 sm:w-3" fill="currentColor" strokeWidth={0} />
                </span>
                <ArrowRight className="ml-auto h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={2.25} />
              </span>
            </button>
          );
        })}
      </div>

      <PreConnectVideoModal
        open={Boolean(active)}
        title={active?.title || 'Learn the basics'}
        videoUrl={activeUrl}
        onClose={() => setActive(null)}
      />
    </section>
  );
}

import { Link } from 'react-router-dom';
import { ArrowRight, Sparkles } from 'lucide-react';
import IconWell from './icons/IconWell';
import { AiBotMascotIllustrationSvg } from './icons/CardIllustrations';

interface AiSuggestionCardProps {
  readRate?: string;
  readRateDelta?: number | null;
}

export default function AiSuggestionCard({
  readRate = '68.7%',
  readRateDelta = 8.1,
}: AiSuggestionCardProps) {
  const isPositive = typeof readRateDelta === 'number' && readRateDelta >= 0;
  const deltaText =
    typeof readRateDelta === 'number' && readRateDelta !== 0
      ? `${Math.abs(readRateDelta)}%`
      : null;

  return (
    <section aria-label="AI suggestion" className="h-auto">
      <div className="dashboard-card relative flex h-auto flex-col justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 via-teal-50/40 to-emerald-100/50 p-3.5 sm:p-4 md:p-5 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            <IconWell accent="emerald" size="sm" round>
              <Sparkles className="h-4 w-4 stroke-[2.2]" />
            </IconWell>
            <h2 className="truncate text-[14px] sm:text-[15px] md:text-[16px] font-bold tracking-tight text-neutral-900">
              AI suggestion
            </h2>
          </div>
          <span className="shrink-0 rounded-full bg-emerald-100 px-2 sm:px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 border border-emerald-200/80">
            New
          </span>
        </div>

        <div className="my-2.5 sm:my-3 flex items-center justify-between gap-2 sm:gap-3">
          <p className="min-w-0 flex-1 text-[12px] sm:text-[12.5px] md:text-[13px] font-medium leading-relaxed text-neutral-700">
            {deltaText ? (
              <>
                Your read rate is{' '}
                <strong className="font-extrabold text-emerald-800">
                  {deltaText} {isPositive ? 'higher' : 'lower'}
                </strong>{' '}
                than last week ({readRate}). Consider a follow-up campaign to inactive contacts.
              </>
            ) : (
              <>
                Your current read rate is <strong className="font-extrabold text-emerald-800">{readRate}</strong>.
                Re-engage contacts with a personalized follow-up campaign.
              </>
            )}
          </p>

          <div className="hidden shrink-0 items-center justify-center md:flex -mr-1">
            <AiBotMascotIllustrationSvg className="h-20 w-20 lg:h-24 lg:w-24 xl:h-28 xl:w-28" />
          </div>
        </div>

        <div className="pt-0.5">
          <Link
            to="/campaigns"
            className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl bg-whatsapp-600 px-3.5 sm:px-4 py-2 text-[12px] sm:text-[12.5px] font-bold text-white shadow-md shadow-whatsapp-600/20 transition hover:bg-whatsapp-700"
          >
            Create Follow-up Campaign
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

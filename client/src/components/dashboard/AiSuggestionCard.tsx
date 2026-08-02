import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Lightbulb } from 'lucide-react';
import IconWell from './icons/IconWell';
import { AiBotMascotIllustrationSvg } from './icons/CardIllustrations';

interface WorkspaceTipCardProps {
  readRate?: string | null;
  readRateDelta?: number | null;
  messagesSent?: number;
  failedMessages?: number;
  openChats?: number;
}

function buildTip(props: WorkspaceTipCardProps): {
  body: ReactNode;
  cta: { label: string; to: string };
} {
  const sent = props.messagesSent ?? 0;
  const failed = props.failedMessages ?? 0;
  const openChats = props.openChats ?? 0;
  const rate = props.readRate?.replace(/%$/, '');
  const rateNum = rate != null && rate !== '' ? Number(rate) : null;
  const delta = typeof props.readRateDelta === 'number' ? props.readRateDelta : null;

  if (openChats > 0) {
    return {
      body: (
        <>
          You have{' '}
          <strong className="font-extrabold text-emerald-800">
            {openChats} open chat{openChats === 1 ? '' : 's'}
          </strong>
          . Reply from Inbox to keep customers from waiting.
        </>
      ),
      cta: { label: 'Open Inbox', to: '/inbox' },
    };
  }

  if (failed > 0) {
    return {
      body: (
        <>
          <strong className="font-extrabold text-rose-700">
            {failed} message{failed === 1 ? '' : 's'} failed
          </strong>{' '}
          in this period. Review failures before your next campaign.
        </>
      ),
      cta: { label: 'View failures', to: '/reports' },
    };
  }

  if (sent === 0) {
    return {
      body: (
        <>
          No outbound messages in this period yet. Send a campaign or reply in Inbox to start tracking
          delivery and read rates.
        </>
      ),
      cta: { label: 'Create campaign', to: '/campaigns' },
    };
  }

  if (delta != null && delta !== 0 && rateNum != null && Number.isFinite(rateNum)) {
    const higher = delta > 0;
    return {
      body: (
        <>
            Your read rate is{' '}
            <strong className="font-extrabold text-emerald-800">
              {Math.abs(delta)} pts {higher ? 'higher' : 'lower'}
            </strong>{' '}
            than the previous period (now {rateNum}%).{' '}
            {higher
              ? 'Keep the momentum with a short follow-up to recent contacts.'
              : 'Try a clearer template or follow up with contacts who did not read.'}
        </>
      ),
      cta: { label: 'Create campaign', to: '/campaigns' },
    };
  }

  if (rateNum != null && Number.isFinite(rateNum)) {
    return {
      body: (
        <>
          Current read rate is{' '}
          <strong className="font-extrabold text-emerald-800">{rateNum}%</strong> across{' '}
          {sent.toLocaleString()} sent message{sent === 1 ? '' : 's'}. Re-engage quiet contacts with a
          focused campaign.
        </>
      ),
      cta: { label: 'Create campaign', to: '/campaigns' },
    };
  }

  return {
    body: <>Review Inbox and campaigns to keep your WhatsApp workspace moving.</>,
    cta: { label: 'Open Inbox', to: '/inbox' },
  };
}

/** Honest workspace tip from live metrics — not an AI model output. */
export default function AiSuggestionCard(props: WorkspaceTipCardProps) {
  const tip = buildTip(props);

  return (
    <section aria-label="Workspace tip" className="h-auto">
      <div className="dashboard-card relative flex h-auto flex-col justify-between overflow-hidden rounded-2xl sm:rounded-3xl border border-emerald-200/80 bg-gradient-to-br from-emerald-50/90 via-teal-50/40 to-emerald-100/50 p-3.5 sm:p-4 md:p-5 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 sm:gap-2.5">
            <IconWell accent="emerald" size="sm" round>
              <Lightbulb className="h-4 w-4 stroke-[2.2]" />
            </IconWell>
            <h2 className="truncate text-[14px] sm:text-[15px] md:text-[16px] font-bold tracking-tight text-neutral-900">
              Workspace tip
            </h2>
          </div>
          <span className="shrink-0 rounded-full bg-white/80 px-2 sm:px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 border border-emerald-200/80">
            Based on your data
          </span>
        </div>

        <div className="my-2.5 sm:my-3 flex items-center justify-between gap-2 sm:gap-3">
          <p className="min-w-0 flex-1 text-[12px] sm:text-[12.5px] md:text-[13px] font-medium leading-relaxed text-neutral-700">
            {tip.body}
          </p>

          <div className="hidden shrink-0 items-center justify-center md:flex -mr-1">
            <AiBotMascotIllustrationSvg className="h-20 w-20 lg:h-24 lg:w-24 xl:h-28 xl:w-28" />
          </div>
        </div>

        <div className="pt-0.5">
          <Link
            to={tip.cta.to}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-xl bg-whatsapp-600 px-3.5 sm:px-4 py-2 text-[12px] sm:text-[12.5px] font-bold text-white shadow-md shadow-whatsapp-600/20 transition hover:bg-whatsapp-700"
          >
            {tip.cta.label}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Layers } from 'lucide-react';
import ChannelHeroActions from './ChannelHeroActions';
import ChannelHeroLead, { ChannelHeroConnectedBadge } from './ChannelHeroLead';
import AllChannelsHeroArt from './AllChannelsHeroArt';
import type { MetricsPeriod } from '../../utils/metricsPeriod';
import type { WorkspaceChannels } from '../../utils/workspaceChannels';
import FacebookGlyph from './icons/FacebookGlyph';
import InstagramGlyph from './icons/InstagramGlyph';
import WhatsAppGlyph from './icons/WhatsAppGlyph';

function AllChannelsIcon() {
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-[0_10px_22px_rgba(56,189,248,0.32)]">
      <Layers className="h-6 w-6" strokeWidth={2.1} />
    </span>
  );
}

function ChannelChip({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex min-w-0 max-w-[11rem] items-center gap-1.5">
      <span className="inline-flex shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </span>
  );
}

export default function AllChannelsConnectionHero({
  channels,
  whatsappLabel,
  facebookLabel,
  instagramLabel,
  period,
  onPeriodChange,
}: {
  channels: WorkspaceChannels;
  whatsappLabel?: string;
  facebookLabel?: string;
  instagramLabel?: string;
  period: MetricsPeriod;
  onPeriodChange: (period: MetricsPeriod) => void;
}) {
  const connectedCount = [channels.whatsapp, channels.facebook, channels.instagram].filter(Boolean).length;
  const allConnected = connectedCount === 3;
  const chips = [
    channels.whatsapp
      ? {
          key: 'wa',
          icon: <WhatsAppGlyph className="h-3.5 w-3.5 text-[#25D366]" />,
          label: whatsappLabel || 'WhatsApp',
        }
      : null,
    channels.facebook
      ? {
          key: 'fb',
          icon: <FacebookGlyph className="h-3.5 w-3.5 text-[#1877F2]" />,
          label: facebookLabel || 'Facebook',
        }
      : null,
    channels.instagram
      ? {
          key: 'ig',
          icon: <InstagramGlyph className="h-3.5 w-3.5 text-[#E1306C]" />,
          label: instagramLabel || 'Instagram',
        }
      : null,
  ].filter(Boolean) as Array<{ key: string; icon: ReactNode; label: string }>;

  const nameLine =
    chips.length > 0 ? (
      <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {chips.map((chip, index) => (
          <span key={chip.key} className="inline-flex min-w-0 items-center gap-2">
            {index > 0 ? <span className="text-slate-300" aria-hidden>·</span> : null}
            <ChannelChip icon={chip.icon} label={chip.label} />
          </span>
        ))}
      </span>
    ) : (
      'WhatsApp, Facebook, and Instagram in one place'
    );

  let statusLine: ReactNode;
  if (allConnected) {
    statusLine = 'Cross-channel inbox, ads snapshot, and recent activity on this dashboard.';
  } else if (connectedCount > 0) {
    statusLine = (
      <>
        {connectedCount} of 3 channels connected — connect the rest in{' '}
        <Link to="/settings?tab=channels" className="font-semibold text-sky-700 hover:underline">
          Channels settings
        </Link>
        .
      </>
    );
  } else {
    statusLine = (
      <>
        Connect WhatsApp, Facebook, or Instagram in{' '}
        <Link to="/settings?tab=channels" className="font-semibold text-sky-700 hover:underline">
          Channels settings
        </Link>
        .
      </>
    );
  }

  return (
    <section aria-label="All channels overview" className="relative z-10">
      <div
        className="dashboard-card dashboard-channel-hero dashboard-channel-hero--all dashboard-channel-hero-layout relative overflow-hidden rounded-[22px] border border-sky-100/90 bg-gradient-to-r from-sky-50/55 via-white to-white px-4 py-4 sm:px-7 sm:py-5"
      >
        <ChannelHeroLead
          icon={<AllChannelsIcon />}
          title="All Channels"
          badge={
            allConnected ? (
              <ChannelHeroConnectedBadge />
            ) : (
              <span className="inline-flex items-center rounded-full border border-amber-200/80 bg-amber-50 px-2 py-0.5 text-[10px] font-bold tracking-wide text-amber-900">
                {connectedCount}/3 connected
              </span>
            )
          }
          nameLine={typeof nameLine === 'string' ? <span className="truncate">{nameLine}</span> : nameLine}
          description={statusLine}
        />
        <ChannelHeroActions
          manageHref="/settings?tab=channels"
          period={period}
          onPeriodChange={onPeriodChange}
        />
        <AllChannelsHeroArt />
      </div>
    </section>
  );
}

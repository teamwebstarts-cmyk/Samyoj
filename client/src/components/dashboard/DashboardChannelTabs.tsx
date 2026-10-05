import { Link } from 'react-router-dom';
import { Layers } from 'lucide-react';
import FacebookGlyph from './icons/FacebookGlyph';
import InstagramGlyph from './icons/InstagramGlyph';
import MailGlyph from './icons/MailGlyph';
import WhatsAppGlyph from './icons/WhatsAppGlyph';
import type { WorkspaceChannels } from '../../utils/workspaceChannels';

interface DashboardChannelTabsProps {
  channels: WorkspaceChannels;
  activeChannel?: keyof WorkspaceChannels | 'all';
  whatsappLabel?: string;
  facebookLabel?: string;
  instagramLabel?: string;
  emailLabel?: string;
}

const CHANNELS = [
  { key: 'whatsapp' as const, label: 'WhatsApp', fallback: 'Business number', href: '/?channel=whatsapp' },
  { key: 'facebook' as const, label: 'Facebook', fallback: 'Page', href: '/?channel=facebook' },
  { key: 'instagram' as const, label: 'Instagram', fallback: 'Business account', href: '/?channel=instagram' },
  { key: 'email' as const, label: 'Email', fallback: 'Connected Gmail', href: '/?channel=email' },
];

export default function DashboardChannelTabs({
  channels,
  activeChannel,
  whatsappLabel,
  facebookLabel,
  instagramLabel,
  emailLabel,
}: DashboardChannelTabsProps) {
  const subtitles = {
    whatsapp: whatsappLabel || '+ WhatsApp number',
    facebook: facebookLabel || 'Page connected',
    instagram: instagramLabel || 'Business account',
    email: emailLabel || 'Connected Gmail',
  };

  const allActive = activeChannel === 'all';

  return (
    <nav className="dashboard-channel-tabs" aria-label="Connected channels">
      <Link
        to="/?channel=all"
        className="dashboard-channel-tab dashboard-channel-tab--all"
        data-channel="all"
        data-active={allActive}
        aria-label="All Channels — WhatsApp, Facebook, Instagram, Email"
        title="All Channels"
      >
        <span className="dashboard-channel-tab__icon bg-gradient-to-br from-sky-500 to-indigo-500 text-white shadow-[0_4px_10px_rgba(56,189,248,0.32)]">
          <Layers className="h-[17px] w-[17px]" strokeWidth={2.2} />
        </span>
        <span className="dashboard-channel-tab__name">All</span>
        <span className="dashboard-channel-tab__copy min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[12px] font-extrabold text-neutral-900 lg:text-[13px]">All Channels</span>
          </span>
          <span className="dashboard-channel-tab__sub mt-0.5 block truncate text-[10.5px] font-medium text-neutral-500">
            WhatsApp, Facebook, Instagram, Email
          </span>
        </span>
      </Link>
      {CHANNELS.map((channel) => {
        const connected = channels[channel.key];
        const active = channel.key === activeChannel && connected;
        const Icon =
          channel.key === 'whatsapp'
            ? WhatsAppGlyph
            : channel.key === 'facebook'
              ? FacebookGlyph
              : channel.key === 'instagram'
                ? InstagramGlyph
                : MailGlyph;
        const iconClass =
          channel.key === 'whatsapp'
            ? 'bg-[#25D366] text-white shadow-[0_4px_10px_rgba(37,211,102,0.35)]'
            : channel.key === 'facebook'
              ? 'bg-[#1877F2] text-white shadow-[0_4px_10px_rgba(24,119,242,0.32)]'
              : channel.key === 'instagram'
                ? 'bg-gradient-to-br from-[#f09433] via-[#e6683c] to-[#bc1888] text-white shadow-[0_4px_10px_rgba(220,39,67,0.28)]'
                : 'bg-[#ea4335] text-white shadow-[0_4px_10px_rgba(234,67,53,0.32)]';

        const subtitle =
          channel.key === 'whatsapp' && whatsappLabel ? whatsappLabel : subtitles[channel.key];
        const statusLabel = connected ? 'Connected' : 'Not connected';

        return (
          <Link
            key={channel.key}
            to={channel.href}
            className="dashboard-channel-tab"
            data-channel={channel.key}
            data-active={active}
            data-connected={connected}
            aria-label={`${channel.label} — ${statusLabel}${subtitle ? `, ${subtitle}` : ''}`}
            title={`${channel.label} (${statusLabel})`}
          >
            <span className={`dashboard-channel-tab__icon ${iconClass}`}>
              <Icon className="h-[18px] w-[18px]" />
              <span
                className={`dashboard-channel-tab__status-dot ${connected ? 'dashboard-channel-tab__status-dot--on' : 'dashboard-channel-tab__status-dot--off'}`}
                aria-hidden
              />
            </span>
            <span className="dashboard-channel-tab__name">{channel.label}</span>
            <span className="dashboard-channel-tab__copy min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[12px] font-extrabold text-neutral-900 lg:text-[13px]">
                  {channel.label}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                    connected
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-neutral-100 text-neutral-500'
                  }`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-neutral-300'}`} />
                  <span className="hidden lg:inline">{statusLabel}</span>
                </span>
              </span>
              <span className="dashboard-channel-tab__sub mt-0.5 block truncate text-[10.5px] font-medium text-neutral-500">
                {subtitle}
              </span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

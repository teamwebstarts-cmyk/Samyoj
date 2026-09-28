import { Link } from 'react-router-dom';
import FacebookGlyph from './icons/FacebookGlyph';
import InstagramGlyph from './icons/InstagramGlyph';
import MailGlyph from './icons/MailGlyph';
import WhatsAppGlyph from './icons/WhatsAppGlyph';
import type { WorkspaceChannels } from '../../utils/workspaceChannels';

interface DashboardChannelTabsProps {
  channels: WorkspaceChannels;
  activeChannel?: keyof WorkspaceChannels;
  whatsappLabel?: string;
  facebookLabel?: string;
  instagramLabel?: string;
}

const CHANNELS = [
  { key: 'whatsapp' as const, label: 'WhatsApp', fallback: 'Business number', href: '/?channel=whatsapp' },
  { key: 'facebook' as const, label: 'Facebook', fallback: 'Page', href: '/?channel=facebook' },
  { key: 'instagram' as const, label: 'Instagram', fallback: 'Business account', href: '/?channel=instagram' },
];

export default function DashboardChannelTabs({
  channels,
  activeChannel,
  whatsappLabel,
  facebookLabel,
  instagramLabel,
}: DashboardChannelTabsProps) {
  const subtitles = {
    whatsapp: whatsappLabel || '+ WhatsApp number',
    facebook: facebookLabel || 'Page connected',
    instagram: instagramLabel || 'Business account',
  };

  return (
    <nav className="dashboard-channel-tabs" aria-label="Connected channels">
      {CHANNELS.map((channel) => {
        const connected = channels[channel.key];
        const active = channel.key === (activeChannel ?? 'whatsapp') && connected;
        const Icon =
          channel.key === 'whatsapp'
            ? WhatsAppGlyph
            : channel.key === 'facebook'
              ? FacebookGlyph
              : InstagramGlyph;
        const iconClass =
          channel.key === 'whatsapp'
            ? 'bg-[#25D366] text-white shadow-[0_4px_10px_rgba(37,211,102,0.35)]'
            : channel.key === 'facebook'
              ? 'bg-[#1877F2] text-white shadow-[0_4px_10px_rgba(24,119,242,0.32)]'
              : 'bg-gradient-to-br from-[#f09433] via-[#e6683c] to-[#bc1888] text-white shadow-[0_4px_10px_rgba(220,39,67,0.28)]';

        return (
          <Link
            key={channel.key}
            to={channel.href}
            className="dashboard-channel-tab"
            data-channel={channel.key}
            data-active={active}
            data-connected={connected}
          >
            <span className={`dashboard-channel-tab__icon ${iconClass}`}>
              <Icon className={channel.key === 'instagram' ? 'h-[17px] w-[17px] stroke-[2.25]' : 'h-[18px] w-[18px]'} />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[12px] font-extrabold text-neutral-900 sm:text-[13px]">
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
                  <span className="hidden sm:inline">{connected ? 'Connected' : 'Not connected'}</span>
                </span>
              </span>
              <span className="dashboard-channel-tab__sub mt-0.5 block truncate text-[10.5px] font-medium text-neutral-500">
                {channel.key === 'whatsapp' && whatsappLabel ? whatsappLabel : subtitles[channel.key]}
              </span>
            </span>
          </Link>
        );
      })}
      <div className="dashboard-channel-tab dashboard-channel-tab--disabled" aria-label="Email Coming soon" aria-disabled="true">
        <span className="dashboard-channel-tab__icon bg-slate-500 text-white shadow-[0_3px_8px_rgba(71,85,105,0.25)]">
          <MailGlyph className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[12px] font-extrabold text-neutral-700 sm:text-[13px]">Email</span>
            <span className="inline-flex rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
              <span className="hidden sm:inline">Coming soon</span>
              <span className="sm:hidden">Soon</span>
            </span>
          </span>
          <span className="dashboard-channel-tab__sub mt-0.5 block truncate text-[10.5px] font-medium text-neutral-400">
            Email inbox
          </span>
        </span>
      </div>
    </nav>
  );
}

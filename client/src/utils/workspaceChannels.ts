export type WorkspaceChannels = {
  whatsapp: boolean; facebook: boolean; instagram: boolean;
  /** Gmail mailbox active (Email channel). False until backend lands; mockups render connected. */
  email: boolean;
};

export function anyWorkspaceChannel(channels: WorkspaceChannels): boolean {
  return channels.whatsapp || channels.facebook || channels.instagram || channels.email;
}

function joinedChannelNames(channels: WorkspaceChannels): string[] {
  return [
    channels.whatsapp ? 'WhatsApp' : null,
    channels.facebook ? 'Facebook' : null,
    channels.instagram ? 'Instagram' : null,
    channels.email ? 'Email' : null,
  ].filter((name): name is string => Boolean(name));
}

/** Dashboard topbar subtitle — never implies WhatsApp is the only channel. */
export function dashboardDescription(channels: WorkspaceChannels): string {
  const names = joinedChannelNames(channels);
  if (names.length === 0) return 'Connect a channel to get started';
  if (names.length === 1) {
    if (channels.whatsapp) return "Here's your WhatsApp workspace at a glance";
    if (channels.facebook) return 'Facebook Page workspace at a glance';
    if (channels.email) return 'Email workspace at a glance';
    return 'Instagram workspace at a glance';
  }
  if (names.length === 4) return 'WhatsApp, Facebook, Instagram, and Email at a glance';
  return names.length > 1 ? `${names[0]} and ${names[1]} at a glance` : `${names[0]} at a glance`;
}

export function isEmailSurface(pathname: string): boolean {
  return pathname === '/email' || pathname.startsWith('/email/');
}

export function isWhatsAppSurface(pathname: string): boolean {
  return (
    pathname === '/inbox' ||
    pathname.startsWith('/inbox/') ||
    pathname === '/calls' ||
    pathname.startsWith('/calls/') ||
    pathname === '/campaigns' ||
    pathname.startsWith('/campaigns/') ||
    pathname === '/templates' ||
    pathname.startsWith('/templates/') ||
    pathname === '/commerce' ||
    pathname.startsWith('/commerce/') ||
    pathname === '/tickets' ||
    pathname.startsWith('/tickets/') ||
    pathname === '/contacts' ||
    pathname.startsWith('/contacts/')
  );
}

export function isFacebookSurface(pathname: string): boolean {
  return pathname === '/facebook' || pathname.startsWith('/facebook/');
}

export function isInstagramSurface(pathname: string): boolean {
  return pathname === '/instagram' || pathname.startsWith('/instagram/');
}

export type TopbarConnectionBadge = 'live' | 'not-connected' | 'hidden';

/**
 * Live / Not connected chip next to the page heading.
 * WhatsApp-only pages follow the number. Facebook/Instagram pages follow
 * that channel. Shared pages (Dashboard, Settings, Automations) follow any channel.
 */
export function topbarConnectionBadge(
  pathname: string,
  channels: WorkspaceChannels,
  opts: { numbersReady: boolean; metaReady: boolean }
): TopbarConnectionBadge {
  if (isFacebookSurface(pathname)) {
    if (!opts.metaReady) return 'hidden';
    return channels.facebook ? 'live' : 'not-connected';
  }
  if (isInstagramSurface(pathname)) {
    if (!opts.metaReady) return 'hidden';
    return channels.instagram ? 'live' : 'not-connected';
  }
  if (isEmailSurface(pathname)) {
    return channels.email ? 'live' : 'not-connected';
  }
  if (isWhatsAppSurface(pathname)) {
    if (!opts.numbersReady) return 'hidden';
    return channels.whatsapp ? 'live' : 'not-connected';
  }
  if (!opts.numbersReady && !opts.metaReady) return 'hidden';
  if (anyWorkspaceChannel(channels)) return 'live';
  if (opts.numbersReady && opts.metaReady) return 'not-connected';
  return 'hidden';
}

export function topbarLiveTitle(pathname: string): string {
  if (isFacebookSurface(pathname)) return 'Facebook Page connected — live updates available';
  if (isInstagramSurface(pathname)) return 'Instagram connected — live updates available';
  if (isWhatsAppSurface(pathname)) return 'WhatsApp connected — live updates available';
  if (isEmailSurface(pathname)) return 'Gmail mailbox connected for sending';
  return 'A channel is connected — live updates available';
}

export function topbarNotConnectedTitle(pathname: string): string {
  if (isFacebookSurface(pathname)) return 'Facebook Page not connected';
  if (isInstagramSurface(pathname)) return 'Instagram not connected';
  if (isWhatsAppSurface(pathname)) return 'WhatsApp not connected';
  if (isEmailSurface(pathname)) return 'Gmail mailbox not connected';
  return 'No channel connected';
}

export type DashboardQuickActionKey =
  | 'inbox'
  | 'campaigns'
  | 'contacts'
  | 'automations'
  | 'templates'
  | 'messenger'
  | 'ads'
  | 'ig-inbox'
  | 'ig-comments';

export type DashboardMoreActionKey =
  | 'calls'
  | 'tickets'
  | 'usage'
  | 'messenger'
  | 'ads'
  | 'ig-inbox'
  | 'ig-comments';

/** Five tiles max. WhatsApp keeps the current set; Meta-only swaps in Messenger / Ads / IG. */
export function dashboardQuickActionKeys(channels: WorkspaceChannels): DashboardQuickActionKey[] {
  if (channels.whatsapp) {
    return ['inbox', 'campaigns', 'templates', 'automations', 'contacts'];
  }
  const keys: DashboardQuickActionKey[] = [];
  if (channels.facebook) keys.push('messenger', 'ads');
  if (channels.instagram) keys.push('ig-inbox', 'ig-comments');
  keys.push('automations');
  return keys.slice(0, 5);
}

export function dashboardMoreActionKeys(channels: WorkspaceChannels): DashboardMoreActionKey[] {
  if (channels.whatsapp) {
    return [
      'calls',
      'tickets',
      'usage',
      ...(channels.facebook ? (['messenger', 'ads'] as const) : []),
      ...(channels.instagram ? (['ig-inbox', 'ig-comments'] as const) : []),
    ];
  }
  return ['usage'];
}

export type SidebarChannelAccent = 'whatsapp' | 'facebook' | 'instagram' | 'studio' | 'neutral';

const WHATSAPP_ROUTE_PREFIXES = [
  '/inbox',
  '/calls',
  '/campaigns',
  '/templates',
  '/commerce',
  '/flows',
  '/reports',
  '/contacts',
  '/tickets',
];

export function resolveSidebarAccent(pathname: string, search: string): SidebarChannelAccent {
  if (pathname.startsWith('/facebook')) return 'facebook';
  if (pathname.startsWith('/instagram')) return 'instagram';
  if (
    pathname.startsWith('/ai-bot') ||
    pathname.startsWith('/automations') ||
    pathname.startsWith('/content-studio')
  ) {
    return 'studio';
  }
  if (pathname === '/' || pathname.startsWith('/dashboard')) {
    const channel = new URLSearchParams(search).get('channel');
    if (channel === 'facebook') return 'facebook';
    if (channel === 'instagram') return 'instagram';
    return 'whatsapp';
  }
  if (WHATSAPP_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return 'whatsapp';
  }
  return 'neutral';
}

export function accentToDataAttr(accent: SidebarChannelAccent): string {
  return accent;
}

export type SidebarChannelAccent = 'whatsapp' | 'facebook' | 'instagram' | 'email' | 'studio' | 'neutral';

const WHATSAPP_ROUTE_PREFIXES = [
  '/inbox',
  '/calls',
  '/campaigns',
  '/templates',
  '/commerce',
];

export function resolveSidebarAccent(pathname: string, search: string): SidebarChannelAccent {
  if (pathname.startsWith('/facebook')) return 'facebook';
  if (pathname.startsWith('/instagram')) return 'instagram';
  if (pathname.startsWith('/email')) return 'email';
  if (pathname === '/' || pathname.startsWith('/dashboard')) {
    const channel = new URLSearchParams(search).get('channel');
    if (channel === 'facebook') return 'facebook';
    if (channel === 'instagram') return 'instagram';
    if (channel === 'email') return 'email';
    if (channel === 'whatsapp') return 'whatsapp';
    return 'studio';
  }
  if (WHATSAPP_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) {
    return 'whatsapp';
  }
  return 'studio';
}

export function accentToDataAttr(accent: SidebarChannelAccent): string {
  return accent;
}

export interface PageMeta {
  title: string;
  description?: string;
}

export const PAGE_META: Record<string, PageMeta> = {
  '/': {
    title: 'Dashboard',
    description: 'See how your WhatsApp is doing',
  },
  '/inbox': {
    title: 'Inbox',
    description: 'Reply to your customers',
  },
  '/calls': {
    title: 'Calls',
    description: 'Voice calls handled by your AI bot',
  },
  '/automations': {
    title: 'Automations',
    description: 'Auto-replies and conversation flows',
  },
  '/ai-bot': {
    title: 'AI Bots',
    description: 'Set up smart auto-replies for WhatsApp',
  },
  '/campaigns': {
    title: 'Campaigns',
    description: 'Send messages to many contacts at once',
  },
  '/templates': {
    title: 'Templates',
    description: 'Approved message templates for outreach',
  },
  '/contacts': {
    title: 'Contacts',
    description: 'Your customer list',
  },
  '/team': {
    title: 'Team',
    description: 'Manage your support team',
  },
  '/reports': {
    title: 'Reports',
    description: 'Analytics and team performance',
  },
  '/billing': {
    title: 'Billing',
    description: 'Plans and seat limits',
  },
  '/settings': {
    title: 'Settings',
    description: 'Connect WhatsApp and set up your workspace',
  },
};

export function getPageMeta(pathname: string): PageMeta {
  if (PAGE_META[pathname]) return PAGE_META[pathname];

  const match = Object.entries(PAGE_META).find(
    ([path]) => path !== '/' && pathname.startsWith(path),
  );

  return match?.[1] ?? { title: 'Workspace' };
}

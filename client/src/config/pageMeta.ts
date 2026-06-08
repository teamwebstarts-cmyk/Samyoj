export interface PageMeta {
  title: string;
  description?: string;
}

export const PAGE_META: Record<string, PageMeta> = {
  '/': {
    title: 'Dashboard',
    description: 'Your WhatsApp performance at a glance',
  },
  '/inbox': {
    title: 'Inbox',
    description: 'Reply to customer conversations',
  },
  '/calls': {
    title: 'Calls',
    description: 'Voice calls answered by your AI bot',
  },
  '/automations': {
    title: 'Automations',
    description: 'Build conversation flows and quick replies',
  },
  '/ai-bot': {
    title: 'AI Bots',
    description: 'Create and manage multiple AI chatbots for WhatsApp',
  },
  '/campaigns': {
    title: 'Campaigns',
    description: 'Send template messages to multiple contacts',
  },
  '/templates': {
    title: 'Templates',
    description: 'Manage Meta-approved WhatsApp message templates',
  },
  '/contacts': {
    title: 'Contacts',
    description: 'Manage your customer contacts',
  },
  '/team': {
    title: 'Team',
    description: 'Manage support agents and roles',
  },
  '/settings': {
    title: 'Settings',
    description: 'Manage your WhatsApp Business connection',
  },
};

export function getPageMeta(pathname: string): PageMeta {
  if (PAGE_META[pathname]) return PAGE_META[pathname];

  const match = Object.entries(PAGE_META).find(
    ([path]) => path !== '/' && pathname.startsWith(path),
  );

  return match?.[1] ?? { title: 'Workspace' };
}

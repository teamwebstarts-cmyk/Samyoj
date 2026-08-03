export interface PageMeta {
  title: string;
  description?: string;
}

export const PAGE_META: Record<string, PageMeta> = {
  '/': {
    title: 'Dashboard',
    description: "Here's your WhatsApp workspace at a glance",
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
    description: 'Smart auto-replies for WhatsApp',
  },
  '/campaigns': {
    title: 'Campaigns',
    description: 'Send messages to many contacts at once',
  },
  '/templates': {
    title: 'Templates',
    description: 'Approved message templates for outreach',
  },
  '/content-studio': {
    title: 'Content Studio',
    description: 'Create on-brand copy and images',
  },
  '/commerce': {
    title: 'Orders',
    description: 'Track and fulfill WhatsApp catalog purchases',
  },
  '/contacts': {
    title: 'Contacts',
    description: 'Your customer list and sales pipeline',
  },
  '/leads': {
    title: 'Pipeline',
    description: 'Track prospects through your sales stages',
  },
  '/tickets': {
    title: 'Tickets',
    description: 'Support issues with reply deadlines',
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
  '/onboarding': {
    title: 'Getting Started',
    description: 'Set up your WhatsApp workspace',
  },
};

export function getPageMeta(pathname: string): PageMeta {
  if (PAGE_META[pathname]) return PAGE_META[pathname];

  if (pathname.startsWith('/automations/flows/')) {
    return { title: 'Flow Builder', description: 'Design conversation flows' };
  }
  if (pathname.startsWith('/automations/meta-flows/')) {
    return { title: 'WhatsApp Forms', description: 'Build WhatsApp Flow forms (advanced)' };
  }

  const match = Object.entries(PAGE_META).find(
    ([path]) => path !== '/' && pathname.startsWith(path),
  );

  return match?.[1] ?? { title: 'Workspace' };
}

export function isBuilderRoute(pathname: string): boolean {
  return (
    pathname.startsWith('/automations/flows/') ||
    pathname.startsWith('/automations/meta-flows/')
  );
}

/** Inbox fills the viewport under the topbar — main must not page-scroll. */
export function isInboxRoute(pathname: string): boolean {
  return pathname === '/inbox' || pathname.startsWith('/inbox/');
}

export function shouldShowMobileBottomNav(pathname: string): boolean {
  return !isBuilderRoute(pathname);
}

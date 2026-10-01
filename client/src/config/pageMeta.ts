export interface PageMeta {
  title: string;
  description?: string;
}

export const PAGE_META: Record<string, PageMeta> = {
  '/': {
    title: 'Dashboard',
    description: 'Your workspace at a glance',
  },
  '/analytics': {
    title: 'Analytics',
    description: 'Meta ads beside your pipeline. No combined ROI.',
  },
  '/inbox': {
    title: 'Inbox',
    description: 'Reply to your customers',
  },
  '/facebook/inbox': {
    title: 'Messenger Inbox',
    description: 'Page messages · 24-hour reply window',
  },
  '/facebook/ads': {
    title: 'Ads performance',
    description: "Meta's numbers. Not Samyoj revenue.",
  },
  '/instagram/inbox': {
    title: 'Instagram Inbox',
    description: 'Instagram Direct conversations',
  },
  '/instagram/comments': {
    title: 'Instagram Comments',
    description: 'One private reply per comment',
  },
  '/instagram/posts': {
    title: 'Instagram Posts',
    description: 'Create, schedule and manage your Instagram posts',
  },
  '/email': {
    title: 'Email',
    description: 'Send from your connected Gmail. Not an inbox.',
  },
  '/email/compose': {
    title: 'Email Compose',
    description: 'Send a one-time email to a contact from your connected Gmail mailbox',
  },
  '/email/templates': {
    title: 'Email Templates',
    description: 'Save a reusable template to send faster and keep your messaging consistent',
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
    description: 'Smart auto-replies for chat and calls',
  },
  '/campaigns': {
    title: 'Campaigns',
    description: 'Send messages to many contacts at once',
  },
  '/templates': {
    title: 'Templates',
    description: 'Approved message templates for outreach',
  },
  '/templates/library': {
    title: 'Template library',
    description: 'Pre-approved Meta templates you can add and send immediately',
  },
  '/content-studio': {
    title: 'AI Studio',
    description: 'Turn your ideas into channel-ready content',
  },
  '/commerce': {
    title: 'Orders',
    description: 'Track catalog purchases from WhatsApp',
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
    description: 'Follow up on chats that need a reply',
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
    title: 'Billing & Usage',
    description: 'Plans, quotas & usage statistics',
  },
  '/settings': {
    title: 'Settings',
    description: 'Connect channels and set up your workspace',
  },
  '/onboarding': {
    title: 'Getting Started',
    description: 'Set up your workspace',
  },
};

export function getPageMeta(pathname: string): PageMeta {
  if (PAGE_META[pathname]) return PAGE_META[pathname];

  if (pathname.startsWith('/automations/flows/')) {
    return { title: 'Conversation flow', description: 'Design a multi-step chat tree' };
  }
  if (pathname.startsWith('/automations/meta-flows/')) {
    return { title: 'WhatsApp Form (advanced)', description: 'Meta Flow JSON — not a conversation flow' };
  }

  const match = Object.entries(PAGE_META).find(
    ([path]) => path !== '/' && pathname.startsWith(path),
  );

  return match?.[1] ?? { title: 'Workspace' };
}

export function isFlowBuilderRoute(pathname: string): boolean {
  return pathname.startsWith('/automations/flows/');
}

export function getFlowBuilderTopbarLabel(pathname: string): string {
  if (pathname.endsWith('/new')) return 'New flow';
  return 'Edit flow';
}

export function isBuilderRoute(pathname: string): boolean {
  return isFlowBuilderRoute(pathname) || pathname.startsWith('/automations/meta-flows/');
}

/** Inbox fills the viewport under the topbar — main must not page-scroll. */
export function isInboxRoute(pathname: string): boolean {
  return (
    pathname === '/inbox' ||
    pathname.startsWith('/inbox/') ||
    pathname === '/facebook/inbox' ||
    pathname.startsWith('/facebook/inbox/') ||
    pathname === '/instagram/inbox' ||
    pathname.startsWith('/instagram/inbox/')
  );
}

/** Email compose and templates fill the viewport; the panes scroll, not the app shell. */
export function isEmailShellRoute(pathname: string): boolean {
  return pathname === '/email/compose' || pathname === '/email/templates';
}

/** Calls uses the same full-viewport shell card as Inbox — lock main scroll. */
export function isCallsShellRoute(pathname: string): boolean {
  return pathname === '/calls' || pathname.startsWith('/calls/');
}

/** Campaign create/edit uses an internal full-page wizard scroll region. */
export function isCampaignWizardRoute(pathname: string): boolean {
  return pathname === '/campaigns/new' || /^\/campaigns\/[^/]+\/edit$/.test(pathname);
}

/** Template create / library / resubmit use the same internal wizard scroll + footer. */
export function isTemplateWizardRoute(pathname: string): boolean {
  return (
    pathname === '/templates/new' ||
    pathname === '/templates/library' ||
    /^\/templates\/[^/]+\/resubmit$/.test(pathname)
  );
}

export function getTemplateWizardTopbarLabel(pathname: string): string {
  if (pathname === '/templates/new') return 'New template';
  if (pathname === '/templates/library') return 'Library';
  if (/^\/templates\/[^/]+\/resubmit$/.test(pathname)) return 'Edit template';
  return 'Template';
}

/** Campaigns and contacts list fill the viewport — table scrolls inside the shell card. */
export function isListShellRoute(pathname: string, search = ''): boolean {
  if (pathname === '/campaigns') return true;
  if (pathname === '/contacts' || pathname.startsWith('/contacts/')) {
    const tab = new URLSearchParams(search).get('tab');
    return tab !== 'pipeline';
  }
  return false;
}

export function shouldShowMobileBottomNav(pathname: string): boolean {
  return (
    !isBuilderRoute(pathname) &&
    !isCampaignWizardRoute(pathname) &&
    !isTemplateWizardRoute(pathname)
  );
}

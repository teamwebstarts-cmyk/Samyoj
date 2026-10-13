import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Bot,
  CircleHelp,
  ClipboardList,
  CreditCard,
  Facebook,
  Hash,
  ImagePlus,
  Instagram,
  LayoutDashboard,
  LayoutTemplate,
  Mail,
  MailPlus,
  MessageSquare,
  Package,
  Phone,
  Send,
  Settings2,
  Sparkles,
  Ticket,
  UsersRound,
  UserPlus,
  Workflow,
  Zap,
} from 'lucide-react';
import type { OrgRole } from '../types';
import type { WorkspaceChannels } from '../utils/workspaceChannels';

export type NavItemAction = 'open-help';

export interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
  hideForRoles?: OrgRole[];
  showForRoles?: OrgRole[];
  hidden?: boolean;
  /** Opens UI chrome instead of routing (e.g. help drawer). */
  action?: NavItemAction;
}

/** Platform row with chevron (WhatsApp / Facebook / Instagram / Email). */
export type PlatformNavSection = NavSection & {
  dropdown: true;
  icon: LucideIcon;
  accent: 'facebook' | 'whatsapp' | 'instagram' | 'email';
};

export interface NavSection {
  label: string;
  items: NavItem[];
  accent?: 'facebook' | 'whatsapp' | 'instagram' | 'email';
  /** Dashboard-style row with chevron; children render under it. */
  dropdown?: boolean;
  icon?: LucideIcon;
  /** Group heading with nested platform dropdowns (e.g. Channels). */
  platforms?: PlatformNavSection[];
}

const ADMIN_ROLES: OrgRole[] = ['OWNER', 'ADMIN'];
const SUPERVISOR_PLUS: OrgRole[] = ['OWNER', 'ADMIN', 'SUPERVISOR'];

const CHANNEL_PLATFORMS: PlatformNavSection[] = [
  {
    label: 'WhatsApp',
    accent: 'whatsapp',
    dropdown: true,
    icon: MessageSquare,
    items: [
      { to: '/inbox', icon: MessageSquare, label: 'Inbox' },
      { to: '/campaigns', icon: Send, label: 'Campaigns' },
      { to: '/calls', icon: Phone, label: 'Calls' },
      { to: '/templates', icon: ClipboardList, label: 'Templates' },
      { to: '/commerce', icon: Package, label: 'Orders', hidden: true },
    ],
  },
  {
    label: 'Facebook',
    accent: 'facebook',
    dropdown: true,
    icon: Facebook,
    items: [
      { to: '/facebook/inbox', icon: MessageSquare, label: 'Messenger' },
      { to: '/facebook/ads', icon: BarChart3, label: 'Ads' },
    ],
  },
  {
    label: 'Instagram',
    accent: 'instagram',
    dropdown: true,
    icon: Instagram,
    items: [
      { to: '/instagram/inbox', icon: MessageSquare, label: 'Inbox' },
      { to: '/instagram/comments', icon: Hash, label: 'Comments' },
      { to: '/instagram/posts', icon: ImagePlus, label: 'Posts' },
    ],
  },
  {
    label: 'Email',
    accent: 'email',
    dropdown: true,
    icon: Mail,
    items: [
      { to: '/email/compose', icon: MailPlus, label: 'Compose' },
      { to: '/email/templates', icon: LayoutTemplate, label: 'Templates' },
    ],
  },
];

export const NAV_SECTIONS: NavSection[] = [
  {
    label: '',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
    ],
  },
  {
    label: 'Channels',
    items: [],
    platforms: CHANNEL_PLATFORMS,
  },
  {
    label: 'AI Studio',
    items: [
      { to: '/ai-bot', icon: Bot, label: 'AI Bots', hideForRoles: ['AGENT'] },
      { to: '/automations', icon: Workflow, label: 'Automations' },
      {
        to: '/content-studio',
        icon: Sparkles,
        label: 'AI Studio',
        hideForRoles: ['AGENT'],
      },
    ],
  },
  {
    label: 'Contacts',
    items: [{ to: '/contacts', icon: UserPlus, label: 'Contacts' }],
  },
  {
    label: 'Support',
    items: [{ to: '/tickets', icon: Ticket, label: 'Tickets' }],
  },
  {
    label: 'Account',
    items: [
      {
        to: '/team',
        icon: UsersRound,
        label: 'Team',
        showForRoles: SUPERVISOR_PLUS,
      },
      {
        to: '/billing',
        icon: CreditCard,
        label: 'Billing & Usage',
        showForRoles: ADMIN_ROLES,
      },
      { to: '/settings', icon: Settings2, label: 'Settings' },
      { to: '/help', icon: CircleHelp, label: 'Help assistant', action: 'open-help' },
    ],
  },
];

export const MOBILE_BOTTOM_NAV: NavItem[] = [
  { to: '/inbox', icon: MessageSquare, label: 'Inbox' },
  { to: '/campaigns', icon: Send, label: 'Campaigns' },
  { to: '/contacts', icon: UserPlus, label: 'Contacts' },
  { to: '/automations', icon: Zap, label: 'Automate' },
];

/** Phone tab bar follows the connected mix so Facebook/Instagram-only orgs are not sent to WhatsApp walls. */
export function getMobileBottomNav(channels: WorkspaceChannels): NavItem[] {
  if (channels.whatsapp) return MOBILE_BOTTOM_NAV;
  const home: NavItem = { to: '/', icon: LayoutDashboard, label: 'Home', end: true };
  const automate: NavItem = { to: '/automations', icon: Zap, label: 'Automate' };
  if (channels.facebook && channels.instagram) {
    return [
      home,
      { to: '/facebook/inbox', icon: Facebook, label: 'Messenger' },
      { to: '/instagram/inbox', icon: Instagram, label: 'Inbox' },
      automate,
    ];
  }
  if (channels.facebook) {
    return [
      home,
      { to: '/facebook/inbox', icon: Facebook, label: 'Messenger' },
      { to: '/facebook/ads', icon: BarChart3, label: 'Ads' },
      automate,
    ];
  }
  if (channels.instagram) {
    return [
      home,
      { to: '/instagram/inbox', icon: Instagram, label: 'Inbox' },
      { to: '/instagram/comments', icon: Hash, label: 'Comments' },
      automate,
    ];
  }
  return [
    home,
    { to: '/inbox', icon: MessageSquare, label: 'Inbox' },
    { to: '/facebook/inbox', icon: Facebook, label: 'Messenger' },
    automate,
  ];
}

export const MOBILE_MORE_ITEMS: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/facebook/inbox', icon: Facebook, label: 'Messenger Inbox' },
  { to: '/facebook/ads', icon: BarChart3, label: 'Facebook Ads' },
  { to: '/instagram/inbox', icon: Instagram, label: 'Instagram Inbox' },
  { to: '/instagram/comments', icon: Hash, label: 'Instagram Comments' },
  { to: '/instagram/posts', icon: ImagePlus, label: 'Instagram Posts' },
  { to: '/email/compose', icon: MailPlus, label: 'Email Compose' },
  { to: '/email/templates', icon: LayoutTemplate, label: 'Email Templates' },
  { to: '/calls', icon: Phone, label: 'Calls' },
  { to: '/ai-bot', icon: Bot, label: 'AI Bots', hideForRoles: ['AGENT'] },
  { to: '/automations', icon: Workflow, label: 'Automations' },
  { to: '/content-studio', icon: Sparkles, label: 'AI Studio', hideForRoles: ['AGENT'] },
  { to: '/templates', icon: ClipboardList, label: 'Templates' },
  { to: '/tickets', icon: Ticket, label: 'Tickets' },
  { to: '/commerce', icon: Package, label: 'Orders', hidden: true },
  { to: '/team', icon: UsersRound, label: 'Team', showForRoles: SUPERVISOR_PLUS },
  { to: '/billing', icon: CreditCard, label: 'Billing & Usage', showForRoles: ADMIN_ROLES },
  { to: '/settings', icon: Settings2, label: 'Settings' },
  { to: '/help', icon: CircleHelp, label: 'Help assistant', action: 'open-help' },
];

export function isNavItemVisible(
  item: NavItem,
  role: OrgRole | null,
  hiddenModules?: string[]
): boolean {
  if (item.hidden) return false;
  if (hiddenModules && hiddenModules.includes(item.to) && role !== 'OWNER' && role !== 'ADMIN') {
    return false;
  }
  if (item.showForRoles && role && !item.showForRoles.includes(role)) return false;
  if (item.hideForRoles && role && item.hideForRoles.includes(role)) return false;
  return true;
}

function visiblePlatformSections(
  platforms: PlatformNavSection[],
  role: OrgRole | null,
  hiddenModules?: string[]
): PlatformNavSection[] {
  return platforms
    .map((platform) => ({
      ...platform,
      items: platform.items.filter((item) => isNavItemVisible(item, role, hiddenModules)),
    }))
    .filter((platform) => platform.items.length > 0);
}

export function getVisibleNavSections(
  role: OrgRole | null,
  hiddenModules?: string[]
): NavSection[] {
  return NAV_SECTIONS.map((section) => {
    const items = section.items.filter((item) => isNavItemVisible(item, role, hiddenModules));
    const platforms = section.platforms
      ? visiblePlatformSections(section.platforms, role, hiddenModules)
      : undefined;
    return { ...section, items, platforms };
  }).filter((section) => {
    if (section.platforms?.length) return true;
    return section.items.length > 0;
  });
}

export function getVisibleMobileMoreItems(
  role: OrgRole | null,
  hiddenModules?: string[]
): NavItem[] {
  return MOBILE_MORE_ITEMS.filter((item) => isNavItemVisible(item, role, hiddenModules));
}

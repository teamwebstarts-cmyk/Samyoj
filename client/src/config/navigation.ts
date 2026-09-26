import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Bot,
  ClipboardList,
  CreditCard,
  Facebook,
  Instagram,
  LayoutDashboard,
  MessageSquare,
  Hash,
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

export interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
  hideForRoles?: OrgRole[];
  showForRoles?: OrgRole[];
  hidden?: boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
  accent?: 'facebook' | 'whatsapp' | 'instagram';
  /** Dashboard-style row with chevron; children render under it. */
  dropdown?: boolean;
  icon?: LucideIcon;
}

const ADMIN_ROLES: OrgRole[] = ['OWNER', 'ADMIN'];
const SUPERVISOR_PLUS: OrgRole[] = ['OWNER', 'ADMIN', 'SUPERVISOR'];

export const NAV_SECTIONS: NavSection[] = [
  {
    label: '',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
      { to: '/analytics', icon: BarChart3, label: 'Analytics' },
    ],
  },
  {
    label: 'WhatsApp',
    accent: 'whatsapp',
    dropdown: true,
    icon: MessageSquare,
    items: [
      { to: '/inbox', icon: MessageSquare, label: 'Inbox' },
      { to: '/calls', icon: Phone, label: 'Calls' },
      { to: '/templates', icon: ClipboardList, label: 'Templates' },
      { to: '/campaigns', icon: Send, label: 'Campaigns' },
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
    ],
  },
  {
    label: '',
    items: [
      { to: '/ai-bot', icon: Bot, label: 'AI Bots', hideForRoles: ['AGENT'] },
      { to: '/contacts', icon: UserPlus, label: 'Contacts' },
      { to: '/automations', icon: Workflow, label: 'Automations' },
      {
        to: '/content-studio',
        icon: Sparkles,
        label: 'Content Studio',
        hideForRoles: ['AGENT'],
        hidden: true,
      },
    ],
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
    ],
  },
];

export const MOBILE_BOTTOM_NAV: NavItem[] = [
  { to: '/inbox', icon: MessageSquare, label: 'Inbox' },
  { to: '/campaigns', icon: Send, label: 'Campaigns' },
  { to: '/contacts', icon: UserPlus, label: 'Contacts' },
  { to: '/automations', icon: Zap, label: 'Automate' },
];

export const MOBILE_MORE_ITEMS: NavItem[] = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/facebook/inbox', icon: Facebook, label: 'Messenger Inbox' },
  { to: '/facebook/ads', icon: BarChart3, label: 'Facebook Ads' },
  { to: '/instagram/inbox', icon: Instagram, label: 'Instagram Inbox' },
  { to: '/instagram/comments', icon: Hash, label: 'Instagram Comments' },
  { to: '/calls', icon: Phone, label: 'Calls' },
  { to: '/ai-bot', icon: Bot, label: 'AI Bots', hideForRoles: ['AGENT'] },
  { to: '/templates', icon: ClipboardList, label: 'Templates' },
  { to: '/tickets', icon: Ticket, label: 'Tickets' },
  { to: '/commerce', icon: Package, label: 'Orders', hidden: true },
  { to: '/team', icon: UsersRound, label: 'Team', showForRoles: SUPERVISOR_PLUS },
  { to: '/billing', icon: CreditCard, label: 'Billing & Usage', showForRoles: ADMIN_ROLES },
  { to: '/settings', icon: Settings2, label: 'Settings' },
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

export function getVisibleNavSections(
  role: OrgRole | null,
  hiddenModules?: string[]
): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => isNavItemVisible(item, role, hiddenModules)),
  })).filter((section) => section.items.length > 0);
}

export function getVisibleMobileMoreItems(
  role: OrgRole | null,
  hiddenModules?: string[]
): NavItem[] {
  return MOBILE_MORE_ITEMS.filter((item) => isNavItemVisible(item, role, hiddenModules));
}

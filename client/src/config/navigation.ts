import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Bot,
  CreditCard,
  FileText,
  Headset,
  LifeBuoy,
  LineChart,
  MessageSquare,
  PhoneCall,
  Send,
  Settings,
  ShoppingBag,
  Sparkles,
  Users,
  Zap,
} from 'lucide-react';
import type { OrgRole } from '../types';

export interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
  /** Hide for these roles (if set, only these roles are hidden) */
  hideForRoles?: OrgRole[];
  /** Show only for these roles */
  showForRoles?: OrgRole[];
  /** Feature flag — hide from primary nav but keep route */
  hidden?: boolean;
}

export interface NavSection {
  label: string;
  items: NavItem[];
}

const ADMIN_ROLES: OrgRole[] = ['OWNER', 'ADMIN'];
const SUPERVISOR_PLUS: OrgRole[] = ['OWNER', 'ADMIN', 'SUPERVISOR'];

export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Main',
    items: [
      { to: '/', icon: BarChart3, label: 'Dashboard', end: true },
      { to: '/inbox', icon: MessageSquare, label: 'Inbox' },
      { to: '/calls', icon: PhoneCall, label: 'Calls' },
    ],
  },
  {
    label: 'Grow',
    items: [
      { to: '/automations', icon: Zap, label: 'Automations' },
      { to: '/ai-bot', icon: Bot, label: 'AI Bots', hideForRoles: ['AGENT'] },
      { to: '/campaigns', icon: Send, label: 'Campaigns' },
      { to: '/templates', icon: FileText, label: 'Templates' },
      {
        to: '/content-studio',
        icon: Sparkles,
        label: 'Content Studio',
        hideForRoles: ['AGENT'],
        hidden: true,
      },
      { to: '/commerce', icon: ShoppingBag, label: 'Orders' },
      { to: '/contacts', icon: Users, label: 'Contacts' },
    ],
  },
  {
    label: 'Support',
    items: [{ to: '/tickets', icon: LifeBuoy, label: 'Tickets' }],
  },
  {
    label: 'Insights',
    items: [{ to: '/reports', icon: LineChart, label: 'Reports' }],
  },
  {
    label: 'Account',
    items: [
      {
        to: '/team',
        icon: Headset,
        label: 'Team',
        showForRoles: SUPERVISOR_PLUS,
      },
      {
        to: '/billing',
        icon: CreditCard,
        label: 'Billing',
        showForRoles: ADMIN_ROLES,
      },
      { to: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

export const MOBILE_BOTTOM_NAV: NavItem[] = [
  { to: '/inbox', icon: MessageSquare, label: 'Inbox' },
  { to: '/campaigns', icon: Send, label: 'Campaigns' },
  { to: '/contacts', icon: Users, label: 'Contacts' },
  { to: '/automations', icon: Zap, label: 'Automate' },
];

export const MOBILE_MORE_ITEMS: NavItem[] = [
  { to: '/', icon: BarChart3, label: 'Dashboard', end: true },
  { to: '/calls', icon: PhoneCall, label: 'Calls' },
  { to: '/tickets', icon: LifeBuoy, label: 'Tickets' },
  { to: '/commerce', icon: ShoppingBag, label: 'Orders' },
  { to: '/ai-bot', icon: Bot, label: 'AI Bots', hideForRoles: ['AGENT'] },
  { to: '/templates', icon: FileText, label: 'Templates' },
  { to: '/reports', icon: LineChart, label: 'Reports' },
  { to: '/team', icon: Headset, label: 'Team', showForRoles: SUPERVISOR_PLUS },
  { to: '/billing', icon: CreditCard, label: 'Billing', showForRoles: ADMIN_ROLES },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

/** Legacy route — redirects to contacts pipeline tab */
export const LEADS_REDIRECT = '/contacts?tab=pipeline';

export function isNavItemVisible(item: NavItem, role: OrgRole | null): boolean {
  if (item.hidden) return false;
  if (item.showForRoles && role && !item.showForRoles.includes(role)) return false;
  if (item.hideForRoles && role && item.hideForRoles.includes(role)) return false;
  return true;
}

export function getVisibleNavSections(role: OrgRole | null): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => isNavItemVisible(item, role)),
  })).filter((section) => section.items.length > 0);
}

export function getVisibleMobileMoreItems(role: OrgRole | null): NavItem[] {
  return MOBILE_MORE_ITEMS.filter((item) => isNavItemVisible(item, role));
}

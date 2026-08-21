import type { LucideIcon } from 'lucide-react';
import {
  Bot,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
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

/**
 * Icon choices aligned to glass mock + SaaS conventions:
 * home grid, chat, phone, bot, flow, send, doc, package, people, ticket, chart, team, card, gear.
 */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: 'Main',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
      { to: '/inbox', icon: MessageSquare, label: 'Inbox' },
      { to: '/calls', icon: Phone, label: 'Calls' },
      { to: '/ai-bot', icon: Bot, label: 'AI Bots', hideForRoles: ['AGENT'] },
      { to: '/automations', icon: Workflow, label: 'Automations' },
      { to: '/campaigns', icon: Send, label: 'Campaigns' },
      { to: '/templates', icon: ClipboardList, label: 'Templates' },
      {
        to: '/content-studio',
        icon: Sparkles,
        label: 'Content Studio',
        hideForRoles: ['AGENT'],
        hidden: true,
      },
      { to: '/commerce', icon: Package, label: 'Orders', hidden: true },
      { to: '/contacts', icon: UserPlus, label: 'Contacts' },
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
        label: 'Billing',
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
  { to: '/calls', icon: Phone, label: 'Calls' },
  { to: '/ai-bot', icon: Bot, label: 'AI Bots', hideForRoles: ['AGENT'] },
  { to: '/templates', icon: ClipboardList, label: 'Templates' },
  { to: '/tickets', icon: Ticket, label: 'Tickets' },
  { to: '/commerce', icon: Package, label: 'Orders', hidden: true },
  { to: '/team', icon: UsersRound, label: 'Team', showForRoles: SUPERVISOR_PLUS },
  { to: '/billing', icon: CreditCard, label: 'Billing', showForRoles: ADMIN_ROLES },
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

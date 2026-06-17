import type { LucideIcon } from 'lucide-react';
import { Headphones, HelpCircle, ShoppingBag } from 'lucide-react';

export interface BotTemplate {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  accent: string;
  iconBg: string;
  instructions: string;
  handoffMessage: string;
  handoffKeywords: string;
  triggerKeywords: string;
}

export const botTemplates: BotTemplate[] = [
  {
    id: 'support',
    name: 'Customer Support',
    description: 'Orders, refunds, shipping, and general help',
    icon: Headphones,
    accent: 'from-indigo-500/10 via-theme-surface to-violet-500/5 border-indigo-200/60 dark:border-indigo-500/25',
    iconBg:
      'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-[0_4px_14px_rgba(99,102,241,0.35)]',
    instructions:
      'You are a friendly customer support assistant. Help customers with order status, returns, shipping times, and product questions. Be concise, empathetic, and professional. If you do not know an answer, say so and offer to connect them with the team.',
    handoffMessage: 'Let me connect you with our support team. Someone will reply shortly.',
    handoffKeywords: 'human, agent, representative, manager',
    triggerKeywords: '',
  },
  {
    id: 'sales',
    name: 'Sales Assistant',
    description: 'Pricing, quotes, and product recommendations',
    icon: ShoppingBag,
    accent: 'from-emerald-500/10 via-theme-surface to-teal-500/5 border-emerald-200/60 dark:border-emerald-500/25',
    iconBg:
      'bg-gradient-to-br from-whatsapp-600 to-emerald-700 text-white shadow-[0_4px_14px_rgba(37,211,102,0.35)]',
    instructions:
      'You are a helpful sales assistant. Answer questions about pricing, packages, and product features. Recommend the best option based on customer needs. Encourage next steps like booking a demo or placing an order when appropriate.',
    handoffMessage: 'I will connect you with a sales specialist who can help further.',
    handoffKeywords: 'human, sales, call me, speak to someone',
    triggerKeywords: 'pricing, price, quote, buy, order',
  },
  {
    id: 'faq',
    name: 'FAQ Bot',
    description: 'Business hours, location, and common questions',
    icon: HelpCircle,
    accent: 'from-sky-500/10 via-theme-surface to-blue-500/5 border-sky-200/60 dark:border-sky-500/25',
    iconBg:
      'bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-[0_4px_14px_rgba(14,165,233,0.3)]',
    instructions:
      'You answer frequently asked questions about the business: hours, location, policies, and services. Keep replies short and clear. Use the knowledge base when available.',
    handoffMessage: 'Let me get a team member to help with that.',
    handoffKeywords: 'human, agent, help me',
    triggerKeywords: '',
  },
];

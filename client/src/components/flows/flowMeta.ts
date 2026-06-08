import type { LucideIcon } from 'lucide-react';
import {
  Bot,
  CircleStop,
  Clock,
  FileText,
  GitBranch,
  Hand,
  HelpCircle,
  Image,
  Languages,
  MessageSquare,
  Moon,
  Shuffle,
  Sparkles,
  Tag,
  Timer,
  UserCheck,
  Webhook,
  Zap,
} from 'lucide-react';
import type { FlowNodeType } from '../../types';

export const nodeMeta: Record<
  FlowNodeType,
  {
    label: string;
    description: string;
    icon: LucideIcon;
    color: string;
    gradient: string;
    shadow: string;
  }
> = {
  message: {
    label: 'Send Message',
    description: 'Send a text reply',
    icon: MessageSquare,
    color: 'text-emerald-700',
    gradient: 'from-whatsapp-500 to-emerald-600',
    shadow: 'shadow-[0_4px_14px_rgba(37,211,102,0.3)]',
  },
  buttons: {
    label: 'Quick Buttons',
    description: 'Up to 3 tap-to-reply buttons',
    icon: GitBranch,
    color: 'text-violet-700',
    gradient: 'from-violet-500 to-purple-600',
    shadow: 'shadow-[0_4px_14px_rgba(139,92,246,0.3)]',
  },
  question: {
    label: 'Ask Question',
    description: 'Collect customer info',
    icon: HelpCircle,
    color: 'text-sky-700',
    gradient: 'from-sky-500 to-blue-600',
    shadow: 'shadow-[0_4px_14px_rgba(14,165,233,0.3)]',
  },
  tag: {
    label: 'Add Tag',
    description: 'Label the contact',
    icon: Tag,
    color: 'text-amber-700',
    gradient: 'from-amber-500 to-orange-500',
    shadow: 'shadow-[0_4px_14px_rgba(245,158,11,0.3)]',
  },
  assign: {
    label: 'Assign Agent',
    description: 'Round-robin assignment',
    icon: UserCheck,
    color: 'text-indigo-700',
    gradient: 'from-indigo-500 to-violet-600',
    shadow: 'shadow-[0_4px_14px_rgba(99,102,241,0.3)]',
  },
  condition: {
    label: 'Condition',
    description: 'Branch on rules',
    icon: GitBranch,
    color: 'text-rose-700',
    gradient: 'from-rose-500 to-pink-600',
    shadow: 'shadow-[0_4px_14px_rgba(244,63,94,0.3)]',
  },
  handoff: {
    label: 'Handoff',
    description: 'Transfer to human agent',
    icon: Hand,
    color: 'text-rose-700',
    gradient: 'from-rose-500 to-red-600',
    shadow: 'shadow-[0_4px_14px_rgba(239,68,68,0.3)]',
  },
  ai: {
    label: 'AI Assistant',
    description: 'Open-ended AI replies',
    icon: Bot,
    color: 'text-indigo-700',
    gradient: 'from-indigo-500 to-violet-600',
    shadow: 'shadow-[0_4px_14px_rgba(99,102,241,0.3)]',
  },
  end: {
    label: 'End Flow',
    description: 'Close the conversation flow',
    icon: CircleStop,
    color: 'text-neutral-700',
    gradient: 'from-neutral-500 to-neutral-600',
    shadow: 'shadow-[0_4px_14px_rgba(100,116,139,0.3)]',
  },
  template: {
    label: 'Template Message',
    description: 'Send approved WhatsApp template',
    icon: FileText,
    color: 'text-blue-700',
    gradient: 'from-blue-500 to-indigo-600',
    shadow: 'shadow-[0_4px_14px_rgba(59,130,246,0.3)]',
  },
  delay: {
    label: 'Wait / Delay',
    description: 'Pause before next step',
    icon: Timer,
    color: 'text-orange-700',
    gradient: 'from-orange-500 to-amber-500',
    shadow: 'shadow-[0_4px_14px_rgba(249,115,22,0.3)]',
  },
  media: {
    label: 'Send Media',
    description: 'Image, video or document',
    icon: Image,
    color: 'text-teal-700',
    gradient: 'from-teal-500 to-cyan-600',
    shadow: 'shadow-[0_4px_14px_rgba(20,184,166,0.3)]',
  },
  webhook: {
    label: 'Webhook',
    description: 'Call external API / CRM',
    icon: Webhook,
    color: 'text-purple-700',
    gradient: 'from-purple-500 to-fuchsia-600',
    shadow: 'shadow-[0_4px_14px_rgba(168,85,247,0.3)]',
  },
  ab_split: {
    label: 'A/B Split',
    description: 'Random 50/50 branch',
    icon: Shuffle,
    color: 'text-fuchsia-700',
    gradient: 'from-fuchsia-500 to-pink-600',
    shadow: 'shadow-[0_4px_14px_rgba(217,70,239,0.3)]',
  },
  language: {
    label: 'Language Branch',
    description: 'Route by customer language',
    icon: Languages,
    color: 'text-lime-700',
    gradient: 'from-lime-500 to-green-600',
    shadow: 'shadow-[0_4px_14px_rgba(132,204,22,0.3)]',
  },
};

export const triggerMeta: Record<
  string,
  { label: string; description: string; icon: LucideIcon; accent: string; gradient: string }
> = {
  WELCOME: {
    label: 'First Message',
    description: 'When a customer messages for the first time',
    icon: Sparkles,
    accent: 'bg-emerald-50 text-emerald-800 ring-emerald-200/70',
    gradient: 'from-emerald-500 to-teal-600',
  },
  KEYWORD: {
    label: 'Keyword Match',
    description: 'When message contains a specific word',
    icon: Zap,
    accent: 'bg-violet-50 text-violet-800 ring-violet-200/70',
    gradient: 'from-violet-500 to-purple-600',
  },
  BUSINESS_HOURS: {
    label: 'During Hours',
    description: 'Only during your business hours (Settings → Business Hours)',
    icon: Clock,
    accent: 'bg-sky-50 text-sky-800 ring-sky-200/70',
    gradient: 'from-sky-500 to-blue-600',
  },
  OFF_HOURS: {
    label: 'After Hours',
    description: 'Only outside business hours (Settings → Business Hours)',
    icon: Moon,
    accent: 'bg-amber-50 text-amber-800 ring-amber-200/70',
    gradient: 'from-amber-500 to-orange-500',
  },
  ANY_MESSAGE: {
    label: 'Any Message',
    description: 'Fallback for returning customers (low priority)',
    icon: MessageSquare,
    accent: 'bg-neutral-50 text-neutral-700 ring-neutral-200/70',
    gradient: 'from-neutral-500 to-neutral-600',
  },
  CONTACT_TAG: {
    label: 'Contact Has Tag',
    description: 'When contact has a specific tag',
    icon: Tag,
    accent: 'bg-amber-50 text-amber-800 ring-amber-200/70',
    gradient: 'from-amber-500 to-orange-500',
  },
  SEGMENT: {
    label: 'Segment Match',
    description: 'When contact has any of the selected tags',
    icon: Tag,
    accent: 'bg-indigo-50 text-indigo-800 ring-indigo-200/70',
    gradient: 'from-indigo-500 to-violet-600',
  },
};

export function createNode(type: FlowNodeType, index: number): import('../../types').FlowNode {
  const id = `${type}-${Date.now()}-${index}`;
  const base = { id, type };

  switch (type) {
    case 'message':
      return { ...base, text: 'Thanks for reaching out! How can we help?' };
    case 'buttons':
      return {
        ...base,
        text: 'Please choose an option:',
        buttons: [
          { id: `opt1-${id}`, title: 'Option 1' },
          { id: `opt2-${id}`, title: 'Option 2' },
        ],
        branches: {},
      };
    case 'question':
      return { ...base, prompt: 'What is your name?', field: 'name', maxRetries: 2, retryMessage: 'Please try again.' };
    case 'tag':
      return { ...base, tag: 'lead' };
    case 'assign':
      return { ...base, text: 'Connecting you with our team...' };
    case 'condition':
      return { ...base, conditionType: 'business_hours', branches: { true: '', false: '' } };
    case 'handoff':
      return { ...base, text: 'Let me connect you with our team. Someone will reply shortly.' };
    case 'ai':
      return { ...base, text: 'Let me help with that...' };
    case 'end':
      return { ...base, text: 'Thank you! Have a great day. 🙏' };
    case 'template':
      return { ...base, templateName: '', templateLanguage: 'en_US', text: '' };
    case 'delay':
      return { ...base, delaySeconds: 30 };
    case 'media':
      return { ...base, mediaUrl: '', mediaType: 'image', mediaCaption: '' };
    case 'webhook':
      return { ...base, webhookUrl: '', webhookMethod: 'POST' };
    case 'ab_split':
      return { ...base, branches: { a: '', b: '' } };
    case 'language':
      return { ...base, languageCode: 'en', branches: { match: '', default: '' } };
    default:
      return base;
  }
}

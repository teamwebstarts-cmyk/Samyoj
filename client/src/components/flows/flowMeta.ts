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
  List,
  MapPin,
  MessageSquare,
  Moon,
  Phone,
  PhoneMissed,
  Contact,
  FormInput,
  Shuffle,
  Sparkles,
  Tag,
  Timer,
  UserCheck,
  Variable,
  Webhook,
  Workflow,
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
    description: 'Reply, URL, or call buttons',
    icon: GitBranch,
    color: 'text-violet-700',
    gradient: 'from-violet-500 to-purple-600',
    shadow: 'shadow-[0_4px_14px_rgba(139,92,246,0.3)]',
  },
  list: {
    label: 'List Menu',
    description: 'Menu with up to 10 options',
    icon: List,
    color: 'text-blue-700',
    gradient: 'from-blue-500 to-indigo-600',
    shadow: 'shadow-[0_4px_14px_rgba(59,130,246,0.3)]',
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
  remove_tag: {
    label: 'Remove Tag',
    description: 'Remove a label from contact',
    icon: Tag,
    color: 'text-neutral-700',
    gradient: 'from-neutral-500 to-neutral-600',
    shadow: 'shadow-[0_4px_14px_rgba(100,116,139,0.3)]',
  },
  assign: {
    label: 'Assign Agent',
    description: 'Send to the next available agent',
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
  schedule: {
    label: 'Schedule',
    description: 'Wait until a specific time',
    icon: Clock,
    color: 'text-orange-700',
    gradient: 'from-orange-500 to-red-500',
    shadow: 'shadow-[0_4px_14px_rgba(249,115,22,0.3)]',
  },
  set_variable: {
    label: 'Set Variable',
    description: 'Store a value for later steps',
    icon: Variable,
    color: 'text-cyan-700',
    gradient: 'from-cyan-500 to-teal-600',
    shadow: 'shadow-[0_4px_14px_rgba(6,182,212,0.3)]',
  },
  goto_flow: {
    label: 'Go to Flow',
    description: 'Jump to another conversation flow',
    icon: Workflow,
    color: 'text-indigo-700',
    gradient: 'from-indigo-500 to-blue-600',
    shadow: 'shadow-[0_4px_14px_rgba(99,102,241,0.3)]',
  },
  request_callback: {
    label: 'Request Callback',
    description: 'Tag contact for a phone callback',
    icon: Phone,
    color: 'text-rose-700',
    gradient: 'from-rose-500 to-red-600',
    shadow: 'shadow-[0_4px_14px_rgba(244,63,94,0.3)]',
  },
  goto_step: {
    label: 'Go to Step',
    description: 'Loop back to another step in this flow',
    icon: GitBranch,
    color: 'text-purple-700',
    gradient: 'from-purple-500 to-violet-600',
    shadow: 'shadow-[0_4px_14px_rgba(168,85,247,0.3)]',
  },
  location: {
    label: 'Send Location',
    description: 'Share a map pin with the customer',
    icon: MapPin,
    color: 'text-green-700',
    gradient: 'from-green-500 to-emerald-600',
    shadow: 'shadow-[0_4px_14px_rgba(34,197,94,0.3)]',
  },
  contact_card: {
    label: 'Contact Card',
    description: 'Share a contact vCard',
    icon: Contact,
    color: 'text-blue-700',
    gradient: 'from-blue-500 to-indigo-600',
    shadow: 'shadow-[0_4px_14px_rgba(59,130,246,0.3)]',
  },
  wa_flow: {
    label: 'WhatsApp Flow',
    description: 'Native Meta form (Flow ID required)',
    icon: FormInput,
    color: 'text-teal-700',
    gradient: 'from-teal-500 to-cyan-600',
    shadow: 'shadow-[0_4px_14px_rgba(20,184,166,0.3)]',
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
    label: 'Connect App',
    description: 'Send data to another app or CRM',
    icon: Webhook,
    color: 'text-purple-700',
    gradient: 'from-purple-500 to-fuchsia-600',
    shadow: 'shadow-[0_4px_14px_rgba(168,85,247,0.3)]',
  },
  ab_split: {
    label: 'Split Test',
    description: 'Send half of customers down each path',
    icon: Shuffle,
    color: 'text-fuchsia-700',
    gradient: 'from-fuchsia-500 to-pink-600',
    shadow: 'shadow-[0_4px_14px_rgba(217,70,239,0.3)]',
  },
  language: {
    label: 'By Language',
    description: 'Different paths for different languages',
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
    description: 'Only while your team is available',
    icon: Clock,
    accent: 'bg-sky-50 text-sky-800 ring-sky-200/70',
    gradient: 'from-sky-500 to-blue-600',
  },
  OFF_HOURS: {
    label: 'After Hours',
    description: 'Only when your team is away',
    icon: Moon,
    accent: 'bg-amber-50 text-amber-800 ring-amber-200/70',
    gradient: 'from-amber-500 to-orange-500',
  },
  ANY_MESSAGE: {
    label: 'Any Message',
    description: 'When nothing else matches',
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
    label: 'By Tag Group',
    description: 'When a contact has certain tags',
    icon: Tag,
    accent: 'bg-indigo-50 text-indigo-800 ring-indigo-200/70',
    gradient: 'from-indigo-500 to-violet-600',
  },
  MISSED_CALL: {
    label: 'Missed Call',
    description: 'When a WhatsApp voice call is missed',
    icon: PhoneMissed,
    accent: 'bg-rose-50 text-rose-800 ring-rose-200/70',
    gradient: 'from-rose-500 to-red-600',
  },
  CAMPAIGN_REPLY: {
    label: 'Campaign Reply',
    description: 'When customer replies after a campaign message',
    icon: MessageSquare,
    accent: 'bg-blue-50 text-blue-800 ring-blue-200/70',
    gradient: 'from-blue-500 to-indigo-600',
  },
  CALL_COMPLETED: {
    label: 'Call Completed',
    description: 'After a WhatsApp voice call ends successfully',
    icon: Phone,
    accent: 'bg-emerald-50 text-emerald-800 ring-emerald-200/70',
    gradient: 'from-emerald-500 to-teal-600',
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
        buttonMode: 'reply',
        text: 'Please choose an option:',
        buttons: [
          { id: `opt1-${id}`, title: 'Option 1' },
          { id: `opt2-${id}`, title: 'Option 2' },
        ],
        branches: {},
      };
    case 'list':
      return {
        ...base,
        text: 'Please select from the menu:',
        listButtonLabel: 'View options',
        listSections: [
          {
            title: 'Options',
            rows: [
              { id: `row1-${id}`, title: 'Option 1', description: 'First choice' },
              { id: `row2-${id}`, title: 'Option 2', description: 'Second choice' },
            ],
          },
        ],
        branches: {},
      };
    case 'question':
      return { ...base, prompt: 'What is your name?', field: 'name', maxRetries: 2, retryMessage: 'Please try again.' };
    case 'tag':
      return { ...base, tag: 'lead' };
    case 'remove_tag':
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
    case 'schedule':
      return { ...base, delaySeconds: 3600 };
    case 'set_variable':
      return { ...base, variableName: 'custom_field', variableValue: 'value' };
    case 'goto_flow':
      return { ...base, targetFlowId: '' };
    case 'request_callback':
      return { ...base, text: 'We will call you back shortly!', callbackTag: 'callback-requested' };
    case 'goto_step':
      return { ...base, targetNodeId: '' };
    case 'location':
      return { ...base, text: 'Here is our location:', latitude: 0, longitude: 0, locationName: 'Our office' };
    case 'contact_card':
      return { ...base, text: 'Save our contact:', contactName: 'Support Team', contactPhone: '+10000000000' };
    case 'wa_flow':
      return { ...base, text: 'Please fill out this form:', waFlowId: '', waFlowToken: '', waFlowCta: 'Open form' };
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

export type FlowNodeType =
  | 'message'
  | 'buttons'
  | 'question'
  | 'tag'
  | 'handoff'
  | 'ai'
  | 'assign'
  | 'condition'
  | 'end'
  | 'template'
  | 'delay'
  | 'media'
  | 'webhook'
  | 'ab_split'
  | 'language';

export type FlowTriggerType =
  | 'WELCOME'
  | 'KEYWORD'
  | 'ANY_MESSAGE'
  | 'BUSINESS_HOURS'
  | 'OFF_HOURS'
  | 'CONTACT_TAG'
  | 'SEGMENT';

export interface FlowButton {
  id: string;
  title: string;
}

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  text?: string;
  buttons?: FlowButton[];
  field?: 'name' | 'email' | 'phone' | 'custom';
  customField?: string;
  prompt?: string;
  tag?: string;
  conditionType?: 'business_hours' | 'has_tag' | 'language';
  conditionTag?: string;
  languageCode?: string;
  maxRetries?: number;
  retryMessage?: string;
  next?: string;
  branches?: Record<string, string>;
  templateName?: string;
  templateLanguage?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'document' | 'video' | 'audio';
  mediaCaption?: string;
  delaySeconds?: number;
  webhookUrl?: string;
  webhookMethod?: 'GET' | 'POST';
  aiBotId?: string;
  assignAgentId?: string;
  position?: { x: number; y: number };
}

export interface FlowTriggerConfig {
  keyword?: string;
  exactMatch?: boolean;
  regex?: boolean;
  tag?: string;
  tags?: string[];
}

export interface FlowState {
  flowId: string;
  flowName?: string;
  currentNodeId: string;
  waitingFor: 'button' | 'text' | 'delay' | null;
  variables: Record<string, string>;
  attempts: number;
  resumeAt?: string;
}

export interface FlowStats {
  starts: number;
  completions: number;
  handoffs: number;
  dropoffs: Record<string, number>;
}

export interface OrgBusinessHours {
  startHour: number;
  endHour: number;
  days: number[];
  timezone?: string;
}

export const DEFAULT_BUSINESS_HOURS: OrgBusinessHours = {
  startHour: 9,
  endHour: 18,
  days: [1, 2, 3, 4, 5],
  timezone: 'UTC',
};

export interface InboundFlowPayload {
  organizationId: string;
  conversationId: string;
  contactId: string;
  messageId: string;
  contactPhone: string;
  phoneNumberId: string;
  encryptedToken: string;
  content: string;
  buttonReplyId?: string;
  isNewConversation: boolean;
}

export const HANDOFF_KEYWORDS = ['human', 'agent', 'representative', 'talk to someone', 'real person'];

export const FLOW_TEMPLATES = [
  {
    id: 'welcome-menu',
    name: 'Welcome + Menu',
    description: 'Greet new customers with a professional menu — Sales, Support, or Pricing paths',
    triggerType: 'WELCOME' as const,
    triggerConfig: {},
    color: 'violet',
    nodes: [
      { id: 'welcome', type: 'message' as const, text: 'Hi {{name}}! 👋 Welcome to our business. How can we help you today?', next: 'menu' },
      {
        id: 'menu', type: 'buttons' as const, text: 'Please choose an option:',
        buttons: [
          { id: 'sales', title: '💼 Sales' },
          { id: 'support', title: '🛟 Support' },
          { id: 'pricing', title: '💰 Pricing' },
        ],
        branches: { sales: 'sales-name', support: 'support-handoff', pricing: 'pricing-msg' },
      },
      { id: 'sales-name', type: 'question' as const, prompt: 'Great choice! What is your full name?', field: 'name' as const, next: 'sales-tag' },
      { id: 'sales-tag', type: 'tag' as const, tag: 'sales-lead', next: 'sales-handoff' },
      { id: 'sales-handoff', type: 'handoff' as const, text: 'Thanks {{name}}! Our sales team will reach out within 2 hours.' },
      { id: 'support-handoff', type: 'handoff' as const, text: 'Connecting you with support. An agent will reply shortly.' },
      { id: 'pricing-msg', type: 'message' as const, text: 'Our plans start at $29/month. Let me send you details!', next: 'pricing-email' },
      { id: 'pricing-email', type: 'question' as const, prompt: 'What is your email address?', field: 'email' as const, maxRetries: 2, retryMessage: 'Please enter a valid email (e.g. name@company.com)', next: 'pricing-tag' },
      { id: 'pricing-tag', type: 'tag' as const, tag: 'pricing-interest', next: 'pricing-done' },
      { id: 'pricing-done', type: 'message' as const, text: 'Perfect! Pricing details sent to your inbox. 📧' },
    ],
  },
  {
    id: 'lead-capture',
    name: 'Lead Capture',
    description: 'Collect name, email & phone — auto-tag and hand off to sales team',
    triggerType: 'KEYWORD' as const,
    triggerConfig: { keyword: 'demo' },
    color: 'emerald',
    nodes: [
      { id: 'start', type: 'message' as const, text: 'Thanks for your interest in a demo! 🎯', next: 'ask-name' },
      { id: 'ask-name', type: 'question' as const, prompt: 'What is your full name?', field: 'name' as const, next: 'ask-email' },
      { id: 'ask-email', type: 'question' as const, prompt: 'What is your work email?', field: 'email' as const, maxRetries: 2, retryMessage: 'Please enter a valid email address.', next: 'ask-phone' },
      { id: 'ask-phone', type: 'question' as const, prompt: 'What is your phone number?', field: 'phone' as const, next: 'tag-lead' },
      { id: 'tag-lead', type: 'tag' as const, tag: 'hot-lead', next: 'assign' },
      { id: 'assign', type: 'assign' as const, text: 'Assigning you to our sales team...', next: 'done' },
      { id: 'done', type: 'handoff' as const, text: 'All set {{name}}! Our team will contact you within 24 hours. ✅' },
    ],
  },
  {
    id: 'after-hours',
    name: 'After Hours Reply',
    description: 'Auto-reply outside business hours and collect message for next day follow-up',
    triggerType: 'OFF_HOURS' as const,
    triggerConfig: {},
    color: 'amber',
    nodes: [
      { id: 'away', type: 'message' as const, text: 'Thanks for reaching out! 🌙 We are currently closed.', next: 'collect' },
      { id: 'collect', type: 'question' as const, prompt: 'Please leave your message and we will reply first thing tomorrow:', field: 'custom' as const, customField: 'after_hours_message', next: 'tag' },
      { id: 'tag', type: 'tag' as const, tag: 'after-hours', next: 'end' },
      { id: 'end', type: 'end' as const, text: 'Message received! We will get back to you soon. 🙏' },
    ],
  },
  {
    id: 'support-triage',
    name: 'Support Triage',
    description: 'Route customers to billing, technical support, or AI assistant',
    triggerType: 'ANY_MESSAGE' as const,
    triggerConfig: {},
    color: 'sky',
    nodes: [
      {
        id: 'menu', type: 'buttons' as const, text: 'Hi! How can we help you today?',
        buttons: [
          { id: 'billing', title: '💳 Billing' },
          { id: 'technical', title: '🔧 Technical' },
          { id: 'other', title: '💬 Other' },
        ],
        branches: { billing: 'billing-tag', technical: 'tech-tag', other: 'ai' },
      },
      { id: 'billing-tag', type: 'tag' as const, tag: 'billing', next: 'billing-handoff' },
      { id: 'billing-handoff', type: 'handoff' as const, text: 'Connecting you with our billing team.' },
      { id: 'tech-tag', type: 'tag' as const, tag: 'technical', next: 'tech-handoff' },
      { id: 'tech-handoff', type: 'handoff' as const, text: 'Our technical team will assist you shortly.' },
      { id: 'ai', type: 'ai' as const, text: 'Let me help with that...' },
    ],
  },
] as const;

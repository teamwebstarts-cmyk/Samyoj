export type FlowNodeType =
  | 'message'
  | 'buttons'
  | 'list'
  | 'question'
  | 'tag'
  | 'remove_tag'
  | 'handoff'
  | 'ai'
  | 'assign'
  | 'condition'
  | 'end'
  | 'template'
  | 'delay'
  | 'schedule'
  | 'media'
  | 'webhook'
  | 'ab_split'
  | 'language'
  | 'set_variable'
  | 'goto_flow'
  | 'goto_step'
  | 'request_callback'
  | 'location'
  | 'contact_card'
  | 'wa_flow';

export type FlowTriggerType =
  | 'WELCOME'
  | 'KEYWORD'
  | 'ANY_MESSAGE'
  | 'BUSINESS_HOURS'
  | 'OFF_HOURS'
  | 'CONTACT_TAG'
  | 'SEGMENT'
  | 'MISSED_CALL'
  | 'CAMPAIGN_REPLY'
  | 'CALL_COMPLETED';

export interface FlowIntentRoute {
  keywords: string[];
  branchKey: string;
}

export type FlowButtonMode = 'reply' | 'url' | 'call';

export interface FlowButton {
  id: string;
  title: string;
}

export interface FlowListSection {
  title?: string;
  rows: Array<{ id: string; title: string; description?: string }>;
}

export interface FlowNode {
  id: string;
  type: FlowNodeType;
  text?: string;
  buttonMode?: FlowButtonMode;
  ctaLabel?: string;
  ctaUrl?: string;
  ctaPhone?: string;
  buttons?: FlowButton[];
  listButtonLabel?: string;
  listSections?: FlowListSection[];
  field?: 'name' | 'email' | 'phone' | 'custom';
  customField?: string;
  prompt?: string;
  tag?: string;
  conditionType?:
    | 'business_hours'
    | 'has_tag'
    | 'language'
    | 'variable_equals'
    | 'variable_contains'
    | 'webhook_ok';
  conditionTag?: string;
  conditionVariable?: string;
  conditionValue?: string;
  languageCode?: string;
  maxRetries?: number;
  retryMessage?: string;
  acceptMedia?: boolean;
  intentRoutes?: FlowIntentRoute[];
  splitRatio?: number;
  next?: string;
  branches?: Record<string, string>;
  templateName?: string;
  templateLanguage?: string;
  templateCouponCode?: string;
  templateButtonUrlSuffixes?: string[];
  templateHeaderMediaUrl?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'document' | 'video' | 'audio';
  mediaCaption?: string;
  delaySeconds?: number;
  /** When false, customer messages during a delay wait do not skip the timer. Default true. */
  interruptOnInbound?: boolean;
  scheduleAt?: string;
  webhookUrl?: string;
  webhookMethod?: 'GET' | 'POST';
  aiBotId?: string;
  assignAgentId?: string;
  variableName?: string;
  variableValue?: string;
  targetFlowId?: string;
  targetNodeId?: string;
  callbackTag?: string;
  webhookVariable?: string;
  latitude?: number;
  longitude?: number;
  locationName?: string;
  locationAddress?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  waFlowId?: string;
  waFlowToken?: string;
  waFlowCta?: string;
  waFlowScreen?: string;
  position?: { x: number; y: number };
}

export interface FlowTriggerConfig {
  keyword?: string;
  exactMatch?: boolean;
  regex?: boolean;
  tag?: string;
  tags?: string[];
  campaignId?: string;
  withinHours?: number;
}

export interface FlowState {
  flowId: string;
  flowName?: string;
  currentNodeId: string;
  waitingFor: 'button' | 'text' | 'delay' | 'media' | 'wa_flow' | null;
  /** When this wait started. Missing means a legacy wait that a later message may replace. */
  waitingSince?: string;
  variables: Record<string, string>;
  attempts: number;
  resumeAt?: string;
  /** Sticky A/B assignments, keyed by `${flowId}:${nodeId}`. Survives flow end. */
  abSticky?: Record<string, 'a' | 'b'>;
  /** Persisted cross-flow guard so a delayed hop cannot reset the cycle check. */
  flowPath?: string[];
  flowHops?: number;
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
  awayMessageEnabled?: boolean;
  awayMessage?: string;
}

export const DEFAULT_BUSINESS_HOURS: OrgBusinessHours = {
  startHour: 9,
  endHour: 18,
  days: [1, 2, 3, 4, 5],
  timezone: 'Asia/Kolkata',
};

export const FLOW_NODE_LABELS: Partial<Record<FlowNodeType, string>> = {
  wa_flow: 'WhatsApp Form',
};

export interface InboundFlowPayload {
  organizationId: string;
  conversationId: string;
  contactId: string;
  messageId: string;
  contactPhone: string;
  /** Stable DB workspace id; credentials are resolved immediately before send. */
  whatsappNumberId: string;
  content: string;
  buttonReplyId?: string;
  isNewConversation: boolean;
  messageType?: string;
  hasMedia?: boolean;
  waFlowResponse?: Record<string, unknown>;
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
    id: 'campaign-followup',
    name: 'Campaign Reply Follow-up',
    description: 'Engage customers who reply after a broadcast campaign',
    triggerType: 'CAMPAIGN_REPLY' as const,
    triggerConfig: {},
    color: 'sky',
    nodes: [
      { id: 'thanks', type: 'message' as const, text: 'Thanks for your reply! How can we help you further?', next: 'menu' },
      {
        id: 'menu', type: 'buttons' as const, text: 'Choose an option:',
        buttons: [
          { id: 'info', title: 'More info' },
          { id: 'agent', title: 'Talk to agent' },
        ],
        branches: { info: 'info-msg', agent: 'handoff' },
        intentRoutes: [{ keywords: ['agent', 'human', 'help'], branchKey: 'agent' }],
      },
      { id: 'info-msg', type: 'message' as const, text: 'Here is more information about our offer!', next: 'end' },
      { id: 'handoff', type: 'handoff' as const, text: 'Connecting you with our team now.' },
      { id: 'end', type: 'end' as const, text: 'Thank you!' },
    ],
  },
  {
    id: 'missed-call-followup',
    name: 'Missed Call Follow-up',
    description: 'Auto-message when a WhatsApp call is missed — offer callback or chat',
    triggerType: 'MISSED_CALL' as const,
    triggerConfig: {},
    color: 'rose',
    nodes: [
      {
        id: 'missed',
        type: 'message' as const,
        text: 'Sorry we missed your call! 📞 How would you like us to help?',
        next: 'options',
      },
      {
        id: 'options',
        type: 'buttons' as const,
        text: 'Choose an option:',
        buttons: [
          { id: 'callback', title: 'Request callback' },
          { id: 'chat', title: 'Continue in chat' },
        ],
        branches: { callback: 'callback', chat: 'chat' },
      },
      {
        id: 'callback',
        type: 'request_callback' as const,
        text: 'Got it! Our team will call you back shortly.',
        callbackTag: 'callback-requested',
        next: 'end',
      },
      { id: 'chat', type: 'handoff' as const, text: 'Sure! Type your question and our team will reply here.' },
      { id: 'end', type: 'end' as const, text: 'Thank you! We will be in touch soon.' },
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

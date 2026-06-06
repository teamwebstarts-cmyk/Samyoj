export interface User {
  id: string;
  name: string;
  email: string;
  role?: 'ADMIN' | 'AGENT';
}

export interface Organization {
  id: string;
  companyName: string;
  role?: 'OWNER' | 'ADMIN' | 'AGENT';
}

export type OrgRole = 'OWNER' | 'ADMIN' | 'AGENT';

export interface TeamMember {
  id: string;
  membershipId: string;
  name: string;
  email: string;
  orgRole: OrgRole;
  userRole: 'ADMIN' | 'AGENT';
  assignedCount: number;
  joinedAt: string;
  isCurrentUser: boolean;
}

export interface TeamSummary {
  total: number;
  owners: number;
  admins: number;
  agents: number;
}

export interface TeamAgent {
  id: string;
  name: string;
  email: string;
}

export interface Contact {
  id: string;
  phone: string;
  name?: string;
  tags: string[];
  notes?: string;
}

export interface MessageMetadata {
  mediaId?: string;
  mimeType?: string;
  filename?: string;
  caption?: string;
  mediaPath?: string;
  size?: number;
}

export interface Message {
  id: string;
  conversationId: string;
  direction: 'INBOUND' | 'OUTBOUND';
  type: string;
  content: string;
  status: string;
  metadata?: MessageMetadata | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  status: string;
  unreadCount: number;
  lastMessageAt?: string;
  botActive?: boolean;
  botHandoffAt?: string | null;
  botHandoffReason?: string | null;
  contact: Contact;
  assignedAgent?: { id: string; name: string };
  messages?: Message[];
  labels?: Array<{ label: { id: string; name: string; color: string } }>;
}

export interface BotSetupCheck {
  id: string;
  label: string;
  ok: boolean;
}

export interface BotSetupStatus {
  ready: boolean;
  checks: BotSetupCheck[];
  activeBots: number;
  totalBots: number;
  azureConfigured: boolean;
}

export interface AiBot {
  id: string;
  name: string;
  enabled: boolean;
  isDefault: boolean;
  instructions: string;
  handoffMessage: string;
  triggerKeywords: string[];
  knowledgeItems?: KnowledgeBaseItem[];
  _count?: { knowledgeItems: number };
}

export interface KnowledgeBaseItem {
  id: string;
  botId?: string;
  title: string;
  content: string;
}

export interface Automation {
  id: string;
  name: string;
  triggerType: string;
  config: Record<string, unknown>;
  enabled: boolean;
}

export interface Campaign {
  id: string;
  name: string;
  templateName: string;
  status: string;
  totalContacts: number;
  sentCount: number;
  deliveredCount: number;
  failedCount: number;
  scheduledAt?: string;
}

export interface AnalyticsOverview {
  messagesSent: number;
  deliveryRate: string;
  readRate: string;
  failedMessages: number;
  activeConversations: number;
  totalContacts: number;
}

export interface TemplateButton {
  type: string;
  text: string;
  url?: string;
  phone_number?: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  header?: string;
  body?: string;
  footer?: string;
  buttons?: TemplateButton[];
  components?: Array<{ type: string; text?: string; buttons?: TemplateButton[] }>;
  rejected_reason?: string;
}

export interface TemplateLibraryEntry {
  id: string;
  name: string;
  language: string;
  category: string;
  topic?: string;
  usecase?: string;
  industry?: string[];
  header?: string;
  body?: string;
  footer?: string;
  body_params?: string[];
  buttons?: TemplateButton[];
  components?: Array<{ type: string; text?: string; buttons?: TemplateButton[] }>;
}

export interface ServiceWindowInfo {
  open: boolean;
  lastInboundAt: string | null;
  expiresAt: string | null;
}

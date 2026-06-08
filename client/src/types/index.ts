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

export type OrgRole = 'OWNER' | 'ADMIN' | 'SUPERVISOR' | 'AGENT';

export type AgentAvailability = 'ONLINE' | 'AWAY' | 'OFFLINE';

export interface TeamPermissions {
  manageTeam: boolean;
  manageSettings: boolean;
  manageCampaigns: boolean;
  manageTemplates: boolean;
  manageFlows: boolean;
  manageInbox: boolean;
  viewAnalytics: boolean;
}

export interface ShiftSchedule {
  enabled: boolean;
  timezone: string;
  days: number[];
  startHour: number;
  endHour: number;
}

export interface TeamDepartment {
  id: string;
  name: string;
  color: string;
  memberCount?: number;
  createdAt?: string;
}

export interface TeamMember {
  id: string;
  membershipId: string;
  name: string;
  email: string;
  orgRole: OrgRole;
  userRole: 'ADMIN' | 'AGENT';
  assignedCount: number;
  openCount?: number;
  joinedAt: string;
  isCurrentUser: boolean;
  availability: AgentAvailability;
  maxConcurrentChats: number;
  department?: TeamDepartment | null;
  permissions?: TeamPermissions;
  shiftSchedule?: ShiftSchedule | null;
  lastActiveAt?: string | null;
  avatarUrl?: string | null;
  preferredLanguage?: string;
  twoFactorEnabled?: boolean;
  mustResetPassword?: boolean;
}

export interface TeamSummary {
  total: number;
  owners: number;
  admins: number;
  supervisors: number;
  agents: number;
  online: number;
}

export interface AgentMetrics {
  assignedCount: number;
  openCount: number;
  closedLast7d: number;
  messagesSentLast7d: number;
  handoffsLast7d: number;
  avgFirstResponseMinutes: number | null;
  callsHandledLast7d: number;
}

export interface TeamInvite {
  id: string;
  email: string;
  name?: string | null;
  orgRole: OrgRole;
  department?: TeamDepartment | null;
  status: 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';
  invitedBy?: { id: string; name: string };
  expiresAt: string;
  createdAt?: string;
  inviteUrl?: string;
}

export interface TeamSettings {
  assignmentStrategy: 'LEAST_LOAD' | 'ROUND_ROBIN';
  roundRobinIndex: number;
  seatLimit: number;
  seatsUsed: number;
  handoffOnlyOnline: boolean;
  respectShiftSchedule: boolean;
  plan: string;
}

export interface TeamAuditLog {
  id: string;
  action: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  actor?: { id: string; name: string; email: string } | null;
  targetUser?: { id: string; name: string; email: string } | null;
}

export interface UserSession {
  id: string;
  createdAt: string;
  expiresAt: string;
  userAgent?: string | null;
  ipAddress?: string | null;
}

export interface TeamAgent {
  id: string;
  name: string;
  email: string;
}

export type ContactSource = 'MANUAL' | 'IMPORT' | 'INBOUND' | 'OUTBOUND';

export interface Contact {
  id: string;
  phone: string;
  name?: string;
  email?: string;
  tags: string[];
  notes?: string;
  optedIn?: boolean;
  source?: ContactSource;
  createdAt?: string;
  updatedAt?: string;
  lastActiveAt?: string | null;
  conversation?: {
    id: string;
    status: string;
    lastMessageAt?: string | null;
    unreadCount: number;
    assignedAgent?: { id: string; name: string } | null;
  } | null;
}

export interface ContactTag {
  name: string;
  count: number;
}

export interface ContactSummary {
  total: number;
  named: number;
  optedIn: number;
  active7d: number;
  tagged: number;
}

export interface ContactActivityItem {
  id: string;
  type: 'message' | 'call' | 'campaign';
  at: string;
  title: string;
  subtitle?: string;
  meta?: Record<string, unknown>;
}

export interface ContactDetail {
  contact: Contact;
  conversations: Array<{
    id: string;
    status: string;
    lastMessageAt?: string | null;
    unreadCount: number;
    botActive: boolean;
    assignedAgent?: { id: string; name: string } | null;
    createdAt: string;
  }>;
  activity: ContactActivityItem[];
  stats: {
    totalMessages: number;
    totalCalls: number;
    campaignsReceived: number;
  };
}

export interface InteractiveButton {
  id: string;
  title: string;
}

export interface MessageMetadata {
  mediaId?: string;
  mimeType?: string;
  filename?: string;
  caption?: string;
  mediaPath?: string;
  size?: number;
  buttons?: InteractiveButton[];
  buttonReplyId?: string;
  isButtonReply?: boolean;
  templateName?: string;
  templateLanguage?: string;
}

export interface SendMediaPayload {
  data: string;
  mimeType: string;
  filename?: string;
}

export interface TemplateParams {
  body?: string[];
  header?: string[];
  headerMediaUrl?: string;
}

export interface SendMessagePayload {
  content?: string;
  type?: 'TEXT' | 'TEMPLATE' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO';
  templateName?: string;
  templateLanguage?: string;
  templateParams?: TemplateParams;
  media?: SendMediaPayload;
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

export interface ActiveFlowInfo {
  flowId: string;
  flowName?: string;
  currentNodeId: string;
  currentStepLabel?: string;
  waitingFor?: string | null;
}

export interface Conversation {
  id: string;
  status: string;
  unreadCount: number;
  lastMessageAt?: string;
  botActive?: boolean;
  botHandoffAt?: string | null;
  botHandoffReason?: string | null;
  activeBot?: { id: string; name: string } | null;
  activeFlow?: ActiveFlowInfo | null;
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
  handoffKeywords: string[];
  businessHoursOnly: boolean;
  temperature: number;
  maxTokens: number;
  rateLimitPerMin: number;
  knowledgeItems?: KnowledgeBaseItem[];
  _count?: { knowledgeItems: number };
}

export interface BotAnalytics {
  totalReplies: number;
  successfulReplies: number;
  skippedReplies: number;
  failedReplies: number;
  handoffs: number;
  avgDurationMs: number;
  totalTokens: number;
  skipReasons: Record<string, number>;
  handoffReasons: Record<string, number>;
  recentRuns: Array<{
    id: string;
    status: string;
    action: string;
    durationMs: number | null;
    createdAt: string;
    conversationId: string | null;
    error: string | null;
  }>;
}

export interface KnowledgeBaseItem {
  id: string;
  botId?: string;
  title: string;
  content: string;
  sourceType?: 'FAQ' | 'URL' | 'PDF' | 'DOCUMENT';
  sourceUrl?: string | null;
}

export interface OrgAiSettings {
  useCustomConfig?: boolean;
  endpoint?: string;
  deployment?: string;
  embeddingDeployment?: string;
  apiVersion?: string;
  monthlyTokenLimit?: number;
  hasApiKey?: boolean;
}

export interface AiUsageSummary {
  periodDays: number;
  totalRequests: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  monthTokens: number;
  monthlyTokenLimit: number | null;
  byAction: Record<string, number>;
}

export interface AiBotVersion {
  id: string;
  version: number;
  snapshot: Record<string, unknown>;
  changedBy?: string | null;
  changeNote?: string | null;
  createdAt: string;
}

export interface AiBotAuditLog {
  id: string;
  action: string;
  changes?: Record<string, unknown> | null;
  userId?: string | null;
  createdAt: string;
}

export interface Automation {
  id: string;
  name: string;
  triggerType: string;
  config: Record<string, unknown>;
  enabled: boolean;
}

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

export type FlowStatus = 'DRAFT' | 'PUBLISHED';

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

export interface FlowStats {
  starts: number;
  completions: number;
  handoffs: number;
  dropoffs: Record<string, number>;
}

export interface Flow {
  id: string;
  name: string;
  description?: string | null;
  triggerType: FlowTriggerType;
  triggerConfig: Record<string, unknown>;
  nodes: FlowNode[];
  draftNodes?: FlowNode[] | null;
  startNodeId?: string | null;
  status?: FlowStatus;
  version?: number;
  stats?: FlowStats;
  enabled: boolean;
  priority: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  triggerType: FlowTriggerType;
  triggerConfig: Record<string, unknown>;
  nodes: FlowNode[];
  color?: string;
}

export interface BusinessHours {
  startHour: number;
  endHour: number;
  days: number[];
  timezone?: string;
}

export interface Campaign {
  id: string;
  name: string;
  templateName: string;
  templateLanguage?: string;
  templateParams?: { body?: string[]; header?: string[]; headerMediaUrl?: string };
  audienceType?: 'MANUAL' | 'TAGS' | 'CONTACTS' | 'ALL_OPTED_IN';
  audienceConfig?: { tags?: string[]; contactIds?: string[]; requireOptIn?: boolean };
  whatsappNumberId?: string;
  status: string;
  totalContacts: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  scheduledAt?: string;
  timezone?: string;
  pausedAt?: string;
  cancelledAt?: string;
  createdAt?: string;
}

export interface CampaignRecipient {
  id: string;
  phone: string;
  name?: string;
  status: string;
  errorMessage?: string;
  retryCount?: number;
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
  variables?: { body?: string[]; header?: string[] };
}

export interface CampaignAnalytics {
  campaign: Campaign;
  deliveryRate: string;
  readRate: string;
  byStatus: Record<string, number>;
  topErrors: Array<{ message: string; count: number }>;
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
  components?: Array<{ type: string; text?: string; format?: string; buttons?: TemplateButton[] }>;
  rejected_reason?: string;
  quality_score?: { score?: string; date?: number };
}

export interface TemplateUsage {
  campaigns: Array<{
    id: string;
    name: string;
    status: string;
    totalContacts: number;
    sentCount: number;
    deliveredCount: number;
    failedCount: number;
    createdAt: string;
  }>;
  totals: {
    campaignCount: number;
    totalSent: number;
    totalDelivered: number;
    totalFailed: number;
  };
}

export interface TemplateListResponse {
  templates: MessageTemplate[];
  paging?: { cursors?: { before?: string; after?: string }; next?: string } | null;
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

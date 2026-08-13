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
  joinedAt: string;
  isCurrentUser: boolean;
  availability: AgentAvailability;
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
  rolePermissions?: Partial<Record<OrgRole, Partial<TeamPermissions>>>;
}

export type RolePermissionsMatrix = Record<OrgRole, TeamPermissions>;

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
  lead?: { id: string; stage: string; title: string } | null;
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
  isSticker?: boolean;
  /** True when inbound/outbound media is a GIF (incl. WhatsApp GIF-as-video). */
  isGif?: boolean;
  replyToMessageId?: string;
  replyToMetaId?: string;
  replyPreview?: string;
  reactions?: Array<{ emoji: string; from: string }>;
  buttons?: InteractiveButton[];
  buttonReplyId?: string;
  isButtonReply?: boolean;
  templateName?: string;
  templateLanguage?: string;
  source?: 'flow' | 'automation';
  triggerType?: string;
  flowId?: string;
  flowName?: string;
  automationId?: string;
  automationName?: string;
  ctaType?: 'url' | 'call';
  listMenu?: boolean;
  interactive?: SendMessagePayload['interactive'];
  waFlow?: boolean;
  contacts?: Array<{ name: string; phone: string; email?: string }>;
  location?: { latitude: number; longitude: number; name?: string; address?: string };
  isVoice?: boolean;
  /** Meta delivered type:unsupported (polls, edits, …) — Cloud API limitation. */
  isUnsupported?: boolean;
  unsupportedType?: string;
  metaErrorCode?: number;
  metaErrorTitle?: string;
  /** Centered WhatsApp-style call notice in the thread. */
  isCallEvent?: boolean;
  /** Legacy agent-only call summary rows (hidden from chat thread). */
  isCallSummary?: boolean;
  callId?: string;
  callStatus?: string;
  callDirection?: string;
  durationSeconds?: number;
  callTone?: 'missed' | 'completed' | 'failed';
}

export interface SendMediaPayload {
  data?: string;
  mediaPath?: string;
  mimeType: string;
  filename?: string;
  /** True when recorded as a WhatsApp voice note. */
  voice?: boolean;
}

export interface TemplateParams {
  body?: string[];
  header?: string[];
  headerMediaUrl?: string;
  couponCode?: string;
}

export interface SendMessagePayload {
  content?: string;
  type?: 'TEXT' | 'TEMPLATE' | 'IMAGE' | 'VIDEO' | 'DOCUMENT' | 'AUDIO' | 'INTERACTIVE' | 'REACTION';
  replyToMessageId?: string;
  reaction?: { messageId: string; emoji: string };
  templateName?: string;
  templateLanguage?: string;
  templateParams?: TemplateParams;
  media?: SendMediaPayload;
  interactive?: {
    mode: 'reply' | 'cta_url' | 'cta_call' | 'list';
    header?: string;
    body: string;
    footer?: string;
    buttons?: Array<{ id: string; title: string }>;
    ctaLabel?: string;
    ctaUrl?: string;
    ctaPhone?: string;
    listButtonLabel?: string;
    listSections?: Array<{
      title?: string;
      rows: Array<{ id: string; title: string; description?: string }>;
    }>;
  };
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

export interface ConversationLabel {
  label: { id: string; name: string; color: string };
}

export interface InternalNote {
  id: string;
  content: string;
  createdAt: string;
  user?: { id: string; name: string };
}

export interface InboxLabel {
  id: string;
  name: string;
  color: string;
  conversationCount?: number;
}

export interface CannedReply {
  id: string;
  shortcut: string;
  title: string;
  content: string;
}

export interface Conversation {
  id: string;
  status: string;
  unreadCount: number;
  createdAt?: string;
  lastMessageAt?: string;
  botActive?: boolean;
  botHandoffAt?: string | null;
  botHandoffReason?: string | null;
  activeBot?: { id: string; name: string } | null;
  activeFlow?: ActiveFlowInfo | null;
  isFavorite?: boolean;
  snoozedUntil?: string | null;
  slaDueAt?: string | null;
  slaBreached?: boolean;
  firstResponseAt?: string | null;
  contact: Contact;
  assignedAgent?: { id: string; name: string };
  messages?: Message[];
  labels?: ConversationLabel[];
  internalNotes?: InternalNote[];
}

export interface ConversationStats {
  totalChats: number;
  openTickets: number;
  avgFirstResponseMinutes: number | null;
}

export interface BillingPlan {
  id: string;
  name: string;
  pricePaise: number;
  priceLabel: string;
  seats: number;
  features: string[];
}

export interface BillingInfo {
  plan: string;
  currentPlan: BillingPlan;
  plans: BillingPlan[];
  seatsUsed: number;
  seatLimit: number;
  canManageBilling: boolean;
  razorpayConfigured: boolean;
  razorpayKeyId: string | null;
  planExpiresAt?: string | null;
  subscriptionStatus?: string;
  recentPayments?: Array<{ planId: string; amountPaise: number; paidAt: string | null }>;
}

export interface BillingUsage {
  period: string;
  totalConversations: number;
  totalCostInr: number;
  byCategory: Record<string, { count: number; costInr: number }>;
  qualityRatings: Array<{ phoneNumber: string; qualityRating: string; wabaId: string }>;
  messagesWithPricing: number;
}

export interface ApiKeyItem {
  id: string;
  name: string;
  keyPrefix: string;
  lastUsedAt?: string | null;
  createdAt: string;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  createdAt?: string;
}

export interface SlaStats {
  breached: number;
  pending: number;
  avgFirstResponseMinutes: number | null;
}

export interface ReportsData {
  periodDays: number;
  messaging: {
    sent: number;
    delivered: number;
    read: number;
    failed: number;
    inbound: number;
    deliveryRate: string;
    readRate: string;
  };
  conversations: { active: number; closed: number };
  contacts: { total: number };
  campaigns: { sent: number; delivered: number; read: number; failed: number };
  calls: { completed: number };
  ai: { requests: number; totalTokens: number };
  agentPerformance: Array<{
    agentId: string;
    name: string;
    messagesSent: number;
    openAssigned: number;
    closedLastPeriod: number;
    availability: AgentAvailability;
  }>;
}

export interface BotSetupCheck {
  id: string;
  label: string;
  ok: boolean;
  optional?: boolean;
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
  hasEmbedding?: boolean;
}

export interface BotTestResult {
  reply: string | null;
  handoff: boolean;
  handoffReason?: string;
  botId?: string;
  botName?: string;
  skipped?: boolean;
  skipReason?: string;
  totalTokens?: number;
  knowledgeMatches?: Array<{
    id: string;
    title: string;
    content: string;
    score: number;
    sourceType?: string;
  }>;
}

export interface OrgAiSettings {
  brainProvider?: 'sarvam' | 'azure';
  useCustomConfig?: boolean;
  endpoint?: string;
  deployment?: string;
  embeddingDeployment?: string;
  apiVersion?: string;
  monthlyTokenLimit?: number;
  hasApiKey?: boolean;
}

export interface OrgMetaSettings {
  appId?: string;
  hasAppSecret?: boolean;
  configured?: boolean;
  usingPlatform?: boolean;
}

export interface WebhookStatus {
  connected: boolean;
  phoneNumber?: string;
  wabaId?: string;
  webhookUrl?: string | null;
  subscribed?: boolean | null;
  statusCheckFailed: boolean;
}

export interface WebhookHealth {
  totalReceived: number;
  totalProcessed: number;
  totalErrors: number;
  lastReceivedAt?: string | null;
  lastError?: string | null;
  lastFbTraceId?: string | null;
  queueDepth?: number;
  webhookUrl?: string;
  verifyTokenConfigured?: boolean;
  appSecretConfigured?: boolean;
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

export type FlowStatus = 'DRAFT' | 'PUBLISHED';

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
  mediaUrl?: string;
  mediaType?: 'image' | 'document' | 'video' | 'audio';
  mediaCaption?: string;
  delaySeconds?: number;
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

export interface AutomationConflict {
  type: string;
  severity: 'warning' | 'error';
  message: string;
  items: string[];
}

export interface AutomationAnalytics {
  days: number;
  total: number;
  success: number;
  failed: number;
  skipped: number;
  byTrigger: Record<string, number>;
  byAction: Record<string, number>;
  byStatus: Record<string, number>;
  daily: Array<{ date: string; total: number; success: number; failed: number }>;
  recent: Array<{
    id: string;
    triggerType: string;
    action: string;
    status: string;
    flowId?: string | null;
    conversationId?: string | null;
    error?: string | null;
    createdAt: string;
  }>;
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

export interface WhatsAppForm {
  id: string;
  name: string;
  status: string;
  categories: string[];
  validationErrors: string[];
}

export interface WaFormFieldInput {
  id: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'number';
  required?: boolean;
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
  audienceConfig?: {
    tags?: string[];
    contactIds?: string[];
    requireOptIn?: boolean;
    operator?: 'OR' | 'AND';
    groups?: Array<{ type: 'TAGS' | 'CONTACTS'; tags?: string[]; contactIds?: string[] }>;
  };
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

export interface DailyAnalyticsPoint {
  date: string;
  messagesSent: number;
  deliveryRate: number;
  readRate: number;
  activeConversations: number;
  totalContacts: number;
}

export interface AnalyticsOverview {
  days?: number;
  from?: string;
  to?: string;
  periodMode?: 'preset' | 'custom' | 'overall';
  messagesSent: number;
  /** Funnel: DELIVERED + READ (reached device) */
  messagesDelivered?: number;
  /** Exclusive: still at DELIVERED (not yet read) */
  messagesDeliveredOnly?: number;
  messagesRead?: number;
  messagesFailed?: number;
  messagesPending?: number;
  deliveryRate: string;
  readRate: string;
  failedMessages: number;
  activeConversations: number;
  totalContacts: number;
  deltas?: {
    messagesSent: number | null;
    deliveryRate: number | null;
    readRate: number | null;
    failedMessages: number | null;
    activeConversations: number | null;
    totalContacts: number | null;
  };
  dailySeries?: DailyAnalyticsPoint[];
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
  /** Meta param types: TEXT | AMOUNT | DATE | PHONE NUMBER | EMAIL | NUMBER | ADDRESS */
  body_param_types?: string[];
  header_params?: string[];
  buttons?: TemplateButton[];
  components?: Array<{ type: string; text?: string; buttons?: TemplateButton[] }>;
}

export interface ServiceWindowInfo {
  open: boolean;
  lastInboundAt: string | null;
  expiresAt: string | null;
  windowOpensAt?: string | null;
}

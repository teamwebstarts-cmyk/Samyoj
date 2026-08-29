import axios from 'axios';
import { getErrorMessage, logError } from '../utils/errors';
import { clearAuthTokens, clearClientSessionCookies, getCsrfToken, hasAuthSessionHint } from '../utils/authStorage';
import type { AgentAvailability, OrgRole, TeamPermissions, TeamSettings } from '../types';
import { apiBaseUrl } from './utils';

const API_URL = apiBaseUrl;

/** Active WhatsApp number sent with every API request for data isolation */
let activeWhatsappNumberId: string | null = null;
let activeWhatsappNumberResolved = false;

export function setActiveWhatsappNumberId(id: string | null) {
  activeWhatsappNumberId = id;
}

export function setActiveWhatsappNumberResolved(resolved: boolean) {
  activeWhatsappNumberResolved = resolved;
}

export function getActiveWhatsappNumberId() {
  return activeWhatsappNumberId;
}

export class WhatsappNumberScopeError extends Error {
  code = 'WHATSAPP_NUMBER_SCOPE_UNRESOLVED';

  constructor(message = 'The active WhatsApp number is still resolving') {
    super(message);
    this.name = 'WhatsappNumberScopeError';
  }
}

export function isNumberScopedUrl(url?: string) {
  if (!url) return false;
  const path = url.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/api(?=\/)/, '');
  return /^\/(inbox|contacts|calling|ai-bot|campaigns|templates|flows(?:-assets)?|automations|analytics|tickets|commerce|leads|wa-forms)(?:\/|$)/.test(
    path
  );
}

function isExpectedApiNoise(error: unknown): boolean {
  if (error instanceof WhatsappNumberScopeError) return true;
  if (!axios.isAxiosError(error)) return false;
  const status = error.response?.status;
  const url = String(error.config?.url || '');
  if (status === 404 && /\/calling\/[^/?]+\/signaling(?:\?|$)/.test(url)) return true;
  if (status === 401 && /\/auth\/(?:me|refresh|login)(?:\?|$)/.test(url)) return true;
  if (status === 429 && /\/auth\/(?:refresh|login)(?:\?|$)/.test(url)) return true;
  if (status === 402) return true;
  if (status === 503 && /\/whatsapp\/connect-url(?:\?|$)/.test(url)) return true;
  return false;
}

function attachCsrfHeader(config: import('axios').InternalAxiosRequestConfig) {
  const method = (config.method || 'get').toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return;
  const csrf = getCsrfToken();
  if (csrf) {
    config.headers['x-csrf-token'] = csrf;
  }
}

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
  // Fetch avoids antivirus XHR wrappers that throw on `M_ID` (Kaspersky `200.js`).
  adapter: 'fetch' as const,
});

api.interceptors.request.use(async (config) => {
  if (isNumberScopedUrl(config.url)) {
    if (!activeWhatsappNumberResolved || !activeWhatsappNumberId) {
      return Promise.reject(new WhatsappNumberScopeError());
    }
    (config as typeof config & { __whatsappNumberId?: string }).__whatsappNumberId =
      activeWhatsappNumberId;
  }
  attachCsrfHeader(config);
  if (activeWhatsappNumberId) {
    config.headers['X-WhatsApp-Number-Id'] = activeWhatsappNumberId;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const requestNumberId = (response.config as typeof response.config & {
      __whatsappNumberId?: string;
    }).__whatsappNumberId;
    if (
      requestNumberId &&
      activeWhatsappNumberId &&
      requestNumberId !== activeWhatsappNumberId
    ) {
      return Promise.reject(
        new WhatsappNumberScopeError('The response belongs to a previous WhatsApp number')
      );
    }
    return response;
  },
  async (error) => {
    const original = error.config;
    const aborted =
      error?.code === 'ERR_CANCELED' ||
      error?.name === 'CanceledError' ||
      error?.message === 'canceled' ||
      error?.message === 'cancelled';
    if (aborted) {
      return Promise.reject(error);
    }
    const isRefreshCall = /\/auth\/refresh(?:\?|$)/.test(original?.url || '');
    const skipSessionRefresh =
      /\/auth\/(login|register|refresh|logout|forgot-password|reset-password|verify-email|resend-verification)(?:\?|$)/.test(
        original?.url || ''
      ) || window.location.pathname.startsWith('/login');
    if (error.response?.status === 429 && isRefreshCall) {
      return Promise.reject(error);
    }
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !isRefreshCall &&
      !skipSessionRefresh
    ) {
      original._retry = true;
      try {
        await refreshSessionSingleFlight();
        return api(original);
      } catch (refreshError) {
        if (!isExpectedApiNoise(refreshError)) {
          logError(refreshError, {
            source: 'auth',
            action: 'Session refresh failed',
            method: original.method?.toUpperCase(),
            url: original.url,
          });
        }
        clearAuthTokens();
        const returnTo = `${window.location.pathname}${window.location.search}`;
        if (!window.location.pathname.startsWith('/login')) {
          window.location.href = `/login?returnTo=${encodeURIComponent(returnTo)}`;
        }
      }
    }

    // 402 plan limits: do not open global upgrade modals on login/dashboard.
    // Callers can still read the error; Billing page remains the upgrade surface.

    if (!isExpectedApiNoise(error)) {
      logError(error, {
        source: 'api',
        action: 'API request failed',
        method: original?.method?.toUpperCase(),
        url: original?.url,
        status: error.response?.status,
      });
    }

    return Promise.reject(error);
  }
);

let refreshPromise: Promise<void> | null = null;
let refreshCooldownUntil = 0;

async function refreshSessionSingleFlight() {
  if (Date.now() < refreshCooldownUntil) {
    throw new Error('Session refresh is temporarily rate-limited. Please wait and try again.');
  }
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_URL}/auth/refresh`, {}, { withCredentials: true })
      .then(() => undefined)
      .catch((err) => {
        if (axios.isAxiosError(err) && err.response?.status === 429) {
          refreshCooldownUntil = Date.now() + 60_000;
        }
        throw err;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

/** Refresh the cookie session (single-flight). Used by Socket.IO on auth errors. */
export async function ensureFreshAccessToken(): Promise<boolean> {
  if (!hasAuthSessionHint()) return false;
  try {
    await refreshSessionSingleFlight();
    return true;
  } catch (err) {
    const status = axios.isAxiosError(err) ? err.response?.status : undefined;
    if (status === 401) {
      clearAuthTokens();
      clearClientSessionCookies();
    }
    return false;
  }
}

export { getErrorMessage };

export default api;

export const authApi = {
  register: (data: { name: string; email: string; password: string; companyName: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string; totpCode?: string }) =>
    api.post('/auth/login', data),
  googleUrl: (returnTo?: string) =>
    api.get('/auth/oauth/google/url', { params: returnTo ? { returnTo } : undefined }),
  googleStatus: () => api.get('/auth/oauth/google/status'),
  exchangeOAuthCode: (code: string) => api.post('/auth/oauth/exchange', { code }),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout', {}),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) =>
    api.post('/auth/reset-password', { token, password }),
  verifyEmail: (token: string) => api.post('/auth/verify-email', { token }),
  resendVerification: (email: string) => api.post('/auth/resend-verification', { email }),
};

export const inboxApi = {
  list: (params?: Record<string, string>) => api.get('/inbox', { params }),
  unreadTotal: () => api.get('/inbox/unread-total'),
  start: (data: {
    phone: string;
    name?: string;
    email?: string;
    tags?: string[];
    notes?: string;
    customAttributes?: Record<string, string>;
    optedIn?: boolean;
  }) => api.post('/inbox/start', data),
  get: (id: string) => api.get(`/inbox/${id}`),
  messages: (id: string, params?: Record<string, string>) =>
    api.get(`/inbox/${id}/messages`, { params }),
  clearMessages: (id: string) =>
    api.delete<{ data: { deleted: number } }>(`/inbox/${id}/messages`),
  remove: (id: string) =>
    api.delete<{ data: { deleted: boolean; conversationId: string } }>(`/inbox/${id}`),
  deleteMessages: (id: string, messageIds: string[]) =>
    api.post<{ data: { deleted: number; messageIds: string[] } }>(`/inbox/${id}/messages/delete`, {
      messageIds,
    }),
  deleteMessage: (messageId: string) =>
    api.delete<{ data: { deleted: number; messageIds: string[] } }>(
      `/inbox/messages/${messageId}`
    ),
  markRead: (id: string) => api.post(`/inbox/${id}/read`),
  markUnread: (id: string) => api.post(`/inbox/${id}/unread`),
  mediaUrl: (messageId: string) => api.get(`/inbox/messages/${messageId}/media-url`),
  retryMessage: (messageId: string) => api.post(`/inbox/messages/${messageId}/retry`),
  send: (id: string, payload: string | import('../types').SendMessagePayload) =>
    api.post(
      `/inbox/${id}/messages`,
      typeof payload === 'string' ? { content: payload } : payload
    ),
  assign: (id: string, agentId: string | null) =>
    api.patch(`/inbox/${id}/assign`, { agentId }),
  setBot: (
    id: string,
    data: { active?: boolean; resetHandoff?: boolean; activeBotId?: string | null }
  ) => api.patch(`/inbox/${id}/bot`, data),
  jumpFlow: (id: string, nodeId: string) => api.patch(`/inbox/${id}/flow-jump`, { nodeId }),
  setStatus: (id: string, status: string) => api.patch(`/inbox/${id}/status`, { status }),
  snooze: (id: string, until: string) => api.patch(`/inbox/${id}/snooze`, { until }),
  unsnooze: (id: string) => api.delete(`/inbox/${id}/snooze`),
  favorite: (id: string, isFavorite: boolean) =>
    api.patch(`/inbox/${id}/favorite`, { isFavorite }),
  stats: (id: string) => api.get<{ data: import('../types').ConversationStats }>(`/inbox/${id}/stats`),
  exportChat: (id: string, format: 'txt' | 'json') =>
    api.get(`/inbox/${id}/export`, { params: { format }, responseType: 'blob' }),
  deleteNote: (noteId: string) => api.delete(`/inbox/notes/${noteId}`),
  bulk: (data: {
    conversationIds: string[];
    action: 'assign' | 'status' | 'snooze' | 'unsnooze' | 'delete';
    agentId?: string;
    status?: 'OPEN' | 'PENDING' | 'CLOSED';
    snoozedUntil?: string;
  }) =>
    api.post<{ data: { updated: number; failed: Array<{ id: string; reason: string }> } }>(
      '/inbox/bulk',
      data
    ),
  addNote: (id: string, content: string) => api.post(`/inbox/${id}/notes`, { content }),
  uploadMedia: (data: { mimeType: string; data: string; filename?: string }) =>
    api.post('/media/upload', data),
  uploadUrl: (data: { mimeType: string; size: number; filename?: string }) =>
    api.post('/media/upload-url', data),
};

export const labelsApi = {
  list: () => api.get('/labels'),
  create: (data: { name: string; color?: string }) => api.post('/labels', data),
  update: (id: string, data: { name?: string; color?: string }) => api.patch(`/labels/${id}`, data),
  remove: (id: string) => api.delete(`/labels/${id}`),
  addToConversation: (conversationId: string, labelId: string) =>
    api.post(`/labels/conversations/${conversationId}`, { labelId }),
  removeFromConversation: (conversationId: string, labelId: string) =>
    api.delete(`/labels/conversations/${conversationId}/${labelId}`),
};

export const cannedRepliesApi = {
  list: (search?: string) => api.get('/canned-replies', { params: search ? { search } : {} }),
  create: (data: { shortcut: string; title: string; content: string }) =>
    api.post('/canned-replies', data),
  update: (id: string, data: Partial<{ shortcut: string; title: string; content: string }>) =>
    api.patch(`/canned-replies/${id}`, data),
  remove: (id: string) => api.delete(`/canned-replies/${id}`),
};

export interface WhatsappPhoneOption {
  wabaId: string;
  phoneNumberId: string;
  phoneNumber: string;
  verifiedName?: string;
}

export interface WhatsappConnectResult {
  requiresSelection: boolean;
  pendingToken?: string;
  phones?: WhatsappPhoneOption[];
  id?: string;
  phoneNumber?: string;
  phoneNumberId?: string;
  wabaId?: string;
  isActive?: boolean;
  webhookConfigured?: boolean;
}

export const whatsappApi = {
  metaConfig: () => api.get<{ data: import('../types').OrgMetaSettings }>('/whatsapp/meta-config'),
  updateMetaConfig: (data: { appId: string; appSecret?: string }) =>
    api.patch<{ data: import('../types').OrgMetaSettings }>('/whatsapp/meta-config', data),
  connectUrl: (redirectUri?: string, mode?: 'standard' | 'coexistence') =>
    api.get('/whatsapp/connect-url', {
      params: {
        ...(redirectUri ? { redirectUri } : {}),
        ...(mode === 'coexistence' ? { mode: 'coexistence' } : {}),
      },
    }),
  completeConnect: (code: string, state: string, wabaIdHint?: string) =>
    api.post<{ data: WhatsappConnectResult }>('/whatsapp/connect/callback', {
      code,
      state,
      ...(wabaIdHint ? { wabaIdHint } : {}),
    }),
  selectConnect: (pendingToken: string, phoneNumberId: string, wabaId: string) =>
    api.post<{ data: WhatsappConnectResult }>('/whatsapp/connect/select', {
      pendingToken,
      phoneNumberId,
      wabaId,
    }),
  connect: (data: Record<string, string>) => api.post('/whatsapp/connect', data),
  numbers: () => api.get('/whatsapp/numbers'),
  disconnect: (id: string) => api.delete(`/whatsapp/numbers/${id}`),
  webhookStatus: () =>
    api.get<{ data: import('../types').WebhookStatus }>('/whatsapp/webhook-status'),
  webhookHealth: () =>
    api.get<{ data: import('../types').WebhookHealth }>('/whatsapp/webhook/health'),
  setupWebhook: () => api.post('/whatsapp/setup-webhook'),
  paymentHint: () =>
    api.get<{
      data: {
        connected?: boolean;
        hasPaymentMethod?: boolean | null;
        detected?: boolean;
        guidanceUrl?: string;
        message?: string;
      };
    }>('/whatsapp/payment-hint'),
};

export const automationApi = {
  list: (params?: Record<string, string>) => api.get('/automations', { params }),
  create: (data: Record<string, unknown>) => api.post('/automations', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/automations/${id}`, data),
  delete: (id: string) => api.delete(`/automations/${id}`),
  analytics: (days = 30) => api.get('/automations/analytics', { params: { days: String(days) } }),
  conflicts: () => api.get('/automations/conflicts'),
  previewConflicts: (data: {
    kind: 'automation' | 'flow';
    excludeId?: string;
    name: string;
    triggerType: string;
    config?: Record<string, unknown>;
    triggerConfig?: Record<string, unknown>;
    enabled?: boolean;
    status?: 'DRAFT' | 'PUBLISHED';
  }) => api.post('/automations/conflicts/preview', data),
  test: (id: string, phone: string) => api.post(`/automations/${id}/test`, { phone }),
};

export const flowApi = {
  list: (params?: Record<string, string>) => api.get('/flows', { params }),
  get: (id: string) => api.get(`/flows/${id}`),
  create: (data: Record<string, unknown>) => api.post('/flows', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/flows/${id}`, data),
  delete: (id: string) => api.delete(`/flows/${id}`),
  templates: () => api.get('/flows/templates'),
  fromTemplate: (templateId: string) => api.post(`/flows/from-template/${templateId}`),
  duplicate: (id: string) => api.post(`/flows/${id}/duplicate`),
  validate: (data: Record<string, unknown>) => api.post('/flows/validate', data),
  simulate: (data: Record<string, unknown>) => api.post('/flows/simulate', data),
  analytics: (id: string) => api.get(`/flows/${id}/analytics`),
  versions: (id: string) => api.get(`/flows/${id}/versions`),
  publish: (id: string, note?: string) => api.post(`/flows/${id}/publish`, { note }),
  restoreVersion: (id: string, version: number) => api.post(`/flows/${id}/restore/${version}`),
  scheduleStart: (id: string, data: { conversationId: string; delaySeconds?: number }) =>
    api.post(`/flows/${id}/schedule`, data),
  test: (id: string, data: { phone: string; nodes?: unknown[]; startNodeId?: string }) =>
    api.post(`/flows/${id}/test`, data),
};

export const settingsApi = {
  get: () => api.get('/settings'),
  alerts: () => api.get('/settings/alerts'),
  updateBusinessHours: (data: {
    startHour: number;
    endHour: number;
    days: number[];
    timezone?: string;
  }) => api.patch('/settings/business-hours', data),
  getAi: () => api.get('/settings/ai'),
  updateAi: (data: Record<string, unknown>) => api.patch('/settings/ai', data),
  aiUsage: (days = 30) => api.get('/settings/ai/usage', { params: { days: String(days) } }),
  updateCampaigns: (data: {
    dailySendLimit?: number;
    dailyBudgetInr?: number;
    batchSize?: number;
    batchDelayMs?: number;
    mapFirstBodyVariableToName?: boolean;
  }) => api.patch('/settings/campaigns', data),
  getProfile: () => api.get('/settings/profile'),
  updateProfile: (data: {
    companyName?: string;
    description?: string;
    industry?: string;
    website?: string;
    email?: string;
    address?: string;
    aiNotes?: string;
    audience?: string | null;
    valueProps?: string[];
    defaultLocale?: string;
    timezone?: string;
  }) => api.patch('/settings/profile', data),
  getUiToggles: () => api.get('/settings/ui-toggles'),
  updateUiToggles: (data: { hiddenModules?: string[]; hiddenSettingsTabs?: string[] }) =>
    api.patch('/settings/ui-toggles', data),
};

export const callingApi = {
  status: () => api.get('/calling/status'),
  settings: () => api.get('/calling/settings'),
  updateSettings: (data: Record<string, unknown>) => api.patch('/calling/settings', data),
  previewVoice: (data: { text: string; speaker?: string; language?: string }) =>
    api.post('/calling/voice/preview', data),
  enable: () => api.post('/calling/enable'),
  disable: () => api.post('/calling/disable'),
  analytics: (days = 30) => api.get('/calling/analytics', { params: { days: String(days) } }),
  list: (params?: Record<string, string>) => api.get('/calling', { params }),
  get: (id: string) => api.get(`/calling/${id}`),
  getSignaling: (id: string) => api.get(`/calling/${id}/signaling`),
  accept: (id: string, sdpAnswer: string) => api.post(`/calling/${id}/accept`, { sdpAnswer }),
  decline: (id: string) => api.post(`/calling/${id}/decline`),
  callback: (data: { contactId?: string; phone?: string; conversationId?: string; sdpOffer?: string }) =>
    api.post('/calling/callback', data),
  permission: (contactId: string) => api.get(`/calling/permission/${contactId}`),
  requestPermission: (contactId: string) => api.post('/calling/permission/request', { contactId }),
  addNote: (id: string, content: string) => api.post(`/calling/${id}/notes`, { content }),
  updateNotes: (id: string, notes: string) => api.patch(`/calling/${id}`, { notes }),
  terminate: (id: string) => api.post(`/calling/${id}/terminate`),
  remove: (id: string) =>
    api.delete<{ data: { deleted: boolean; callId: string } }>(`/calling/${id}`),
  bulkRemove: (callIds: string[]) =>
    api.post<{ data: { deleted: number; callIds: string[] } }>('/calling/bulk', {
      callIds,
      action: 'delete',
    }),
};

export const aiBotApi = {
  status: () => api.get('/ai-bot/status'),
  providerStatus: () => api.get('/ai-bot/provider-status'),
  list: (channel?: 'CHAT' | 'CALL') =>
    api.get('/ai-bot', { params: channel ? { channel } : undefined }),
  get: (id: string) => api.get(`/ai-bot/${id}`),
  create: (data: Record<string, unknown>) => api.post('/ai-bot', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/ai-bot/${id}`, data),
  delete: (id: string) => api.delete(`/ai-bot/${id}`),
  generatePersonality: (data: {
    intent: string;
    channel: 'CHAT' | 'CALL';
    botId?: string;
    businessWebsite?: string;
    businessNotes?: string;
  }) => api.post('/ai-bot/generate-personality', data),
  previewTest: (data: {
    message: string;
    channel: 'CHAT' | 'CALL';
    name: string;
    instructions?: string;
    offerHandoff?: boolean;
    businessHoursOnly?: boolean;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    previewKnowledge?: Array<{ title: string; content: string }>;
    previewBusiness?: {
      businessName?: string;
      businessWebsite?: string | null;
      businessNotes?: string | null;
    };
  }) => api.post('/ai-bot/preview/test', data),
  previewGenerateTraining: (data: {
    intent: string;
    channel: 'CHAT' | 'CALL';
    businessWebsite?: string;
    businessNotes?: string;
    existingTitles?: string[];
  }) => api.post('/ai-bot/preview/generate-training', data),
  generateTraining: (
    botId: string,
    data: { intent: string; businessWebsite?: string; businessNotes?: string }
  ) => api.post(`/ai-bot/${botId}/generate-training`, data),
  setCallingAi: (enabled: boolean) => api.patch('/ai-bot/calling-ai', { enabled }),
  setChatAi: (enabled: boolean, botId?: string) =>
    api.patch('/ai-bot/chat-ai', { enabled, ...(botId ? { botId } : {}) }),
  addFaq: (botId: string, data: { title: string; content: string }) =>
    api.post(`/ai-bot/${botId}/faq`, data),
  updateFaq: (botId: string, faqId: string, data: { title?: string; content?: string }) =>
    api.patch(`/ai-bot/${botId}/faq/${faqId}`, data),
  deleteFaq: (botId: string, faqId: string) => api.delete(`/ai-bot/${botId}/faq/${faqId}`),
  test: (
    botId: string,
    data: {
      message: string;
      instructions?: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
      previewKnowledge?: Array<{ title: string; content: string }>;
      previewBusiness?: {
        businessName?: string;
        businessWebsite?: string | null;
        businessNotes?: string | null;
      };
    }
  ) => api.post(`/ai-bot/${botId}/test`, data),
  applyToAllChats: (botId: string) => api.post(`/ai-bot/${botId}/apply-all`),
  removeFromAllChats: (botId: string) => api.post(`/ai-bot/${botId}/remove-all`),
  analytics: (botId: string, days = 30) =>
    api.get(`/ai-bot/${botId}/analytics`, { params: { days } }),
};

export const campaignApi = {
  list: (params?: Record<string, string>) => api.get('/campaigns', { params }),
  quota: () => api.get('/campaigns/quota'),
  previewAudience: (data: Record<string, unknown>) => api.post('/campaigns/preview-audience', data),
  get: (id: string) => api.get(`/campaigns/${id}`),
  create: (data: Record<string, unknown>) => api.post('/campaigns', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/campaigns/${id}`, data),
  delete: (id: string) => api.delete(`/campaigns/${id}`),
  send: (id: string) => api.post(`/campaigns/${id}/send`),
  test: (id: string, phone: string) => api.post(`/campaigns/${id}/test`, { phone }),
  pause: (id: string) => api.post(`/campaigns/${id}/pause`),
  resume: (id: string) => api.post(`/campaigns/${id}/resume`),
  cancel: (id: string) => api.post(`/campaigns/${id}/cancel`),
  retryFailed: (id: string) => api.post(`/campaigns/${id}/retry-failed`),
  reschedule: (id: string, data: Record<string, unknown>) => api.post(`/campaigns/${id}/reschedule`, data),
  duplicate: (id: string) => api.post(`/campaigns/${id}/duplicate`),
  stats: (id: string) => api.get(`/campaigns/${id}/stats`),
  analytics: (id: string) => api.get(`/campaigns/${id}/analytics`),
  cohorts: (id: string) => api.get(`/campaigns/${id}/cohorts`),
  cohort: (id: string, kind: string, params?: Record<string, string>) =>
    api.get(`/campaigns/${id}/cohorts/${kind}`, { params }),
  cohortAudience: (id: string, kind: string) => api.get(`/campaigns/${id}/cohorts/${kind}/audience`),
  recipients: (id: string, params?: Record<string, string>) =>
    api.get(`/campaigns/${id}/recipients`, { params }),
  exportUrl: (id: string) => `${api.defaults.baseURL}/campaigns/${id}/export`,
  export: (id: string) =>
    api.get(`/campaigns/${id}/export`, { responseType: 'blob' }),
};

export const contactApi = {
  list: (params?: Record<string, string>) => api.get('/contacts', { params }),
  tags: () => api.get('/contacts/tags'),
  get: (id: string) => api.get(`/contacts/${id}`),
  detail: (id: string) => api.get(`/contacts/${id}/detail`),
  create: (data: Record<string, unknown>) => api.post('/contacts', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/contacts/${id}`, data),
  delete: (id: string) => api.delete(`/contacts/${id}`),
  import: (contacts: Array<{
    phone: string;
    name?: string;
    tags?: string[];
    notes?: string;
    customAttributes?: Record<string, string>;
  }>) =>
    api.post('/contacts/import', { contacts }),
  bulk: (data: {
    ids: string[];
    action: 'delete' | 'addTags' | 'removeTags' | 'setOptedIn';
    tags?: string[];
    optedIn?: boolean;
  }) => api.post('/contacts/bulk', data),
  subscribeUnsubscribed: () =>
    api.post<{ data: { updated: number } }>('/contacts/subscribe-unsubscribed'),
  renameTag: (from: string, to: string) => api.post('/contacts/tags/rename', { from, to }),
  deleteTag: (tag: string) => api.delete(`/contacts/tags/${encodeURIComponent(tag)}`),
  export: (params?: Record<string, string>) =>
    api.get('/contacts/export', { params, responseType: 'blob' }),
  timeline: (id: string) => api.get(`/contacts/${id}/timeline`),
};

export interface TemplateButtonPayload {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE';
  text: string;
  url?: string;
  phone_number?: string;
  example?: string;
}

export const waFormsApi = {
  list: () => api.get('/wa-forms'),
  get: (id: string) => api.get(`/wa-forms/${id}`),
  create: (data: {
    name: string;
    title: string;
    submitLabel?: string;
    fields: Array<{ id: string; label: string; type: string; required?: boolean }>;
  }) => api.post('/wa-forms', data),
  publish: (id: string) => api.post(`/wa-forms/${id}/publish`),
};

export const flowAssetsApi = {
  list: (params?: Record<string, string>) => api.get('/flows-assets', { params }),
  get: (id: string) => api.get(`/flows-assets/${id}`),
  create: (data: Record<string, unknown>) => api.post('/flows-assets', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/flows-assets/${id}`, data),
  delete: (id: string) => api.delete(`/flows-assets/${id}`),
  publish: (id: string) => api.post(`/flows-assets/${id}/publish`),
};

export const templateApi = {
  list: (params?: Record<string, string>) => api.get('/templates', { params }),
  library: (params?: Record<string, string>) => api.get('/templates/library', { params }),
  starters: () => api.get('/templates/starters'),
  get: (name: string) => api.get(`/templates/${name}`),
  usage: (name: string) => api.get(`/templates/${name}/usage`),
  getVariableMeta: (name: string, language?: string) =>
    api.get(`/templates/${encodeURIComponent(name)}/variable-meta`, {
      params: language ? { language } : undefined,
    }),
  saveVariableMeta: (
    name: string,
    data: {
      language?: string;
      meta: Array<{
        scope: 'body' | 'header';
        index: number;
        description: string;
        suggestedSource?: 'contact.name' | 'contact.phone' | 'contact.email' | 'custom' | 'contact.custom';
        customKey?: string;
      }>;
    }
  ) => api.put(`/templates/${encodeURIComponent(name)}/variable-meta`, data),
  create: (data: Record<string, unknown>) => api.post('/templates', data),
  createFromLibrary: (data: {
    name: string;
    language: string;
    libraryTemplateName: string;
    libraryTemplateButtonInputs?: Array<Record<string, unknown>>;
    category?: 'UTILITY' | 'AUTHENTICATION';
  }) => api.post('/templates/from-library', data),
  resubmit: (name: string, data: Record<string, unknown>) =>
    api.post(`/templates/${name}/resubmit`, data),
  testSend: (
    name: string,
    data: {
      phone: string;
      language?: string;
      templateParams?: {
        body?: string[];
        header?: string[];
        headerMediaUrl?: string;
        couponCode?: string;
        buttonUrlSuffixes?: string[];
      };
    }
  ) => api.post(`/templates/${name}/test-send`, data),
  uploadHeader: (data: { data: string; mimeType: string }) =>
    api.post('/templates/upload-header', data),
  delete: (name: string) => api.delete(`/templates/${name}`),
};

export const analyticsApi = {
  overview: (params?: Record<string, string>) =>
    api.get('/analytics/overview', { params }),
  reports: (params?: Record<string, string> | number) => {
    const query = typeof params === 'number' ? { days: String(params) } : params;
    return api.get('/analytics/reports', { params: query });
  },
  team: (params?: Record<string, string>) =>
    api.get('/analytics/team', { params }),
  heatmap: (params?: Record<string, string>) =>
    api.get('/analytics/team/heatmap', { params }),
  campaignsTemplates: (params?: Record<string, string>) =>
    api.get('/analytics/campaigns-templates', { params }),
  aiDeflection: (params?: Record<string, string>) =>
    api.get('/analytics/ai-deflection', { params }),
  metaHealth: (params?: Record<string, string>) =>
    api.get('/analytics/meta-health', { params }),
  leaderboard: (days?: number) =>
    api.get('/analytics/leaderboard', { params: days ? { days: String(days) } : {} }),
  templates: (days?: number) =>
    api.get('/analytics/templates', { params: days ? { days: String(days) } : {} }),
  activity: (limit = 4) =>
    api.get('/analytics/activity', { params: { limit: String(limit) } }),
  exportCsv: (params?: Record<string, string>) =>
    api.get('/analytics/export', { params, responseType: 'blob' }),
};

export const billingApi = {
  get: () => api.get('/billing'),
  usage: () => api.get('/billing/usage'),
  current: () => api.get('/billing/current'),
  updatePlan: (plan: string) => api.patch('/billing/plan', { plan }),
  createOrder: (planId: string, cadence: 'monthly' | 'quarterly' | 'yearly' = 'monthly') =>
    api.post('/billing/create-order', { planId, cadence }),
  verifyPayment: (data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => api.post('/billing/verify', data),
  estimateCost: (recipientCount: number, category?: string) =>
    api.post('/billing/estimate', { recipientCount, category }),
  aiCredits: () => api.get<{ data: import('../types').AiCreditsResponse }>('/billing/ai-credits'),
  purchaseAiAddon: (skuId: string) =>
    api.post('/billing/ai-credits/purchase', { skuId }),
  verifyAiAddon: (data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => api.post('/billing/ai-credits/verify', data),
  subscribeAiRecurringAddon: (skuId: string) =>
    api.post('/billing/ai-credits/recurring/subscribe', { skuId }),
  verifyAiRecurringAddon: (data: {
    razorpay_subscription_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) => api.post('/billing/ai-credits/recurring/verify', data),
  cancelAiRecurringAddon: (skuId: string) =>
    api.post('/billing/ai-credits/recurring/cancel', { skuId }),
  createPaymentLink: (data: {
    amountPaise: number;
    description: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
  }) => api.post('/billing/payment-link', data),
};

export const onboardingApi = {
  status: () => api.get('/onboarding/status'),
  readiness: () => api.get('/onboarding/readiness'),
  completeStep: (stepId: string) => api.post('/onboarding/complete-step', { stepId }),
};

export const complianceApi = {
  exportData: () =>
    api.get('/compliance/export', { responseType: 'blob' }).then((res) => res.data),
  requestDeletion: () => api.post('/compliance/delete-request', { confirm: 'DELETE MY DATA' }),
};

export const integrationsApi = {
  listKeys: () => api.get('/integrations/api-keys'),
  createKey: (name: string) => api.post('/integrations/api-keys', { name }),
  revokeKey: (id: string) => api.delete(`/integrations/api-keys/${id}`),
  listWebhooks: () => api.get('/integrations/webhooks'),
  createWebhook: (data: { url: string; events: string[] }) =>
    api.post('/integrations/webhooks', data),
  updateWebhook: (id: string, data: Partial<{ url: string; events: string[]; enabled: boolean }>) =>
    api.patch(`/integrations/webhooks/${id}`, data),
  deleteWebhook: (id: string) => api.delete(`/integrations/webhooks/${id}`),
  webhookDeliveries: (webhookId: string) => api.get(`/integrations/webhooks/${webhookId}/deliveries`),
  replayDelivery: (deliveryId: string) => api.post(`/integrations/webhooks/deliveries/${deliveryId}/replay`),
  exportGoogleSheets: () => api.get('/integrations/google-sheets/export', { responseType: 'blob' }),
};

export const leadApi = {
  list: (params?: Record<string, string>) => api.get('/leads', { params }),
  create: (data: Record<string, unknown>) => api.post('/leads', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/leads/${id}`, data),
  fromContact: (contactId: string) => api.post(`/leads/from-contact/${contactId}`),
  bulkStage: (ids: string[], stage: string) => api.post('/leads/bulk', { ids, stage }),
};

export const ticketApi = {
  list: (params?: Record<string, string>) => api.get('/tickets', { params }),
  create: (data: Record<string, unknown>) => api.post('/tickets', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/tickets/${id}`, data),
  fromConversation: (conversationId: string, data?: Record<string, unknown>) =>
    api.post(`/tickets/from-conversation/${conversationId}`, data || {}),
};

export const supportApi = {
  status: () => api.get('/support/status'),
  chat: (messages: Array<{ role: 'user' | 'assistant'; content: string }>) =>
    api.post('/support/chat', { messages }, { timeout: 25000 }),
};

export const commerceApi = {
  orders: (params?: Record<string, string>) => api.get('/commerce/orders', { params }),
  order: (id: string) => api.get(`/commerce/orders/${id}`),
  updateStatus: (
    id: string,
    data: { status: string; statusNote?: string; notifyContact?: boolean; body?: string }
  ) => api.patch(`/commerce/orders/${id}/status`, data),
};

export const teamApi = {
  list: (params?: Record<string, string>) => api.get('/team', { params }),
  get: (id: string) => api.get(`/team/${id}`),
  agents: () => api.get('/team/agents'),
  create: (data: Record<string, unknown>) => api.post('/team', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/team/${id}`, data),
  remove: (id: string, data?: { reassignToId?: string }) =>
    api.delete(`/team/${id}`, { data }),
  reassign: (id: string, toAgentId: string | null) =>
    api.post(`/team/${id}/reassign`, { toAgentId }),
  heartbeat: (availability?: AgentAvailability) =>
    api.post('/team/heartbeat', availability ? { availability } : {}),
  setAvailability: (availability: AgentAvailability) =>
    api.patch('/team/me/availability', { availability }),
  settings: {
    get: () => api.get('/team/settings'),
    update: (data: Partial<TeamSettings>) => api.patch('/team/settings', data),
  },
  rolePermissions: {
    get: () => api.get('/team/role-permissions'),
    update: (rolePermissions: Partial<Record<OrgRole, Partial<TeamPermissions>>>) =>
      api.patch('/team/role-permissions', { rolePermissions }),
  },
  invites: {
    list: () => api.get('/team/invites'),
    create: (data: Record<string, unknown>) => api.post('/team/invites', data),
    revoke: (id: string) => api.delete(`/team/invites/${id}`),
    getByToken: (token: string) => api.get(`/team/invites/token/${token}`),
    accept: (data: { token: string; name?: string; password: string }) =>
      api.post('/team/invites/accept', data),
  },
  departments: {
    list: () => api.get('/team/departments'),
    create: (data: { name: string; color?: string }) => api.post('/team/departments', data),
    update: (id: string, data: { name?: string; color?: string }) =>
      api.patch(`/team/departments/${id}`, data),
    remove: (id: string) => api.delete(`/team/departments/${id}`),
  },
  audit: (limit?: number) => api.get('/team/audit', { params: { limit: String(limit ?? 50) } }),
  sessions: {
    list: () => api.get('/team/sessions'),
    revoke: (id: string) => api.delete(`/team/sessions/${id}`),
    revokeAll: () => api.delete('/team/sessions'),
  },
  twoFactor: {
    setup: () => api.post('/team/me/2fa/setup'),
    enable: (code: string) => api.post('/team/me/2fa/enable', { code }),
    disable: (code: string, password: string) =>
      api.post('/team/me/2fa/disable', { code, password }),
  },
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/team/me/password', { currentPassword, newPassword }),
};

export const contentStudioApi = {
  getBrandKit: () => api.get('/content-studio/brand-kit'),
  updateBrandKit: (data: Record<string, unknown>) => api.put('/content-studio/brand-kit', data),
  getCredits: () => api.get('/content-studio/credits'),
  generate: (data: { prompt: string; kind?: string; locale?: string; templateCategory?: string }) =>
    api.post('/content-studio/composer/generate', data),
  runTool: (data: {
    action: string;
    text: string;
    locale?: string;
    kind?: string;
    parentDraftId?: string;
    templateCategory?: string;
  }) => api.post('/content-studio/composer/tools', data),
  listDrafts: (params?: Record<string, string>) =>
    api.get('/content-studio/composer/drafts', { params }),
  getDraft: (id: string) => api.get(`/content-studio/composer/drafts/${id}`),
  updateDraft: (id: string, data: Record<string, unknown>) =>
    api.patch(`/content-studio/composer/drafts/${id}`, data),
  submitDraftToMeta: (id: string, data?: Record<string, unknown>) =>
    api.post(`/content-studio/composer/drafts/${id}/submit-meta`, data || {}),
  refreshDraftMetaStatus: (id: string) =>
    api.get(`/content-studio/composer/drafts/${id}/meta-status`),
  autofixDraft: (id: string, data?: { reason?: string }) =>
    api.post(`/content-studio/composer/drafts/${id}/autofix`, data || {}),
  generateImage: (data: Record<string, unknown>) =>
    api.post('/content-studio/images/generate', data),
  getImageJob: (id: string) => api.get(`/content-studio/images/jobs/${id}`),
  generateVideo: (data: {
    prompt: string;
    aspectRatio?: string;
    durationSeconds?: number;
    provider?: string;
  }) => api.post('/content-studio/videos/generate', data),
  getVideoJob: (id: string) => api.get(`/content-studio/videos/jobs/${id}`),
  listVoices: () => api.get('/content-studio/voices'),
  generateVoice: (data: { script: string; voiceId?: string; language?: string; provider?: string }) =>
    api.post('/content-studio/voices/generate', data),
  getVoiceJob: (id: string) => api.get(`/content-studio/voices/jobs/${id}`),
  listAssets: (params?: Record<string, string>) =>
    api.get('/content-studio/library', { params }),
  updateAsset: (id: string, data: Record<string, unknown>) =>
    api.patch(`/content-studio/library/${id}`, data),
  archiveAsset: (id: string) => api.delete(`/content-studio/library/${id}`),
  getCalendar: (params?: Record<string, string>) =>
    api.get('/content-studio/calendar', { params }),
  getApprovalQueue: () => api.get('/content-studio/approvals'),
  submitApproval: (data: Record<string, unknown>) =>
    api.post('/content-studio/approvals', data),
};

export const catalogApi = {
  listCatalogs: () => api.get('/catalog/catalogs'),
  listProducts: (params?: Record<string, string>) => api.get('/catalog/products', { params }),
  sync: (catalogId: string) => api.post('/catalog/sync', { catalogId }),
};

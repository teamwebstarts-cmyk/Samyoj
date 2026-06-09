import axios from 'axios';
import { getErrorMessage, logError } from '../utils/errors';
import type { AgentAvailability, TeamSettings } from '../types';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
          localStorage.setItem('accessToken', data.data.accessToken);
          original.headers.Authorization = `Bearer ${data.data.accessToken}`;
          return api(original);
        } catch (refreshError) {
          logError(refreshError, {
            source: 'auth',
            action: 'Token refresh failed',
            method: original.method?.toUpperCase(),
            url: original.url,
          });
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }

    logError(error, {
      source: 'api',
      action: 'API request failed',
      method: original?.method?.toUpperCase(),
      url: original?.url,
      status: error.response?.status,
    });

    return Promise.reject(error);
  }
);

export { getErrorMessage };

export default api;

export const authApi = {
  register: (data: { name: string; email: string; password: string; companyName: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string; totpCode?: string }) =>
    api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  logout: (refreshToken: string) => api.post('/auth/logout', { refreshToken }),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) =>
    api.post('/auth/reset-password', { token, password }),
};

export const inboxApi = {
  list: (params?: Record<string, string>) => api.get('/inbox', { params }),
  start: (data: { phone: string; name?: string }) => api.post('/inbox/start', data),
  get: (id: string) => api.get(`/inbox/${id}`),
  messages: (id: string) => api.get(`/inbox/${id}/messages`),
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
  setStatus: (id: string, status: string) => api.patch(`/inbox/${id}/status`, { status }),
  addNote: (id: string, content: string) => api.post(`/inbox/${id}/notes`, { content }),
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
  connectUrl: () => api.get('/whatsapp/connect-url'),
  completeConnect: (code: string) =>
    api.post<{ data: WhatsappConnectResult }>('/whatsapp/connect/callback', { code }),
  selectConnect: (pendingToken: string, phoneNumberId: string, wabaId: string) =>
    api.post<{ data: WhatsappConnectResult }>('/whatsapp/connect/select', {
      pendingToken,
      phoneNumberId,
      wabaId,
    }),
  connect: (data: Record<string, string>) => api.post('/whatsapp/connect', data),
  numbers: () => api.get('/whatsapp/numbers'),
  disconnect: (id: string) => api.delete(`/whatsapp/numbers/${id}`),
  webhookStatus: () => api.get('/whatsapp/webhook-status'),
  setupWebhook: () => api.post('/whatsapp/setup-webhook'),
};

export const automationApi = {
  list: (params?: Record<string, string>) => api.get('/automations', { params }),
  create: (data: Record<string, unknown>) => api.post('/automations', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/automations/${id}`, data),
  delete: (id: string) => api.delete(`/automations/${id}`),
  analytics: (days = 30) => api.get('/automations/analytics', { params: { days: String(days) } }),
  conflicts: () => api.get('/automations/conflicts'),
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
};

export const settingsApi = {
  get: () => api.get('/settings'),
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
    batchSize?: number;
    batchDelayMs?: number;
  }) => api.patch('/settings/campaigns', data),
};

export const callingApi = {
  status: () => api.get('/calling/status'),
  settings: () => api.get('/calling/settings'),
  updateSettings: (data: Record<string, unknown>) => api.patch('/calling/settings', data),
  enable: () => api.post('/calling/enable'),
  disable: () => api.post('/calling/disable'),
  analytics: (days = 30) => api.get('/calling/analytics', { params: { days: String(days) } }),
  list: (params?: Record<string, string>) => api.get('/calling', { params }),
  get: (id: string) => api.get(`/calling/${id}`),
  getSignaling: (id: string) => api.get(`/calling/${id}/signaling`),
  accept: (id: string, sdpAnswer: string) => api.post(`/calling/${id}/accept`, { sdpAnswer }),
  decline: (id: string) => api.post(`/calling/${id}/decline`),
  callback: (data: { contactId?: string; phone?: string; conversationId?: string }) =>
    api.post('/calling/callback', data),
  updateNotes: (id: string, notes: string) => api.patch(`/calling/${id}`, { notes }),
  terminate: (id: string) => api.post(`/calling/${id}/terminate`),
};

export const aiBotApi = {
  status: () => api.get('/ai-bot/status'),
  list: () => api.get('/ai-bot'),
  get: (id: string) => api.get(`/ai-bot/${id}`),
  create: (data: Record<string, unknown>) => api.post('/ai-bot', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/ai-bot/${id}`, data),
  delete: (id: string) => api.delete(`/ai-bot/${id}`),
  addFaq: (botId: string, data: { title: string; content: string }) =>
    api.post(`/ai-bot/${botId}/faq`, data),
  updateFaq: (botId: string, faqId: string, data: { title?: string; content?: string }) =>
    api.patch(`/ai-bot/${botId}/faq/${faqId}`, data),
  deleteFaq: (botId: string, faqId: string) => api.delete(`/ai-bot/${botId}/faq/${faqId}`),
  test: (botId: string, message: string) => api.post(`/ai-bot/${botId}/test`, { message }),
  analytics: (botId: string, days = 30) =>
    api.get(`/ai-bot/${botId}/analytics`, { params: { days: String(days) } }),
  versions: (botId: string) => api.get(`/ai-bot/${botId}/versions`),
  audit: (botId: string) => api.get(`/ai-bot/${botId}/audit`),
  restoreVersion: (botId: string, version: number) =>
    api.post(`/ai-bot/${botId}/restore/${version}`),
  ingestUrl: (botId: string, data: { url: string; title?: string }) =>
    api.post(`/ai-bot/${botId}/ingest/url`, data),
  ingestPdf: (botId: string, data: { filename: string; dataBase64: string }) =>
    api.post(`/ai-bot/${botId}/ingest/pdf`, data),
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
  duplicate: (id: string) => api.post(`/campaigns/${id}/duplicate`),
  stats: (id: string) => api.get(`/campaigns/${id}/stats`),
  analytics: (id: string) => api.get(`/campaigns/${id}/analytics`),
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
  import: (contacts: Array<{ phone: string; name?: string; tags?: string[]; notes?: string }>) =>
    api.post('/contacts/import', { contacts }),
  bulk: (data: {
    ids: string[];
    action: 'delete' | 'addTags' | 'removeTags' | 'setOptedIn';
    tags?: string[];
    optedIn?: boolean;
  }) => api.post('/contacts/bulk', data),
  renameTag: (from: string, to: string) => api.post('/contacts/tags/rename', { from, to }),
  deleteTag: (tag: string) => api.delete(`/contacts/tags/${encodeURIComponent(tag)}`),
  export: (params?: Record<string, string>) =>
    api.get('/contacts/export', { params, responseType: 'blob' }),
};

export interface TemplateButtonPayload {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'COPY_CODE';
  text: string;
  url?: string;
  phone_number?: string;
  example?: string;
}

export const templateApi = {
  list: (params?: Record<string, string>) => api.get('/templates', { params }),
  library: (params?: Record<string, string>) => api.get('/templates/library', { params }),
  get: (name: string) => api.get(`/templates/${name}`),
  usage: (name: string) => api.get(`/templates/${name}/usage`),
  create: (data: Record<string, unknown>) => api.post('/templates', data),
  createFromLibrary: (data: {
    name: string;
    language: string;
    libraryTemplateName: string;
    libraryTemplateButtonInputs?: Array<Record<string, unknown>>;
  }) => api.post('/templates/from-library', data),
  resubmit: (name: string, data: Record<string, unknown>) =>
    api.post(`/templates/${name}/resubmit`, data),
  testSend: (
    name: string,
    data: {
      phone: string;
      language?: string;
      templateParams?: { body?: string[]; header?: string[]; headerMediaUrl?: string };
    }
  ) => api.post(`/templates/${name}/test-send`, data),
  uploadHeader: (data: { data: string; mimeType: string }) =>
    api.post('/templates/upload-header', data),
  delete: (name: string) => api.delete(`/templates/${name}`),
};

export const analyticsApi = {
  overview: () => api.get('/analytics/overview'),
  reports: (days?: number) => api.get('/analytics/reports', { params: days ? { days: String(days) } : {} }),
};

export const billingApi = {
  get: () => api.get('/billing'),
  updatePlan: (plan: string) => api.patch('/billing/plan', { plan }),
  createOrder: (planId: string) => api.post('/billing/create-order', { planId }),
  verifyPayment: (data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    planId: 'growth' | 'business';
  }) => api.post('/billing/verify', data),
};

export const complianceApi = {
  exportData: () =>
    api.get('/compliance/export', { responseType: 'blob' }).then((res) => res.data),
  requestDeletion: () => api.post('/compliance/delete-request', { confirm: 'DELETE MY DATA' }),
  sla: () => api.get('/compliance/sla'),
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
    revokeAll: (exceptCurrent?: string) =>
      api.delete('/team/sessions', { data: { exceptCurrent } }),
  },
  twoFactor: {
    setup: () => api.post('/team/me/2fa/setup'),
    enable: (code: string) => api.post('/team/me/2fa/enable', { code }),
    disable: (code: string, password: string) =>
      api.post('/team/me/2fa/disable', { code, password }),
  },
};

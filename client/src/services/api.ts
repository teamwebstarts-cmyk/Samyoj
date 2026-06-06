import axios from 'axios';
import { getErrorMessage, logError } from '../utils/errors';

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
  login: (data: { email: string; password: string }) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
  logout: (refreshToken: string) => api.post('/auth/logout', { refreshToken }),
};

export const inboxApi = {
  list: (params?: Record<string, string>) => api.get('/inbox', { params }),
  start: (data: { phone: string; name?: string }) => api.post('/inbox/start', data),
  get: (id: string) => api.get(`/inbox/${id}`),
  messages: (id: string) => api.get(`/inbox/${id}/messages`),
  send: (id: string, content: string) => api.post(`/inbox/${id}/messages`, { content }),
  assign: (id: string, agentId: string | null) =>
    api.patch(`/inbox/${id}/assign`, { agentId }),
  setBot: (id: string, data: { active?: boolean; resetHandoff?: boolean }) =>
    api.patch(`/inbox/${id}/bot`, data),
  setStatus: (id: string, status: string) => api.patch(`/inbox/${id}/status`, { status }),
  addNote: (id: string, content: string) => api.post(`/inbox/${id}/notes`, { content }),
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
};

export const callingApi = {
  status: () => api.get('/calling/status'),
  enable: () => api.post('/calling/enable'),
  list: () => api.get('/calling'),
  get: (id: string) => api.get(`/calling/${id}`),
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
};

export const campaignApi = {
  list: (params?: Record<string, string>) => api.get('/campaigns', { params }),
  get: (id: string) => api.get(`/campaigns/${id}`),
  create: (data: Record<string, unknown>) => api.post('/campaigns', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/campaigns/${id}`, data),
  delete: (id: string) => api.delete(`/campaigns/${id}`),
  send: (id: string) => api.post(`/campaigns/${id}/send`),
  stats: (id: string) => api.get(`/campaigns/${id}/stats`),
};

export const contactApi = {
  list: (params?: Record<string, string>) => api.get('/contacts', { params }),
  tags: () => api.get('/contacts/tags'),
  get: (id: string) => api.get(`/contacts/${id}`),
  create: (data: Record<string, unknown>) => api.post('/contacts', data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/contacts/${id}`, data),
  delete: (id: string) => api.delete(`/contacts/${id}`),
  import: (contacts: Array<{ phone: string; name?: string; tags?: string[]; notes?: string }>) =>
    api.post('/contacts/import', { contacts }),
};

export interface TemplateButtonPayload {
  type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER';
  text: string;
  url?: string;
  phone_number?: string;
}

export const templateApi = {
  list: (params?: Record<string, string>) => api.get('/templates', { params }),
  library: (params?: Record<string, string>) => api.get('/templates/library', { params }),
  get: (name: string) => api.get(`/templates/${name}`),
  create: (data: {
    name: string;
    language: string;
    category: string;
    body: string;
    header?: string;
    footer?: string;
    buttons?: TemplateButtonPayload[];
  }) => api.post('/templates', data),
  createFromLibrary: (data: {
    name: string;
    language: string;
    libraryTemplateName: string;
  }) => api.post('/templates/from-library', data),
  delete: (name: string) => api.delete(`/templates/${name}`),
};

export const analyticsApi = {
  overview: () => api.get('/analytics/overview'),
};

export const teamApi = {
  list: (params?: Record<string, string>) => api.get('/team', { params }),
  agents: () => api.get('/team/agents'),
  create: (data: {
    name: string;
    email: string;
    password: string;
    orgRole: 'ADMIN' | 'AGENT';
  }) => api.post('/team', data),
  update: (
    id: string,
    data: { name?: string; orgRole?: 'ADMIN' | 'AGENT'; password?: string }
  ) => api.patch(`/team/${id}`, data),
  remove: (id: string) => api.delete(`/team/${id}`),
};

import { config } from '../../config';
import { decrypt, encrypt } from '../../utils/crypto';

const META_BASE = `https://graph.facebook.com/${config.meta.apiVersion}`;
export const META_WEBHOOK_FIELDS = [
  'messages',
  'calls',
  'account_alerts',
  'business_capability_update',
  'phone_number_quality_update',
  'phone_number_name_update',
  'message_template_status_update',
  'message_template_quality_update',
  'message_template_components_update',
  'template_category_update',
  'user_preferences',
] as const;

export interface InteractiveButton {
  type: 'reply';
  reply: { id: string; title: string };
}

export interface SendMessagePayload {
  to: string;
  type: 'text' | 'template' | 'image' | 'document' | 'video' | 'audio' | 'interactive' | 'location' | 'contacts' | 'reaction';
  context?: { message_id: string };
  reaction?: { message_id: string; emoji: string };
  text?: { body: string };
  template?: {
    name: string;
    language: { code: string };
    components?: unknown[];
  };
  image?: { id?: string; link?: string; caption?: string };
  document?: { id?: string; link?: string; caption?: string; filename?: string };
  video?: { id?: string; link?: string; caption?: string };
  audio?: { id?: string; link?: string; voice?: boolean };
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  contacts?: Array<{
    name: { formatted_name: string; first_name?: string };
    phones?: Array<{ phone: string; type?: string; wa_id?: string }>;
    emails?: Array<{ email: string; type?: string }>;
  }>;
  interactive?: Record<string, unknown>;
}

export interface WhatsappConnectionDetails {
  wabaId: string;
  phoneNumberId: string;
  phoneNumber: string;
  businessId?: string;
  accessToken: string;
}

export interface WhatsappPhoneOption {
  wabaId: string;
  phoneNumberId: string;
  phoneNumber: string;
  verifiedName?: string;
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
  quality_score?: { score?: string; date?: number };
  components?: Array<{
    type: string;
    text?: string;
    format?: string;
    example?: unknown;
    buttons?: TemplateButton[];
  }>;
  rejected_reason?: string;
}

export interface TemplateListResult {
  templates: MessageTemplate[];
  paging?: { cursors?: { before?: string; after?: string }; next?: string };
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
}

function normalizeRejectedReason(reason?: string): string | undefined {
  if (!reason) return undefined;
  const trimmed = reason.trim();
  if (!trimmed) return undefined;
  const lower = trimmed.toLowerCase();
  if (['none', 'n/a', 'na', '-', 'null'].includes(lower)) return undefined;
  return trimmed;
}

function normalizeMessageTemplate(template: MessageTemplate): MessageTemplate {
  return {
    ...template,
    rejected_reason: normalizeRejectedReason(template.rejected_reason),
  };
}

/** Human-readable preview of what the customer receives (header + body + footer). */
export function getTemplateDisplayText(
  template: MessageTemplate | null | undefined,
  fallbackName?: string
): string {
  if (!template?.components?.length) {
    return fallbackName ? `Template: ${fallbackName}` : '';
  }

  const lines: string[] = [];
  for (const component of template.components) {
    const type = component.type?.toUpperCase();
    const text = component.text?.trim();
    if (!text) continue;
    if (type === 'HEADER' || type === 'BODY' || type === 'FOOTER') {
      lines.push(text);
    }
  }

  return lines.join('\n\n') || (fallbackName ? `Template: ${fallbackName}` : '');
}

export interface CreateTemplatePayload {
  name: string;
  language: string;
  category: 'MARKETING' | 'UTILITY' | 'AUTHENTICATION';
  components: Array<Record<string, unknown>>;
  allow_category_change?: boolean;
}

interface GraphError {
  error?: { message?: string; code?: number; error_subcode?: number; fbtrace_id?: string };
}

/** Structured Meta Graph failures — preserve code + fbtrace for Inbox/server logs. */
export class MetaApiError extends Error {
  readonly metaCode?: number;
  readonly metaSubcode?: number;
  readonly fbtraceId?: string;
  readonly status?: number;
  readonly statusCode?: number;

  constructor(
    message: string,
    opts?: {
      metaCode?: number;
      metaSubcode?: number;
      fbtraceId?: string;
      status?: number;
      statusCode?: number;
    }
  ) {
    super(message);
    this.name = 'MetaApiError';
    this.metaCode = opts?.metaCode;
    this.metaSubcode = opts?.metaSubcode;
    this.fbtraceId = opts?.fbtraceId;
    this.status = opts?.status ?? opts?.statusCode;
    this.statusCode = opts?.statusCode ?? opts?.status;
  }
}

export function extractMetaErrorFields(error: unknown): {
  message: string;
  metaCode?: number;
  metaSubcode?: number;
  fbtraceId?: string;
  status?: number;
  statusCode?: number;
} {
  if (error instanceof MetaApiError) {
    return {
      message: error.message,
      metaCode: error.metaCode,
      metaSubcode: error.metaSubcode,
      fbtraceId: error.fbtraceId,
      status: error.status,
      statusCode: error.statusCode,
    };
  }
  const message = error instanceof Error ? error.message : 'Failed to send message';
  const codeMatch = message.match(/\(\#(\d+)\)/);
  return {
    message,
    metaCode: codeMatch ? Number(codeMatch[1]) : undefined,
  };
}

export interface MetaCredentials {
  appId: string;
  appSecret: string;
}

function requireMetaCredentials(credentials?: MetaCredentials): MetaCredentials {
  if (credentials?.appId && credentials?.appSecret) {
    return credentials;
  }
  if (config.meta.appId && config.meta.appSecret) {
    return { appId: config.meta.appId, appSecret: config.meta.appSecret };
  }
  throw new Error('Meta app credentials are not configured');
}

/** Filename extension for Meta multipart upload when the caller omits one. */
function extensionForMime(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif',
    'video/mp4': '.mp4',
    'video/3gpp': '.3gp',
    'audio/ogg': '.ogg',
    'audio/mpeg': '.mp3',
    'audio/aac': '.aac',
    'audio/amr': '.amr',
    'application/pdf': '.pdf',
    'text/plain': '.txt',
  };
  return map[mimeType.split(';')[0].trim().toLowerCase()] || '';
}

export class MetaWhatsAppService {
  static getEmbeddedSignupUrl(
    state: string,
    credentials?: MetaCredentials,
    redirectUri?: string
  ): string {
    const creds = requireMetaCredentials(credentials);
    const params = new URLSearchParams({
      client_id: creds.appId,
      redirect_uri: redirectUri || config.meta.redirectUri,
      state,
      scope: 'whatsapp_business_management,whatsapp_business_messaging',
      response_type: 'code',
    });
    return `https://www.facebook.com/${config.meta.apiVersion}/dialog/oauth?${params}`;
  }

  static async exchangeCodeForToken(
    code: string,
    credentials?: MetaCredentials,
    redirectUri?: string
  ): Promise<string> {
    const creds = requireMetaCredentials(credentials);

    const params = new URLSearchParams({
      client_id: creds.appId,
      client_secret: creds.appSecret,
      // Must be identical to the redirect_uri used when Meta issued this code.
      redirect_uri: redirectUri || config.meta.redirectUri,
      code,
    });

    const res = await fetch(`${META_BASE}/oauth/access_token?${params}`);
    const data = (await res.json()) as { access_token?: string } & GraphError;
    if (!res.ok || !data.access_token) {
      throw new Error(data.error?.message || 'Token exchange failed');
    }
    return data.access_token;
  }

  static async exchangeForLongLivedToken(
    shortLivedToken: string,
    credentials?: MetaCredentials
  ): Promise<string> {
    const creds = requireMetaCredentials(credentials);
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: creds.appId,
      client_secret: creds.appSecret,
      fb_exchange_token: shortLivedToken,
    });

    const res = await fetch(`${META_BASE}/oauth/access_token?${params}`);
    const data = (await res.json()) as { access_token?: string } & GraphError;
    if (!res.ok || !data.access_token) {
      throw new Error(data.error?.message || 'Long-lived token exchange failed');
    }
    return data.access_token;
  }

  static async exchangeCodeForAccessToken(
    code: string,
    credentials?: MetaCredentials,
    redirectUri?: string
  ): Promise<string> {
    const shortLivedToken = await this.exchangeCodeForToken(code, credentials, redirectUri);
    return this.exchangeForLongLivedToken(shortLivedToken, credentials);
  }

  static async completeConnection(code: string): Promise<WhatsappConnectionDetails> {
    const accessToken = await this.exchangeCodeForAccessToken(code);
    const phones = await this.listAvailablePhoneNumbers(accessToken);
    if (phones.length === 0) {
      throw new Error('No phone number found on your WhatsApp Business Account.');
    }
    const selected = phones[0];
    return this.buildConnectionDetails(accessToken, selected.phoneNumberId, selected.wabaId);
  }

  static async fetchConnectionDetails(accessToken: string): Promise<WhatsappConnectionDetails> {
    const phones = await this.listAvailablePhoneNumbers(accessToken);
    if (phones.length === 0) {
      throw new Error('No phone number found on your WhatsApp Business Account.');
    }
    const selected = phones[0];
    return this.buildConnectionDetails(accessToken, selected.phoneNumberId, selected.wabaId);
  }

  static async buildConnectionDetails(
    accessToken: string,
    phoneNumberId: string,
    wabaId: string
  ): Promise<WhatsappConnectionDetails> {
    const phones = await this.listPhoneNumbersForWaba(wabaId, accessToken);
    const phone = phones.find((p) => p.id === phoneNumberId);
    if (!phone) {
      throw new Error('Selected phone number is not available on this WhatsApp Business Account.');
    }

    return {
      wabaId,
      phoneNumberId: phone.id,
      phoneNumber: phone.displayPhoneNumber,
      accessToken,
    };
  }

  /** Reconcile stored WABA/phone IDs with Meta when the access token was re-authorized. */
  static async syncWhatsappConnection(
    stored: { phoneNumber: string; phoneNumberId: string; wabaId: string },
    accessToken: string
  ): Promise<{ wabaId: string; phoneNumberId: string; phoneNumber: string; updated: boolean }> {
    const normalizedStoredPhone = stored.phoneNumber.replace(/\D/g, '');

    try {
      const phones = await this.listPhoneNumbersForWaba(stored.wabaId, accessToken);
      const match = phones.find(
        (p) => p.id === stored.phoneNumberId || p.displayPhoneNumber === normalizedStoredPhone
      );
      if (match) {
        return {
          wabaId: stored.wabaId,
          phoneNumberId: match.id,
          phoneNumber: match.displayPhoneNumber,
          updated:
            match.id !== stored.phoneNumberId || match.displayPhoneNumber !== normalizedStoredPhone,
        };
      }
    } catch {
      // Stored WABA is stale or inaccessible — resolve from token below.
    }

    const available = await this.listAvailablePhoneNumbers(accessToken);
    if (available.length === 0) {
      throw new Error('No phone numbers found on your WhatsApp Business Account.');
    }

    const selected =
      available.find((p) => p.phoneNumberId === stored.phoneNumberId) ||
      available.find((p) => p.phoneNumber === normalizedStoredPhone) ||
      (available.length === 1 ? available[0] : undefined);

    if (!selected) {
      throw new Error(
        'WhatsApp connection is out of sync with Meta. Reconnect WhatsApp in Settings and select your phone number.'
      );
    }

    return {
      wabaId: selected.wabaId,
      phoneNumberId: selected.phoneNumberId,
      phoneNumber: selected.phoneNumber,
      updated:
        selected.wabaId !== stored.wabaId ||
        selected.phoneNumberId !== stored.phoneNumberId ||
        selected.phoneNumber !== normalizedStoredPhone,
    };
  }

  static async listAvailablePhoneNumbers(
    accessToken: string,
    credentials?: MetaCredentials
  ): Promise<WhatsappPhoneOption[]> {
    const wabaIds = await this.listAccessibleWabaIds(accessToken, credentials);
    const options: WhatsappPhoneOption[] = [];
    const seen = new Set<string>();

    for (const wabaId of wabaIds) {
      const phones = await this.listPhoneNumbersForWaba(wabaId, accessToken);
      for (const phone of phones) {
        const key = `${wabaId}:${phone.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        options.push({
          wabaId,
          phoneNumberId: phone.id,
          phoneNumber: phone.displayPhoneNumber,
          verifiedName: phone.verifiedName,
        });
      }
    }

    return options;
  }

  static async graphGetPublic<T>(path: string, accessToken: string): Promise<T> {
    return this.graphGet<T>(path, accessToken);
  }

  private static async graphGet<T>(path: string, accessToken: string): Promise<T> {
    const separator = path.includes('?') ? '&' : '?';
    const res = await fetch(`${META_BASE}${path}${separator}access_token=${accessToken}`);
    const data = (await res.json()) as T & GraphError;
    if (!res.ok) {
      throw new Error((data as GraphError).error?.message || `Graph API request failed: ${path}`);
    }
    return data;
  }

  static async resolveWabaId(accessToken: string): Promise<string> {
    const wabaIds = await this.listAccessibleWabaIds(accessToken);
    return wabaIds[0];
  }

  private static async listAccessibleWabaIds(
    accessToken: string,
    credentials?: MetaCredentials
  ): Promise<string[]> {
    const ids = new Set<string>();
    const creds = requireMetaCredentials(credentials);
    const appToken = `${creds.appId}|${creds.appSecret}`;
    const debugRes = await fetch(
      `${META_BASE}/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appToken)}`
    );
    const debugData = (await debugRes.json()) as {
      data?: {
        granular_scopes?: Array<{ scope: string; target_ids?: string[] }>;
      };
    } & GraphError;

    if (debugRes.ok && debugData.data?.granular_scopes) {
      for (const scope of debugData.data.granular_scopes) {
        if (
          scope.scope === 'whatsapp_business_management' ||
          scope.scope === 'whatsapp_business_messaging'
        ) {
          for (const id of scope.target_ids || []) {
            ids.add(id);
          }
        }
      }
    }

    if (ids.size > 0) {
      return [...ids];
    }

    const businesses = await this.graphGet<{ data?: Array<{ id: string }> }>(
      '/me/businesses?fields=id,name',
      accessToken
    );

    for (const business of businesses.data || []) {
      const wabas = await this.graphGet<{ data?: Array<{ id: string }> }>(
        `/${business.id}/owned_whatsapp_business_accounts?fields=id`,
        accessToken
      );
      for (const waba of wabas.data || []) {
        if (waba.id) ids.add(waba.id);
      }

      const clientWabas = await this.graphGet<{ data?: Array<{ id: string }> }>(
        `/${business.id}/client_whatsapp_business_accounts?fields=id`,
        accessToken
      );
      for (const waba of clientWabas.data || []) {
        if (waba.id) ids.add(waba.id);
      }
    }

    if (ids.size === 0) {
      throw new Error(
        'No WhatsApp Business Account found. Complete Meta Embedded Signup and grant WhatsApp permissions.'
      );
    }

    return [...ids];
  }

  private static async listPhoneNumbersForWaba(
    wabaId: string,
    accessToken: string
  ): Promise<Array<{ id: string; displayPhoneNumber: string; verifiedName?: string }>> {
    const phones = await this.graphGet<{
      data?: Array<{ id: string; display_phone_number?: string; verified_name?: string }>;
    }>(`/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name`, accessToken);

    const result: Array<{ id: string; displayPhoneNumber: string; verifiedName?: string }> = [];

    for (const phone of phones.data || []) {
      if (!phone.id) continue;
      const displayPhoneNumber = (phone.display_phone_number || '').replace(/\D/g, '');
      if (!displayPhoneNumber) continue;
      result.push({
        id: phone.id,
        displayPhoneNumber,
        verifiedName: phone.verified_name,
      });
    }

    return result;
  }

  static async listMessageTemplates(
    wabaId: string,
    accessToken: string,
    options?: { status?: string; limit?: number; after?: string }
  ): Promise<TemplateListResult> {
    const params = new URLSearchParams({
      fields: 'id,name,status,category,language,components,rejected_reason,quality_score',
      limit: String(options?.limit || 100),
    });
    if (options?.status) params.set('status', options.status);
    if (options?.after) params.set('after', options.after);

    const data = await this.graphGet<{
      data?: MessageTemplate[];
      paging?: TemplateListResult['paging'];
    }>(`/${wabaId}/message_templates?${params.toString()}`, accessToken);

    return {
      templates: (data.data || []).map(normalizeMessageTemplate),
      paging: data.paging,
    };
  }

  static async listAllMessageTemplates(
    wabaId: string,
    accessToken: string,
    options?: { status?: string; maxPages?: number }
  ): Promise<MessageTemplate[]> {
    const all: MessageTemplate[] = [];
    let after: string | undefined;
    const maxPages = options?.maxPages ?? 10;

    for (let page = 0; page < maxPages; page++) {
      const result = await this.listMessageTemplates(wabaId, accessToken, {
        status: options?.status,
        limit: 100,
        after,
      });
      all.push(...result.templates);
      after = result.paging?.cursors?.after;
      if (!after || !result.templates.length) break;
    }

    return all;
  }

  static async uploadTemplateMedia(
    accessToken: string,
    buffer: Buffer,
    mimeType: string,
    credentials?: MetaCredentials
  ): Promise<string> {
    const appId = requireMetaCredentials(credentials).appId;

    const sessionParams = new URLSearchParams({
      file_length: String(buffer.length),
      file_type: mimeType,
    });

    const sessionRes = await fetch(`${META_BASE}/${appId}/uploads?${sessionParams}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const sessionData = (await sessionRes.json()) as { id?: string } & GraphError;
    if (!sessionRes.ok || !sessionData.id) {
      throw new Error(sessionData.error?.message || 'Failed to start media upload session');
    }

    const uploadRes = await fetch(`${META_BASE}/${sessionData.id}`, {
      method: 'POST',
      headers: {
        Authorization: `OAuth ${accessToken}`,
        'Content-Type': mimeType,
        'file_offset': '0',
      },
      body: buffer,
    });
    const uploadData = (await uploadRes.json()) as { h?: string } & GraphError;
    if (!uploadRes.ok || !uploadData.h) {
      throw new Error(uploadData.error?.message || 'Failed to upload template media');
    }

    return uploadData.h;
  }

  static async getMessageTemplate(
    wabaId: string,
    accessToken: string,
    templateName: string
  ): Promise<MessageTemplate | null> {
    const params = new URLSearchParams({
      name: templateName,
      fields: 'id,name,status,category,language,components,rejected_reason',
    });

    const data = await this.graphGet<{ data?: MessageTemplate[] }>(
      `/${wabaId}/message_templates?${params.toString()}`,
      accessToken
    );
    const template = data.data?.[0];
    return template ? normalizeMessageTemplate(template) : null;
  }

  static async createMessageTemplate(
    wabaId: string,
    accessToken: string,
    payload: CreateTemplatePayload
  ): Promise<{ id: string; status: string; category: string }> {
    const res = await fetch(`${META_BASE}/${wabaId}/message_templates`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as { id?: string; status?: string; category?: string } & GraphError;
    if (!res.ok) {
      throw new Error(data.error?.message || 'Failed to create message template');
    }
    return { id: data.id!, status: data.status!, category: data.category! };
  }

  static async listMessageTemplateLibrary(
    accessToken: string,
    options?: {
      search?: string;
      language?: string;
      topic?: string;
      usecase?: string;
      industry?: string;
      name?: string;
      limit?: number;
    }
  ): Promise<TemplateLibraryEntry[]> {
    const params = new URLSearchParams({ limit: String(options?.limit || 100) });
    if (options?.search) params.set('search', options.search);
    if (options?.language) params.set('language', options.language);
    if (options?.topic) params.set('topic', options.topic);
    if (options?.usecase) params.set('usecase', options.usecase);
    if (options?.industry) params.set('industry', options.industry);
    if (options?.name) params.set('name', options.name);

    const data = await this.graphGet<{ data?: TemplateLibraryEntry[] }>(
      `/message_template_library?${params.toString()}`,
      accessToken
    );
    return data.data || [];
  }

  static async createMessageTemplateFromLibrary(
    wabaId: string,
    accessToken: string,
    payload: {
      name: string;
      language: string;
      libraryTemplateName: string;
      libraryTemplateButtonInputs?: Array<Record<string, unknown>>;
      allow_category_change?: boolean;
    }
  ): Promise<{ id: string; status: string; category: string }> {
    const body: Record<string, unknown> = {
      name: payload.name,
      category: 'UTILITY',
      language: payload.language,
      library_template_name: payload.libraryTemplateName,
    };

    if (payload.libraryTemplateButtonInputs?.length) {
      body.library_template_button_inputs = payload.libraryTemplateButtonInputs;
    }
    if (payload.allow_category_change) {
      body.allow_category_change = true;
    }

    const res = await fetch(`${META_BASE}/${wabaId}/message_templates`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as { id?: string; status?: string; category?: string } & GraphError;
    if (!res.ok) {
      throw new Error(data.error?.message || 'Failed to create template from library');
    }
    return { id: data.id!, status: data.status!, category: data.category! };
  }

  static async deleteMessageTemplate(
    wabaId: string,
    accessToken: string,
    templateName: string
  ): Promise<void> {
    const params = new URLSearchParams({ name: templateName });
    const res = await fetch(`${META_BASE}/${wabaId}/message_templates?${params.toString()}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = (await res.json()) as { success?: boolean } & GraphError;
    if (!res.ok) {
      throw new Error(data.error?.message || 'Failed to delete message template');
    }
  }

  static async sendMessage(
    phoneNumberId: string,
    accessToken: string,
    payload: SendMessagePayload
  ): Promise<{ messages: { id: string }[] }> {
    const res = await fetch(`${META_BASE}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: payload.to,
        type: payload.type,
        ...(payload.context && { context: payload.context }),
        ...(payload.reaction && { reaction: payload.reaction }),
        ...(payload.text && { text: payload.text }),
        ...(payload.template && { template: payload.template }),
        ...(payload.image && { image: payload.image }),
        ...(payload.document && { document: payload.document }),
        ...(payload.video && { video: payload.video }),
        ...(payload.audio && { audio: payload.audio }),
        ...(payload.location && { location: payload.location }),
        ...(payload.contacts && { contacts: payload.contacts }),
        ...(payload.interactive && { interactive: payload.interactive }),
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      let message = `Send message failed: ${errBody}`;
      let metaCode: number | undefined;
      let metaSubcode: number | undefined;
      let fbtraceId: string | undefined;
      try {
        const parsed = JSON.parse(errBody) as GraphError;
        if (parsed.error?.message) {
          message = parsed.error.message;
          if (parsed.error.message.includes('necessary permissions')) {
            message +=
              ' Link your WhatsApp account in Settings (reconnect) so this app can send messages on your behalf.';
          }
        }
        metaCode = parsed.error?.code;
        metaSubcode = parsed.error?.error_subcode;
        fbtraceId = parsed.error?.fbtrace_id;
      } catch {
        /* use raw body */
      }
      throw new MetaApiError(message, {
        metaCode,
        metaSubcode,
        fbtraceId,
        status: res.status,
        statusCode: res.status,
      });
    }
    return res.json() as Promise<{ messages: { id: string }[] }>;
  }

  static async getMediaMetadata(
    mediaId: string,
    accessToken: string
  ): Promise<{ url: string; mime_type?: string; file_size?: number }> {
    return this.graphGet(`/${mediaId}`, accessToken);
  }

  /**
   * Upload media to Meta Cloud API (POST /PHONE_NUMBER_ID/media).
   * Meta recommends sending messages with the returned `id` instead of a public `link`
   * for better delivery performance and reliability.
   * @see https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media/
   */
  static async uploadMedia(options: {
    phoneNumberId: string;
    accessToken: string;
    buffer: Buffer;
    mimeType: string;
    filename?: string;
  }): Promise<string> {
    const mime = options.mimeType.split(';')[0].trim() || 'application/octet-stream';
    const filename = options.filename?.trim() || `file${extensionForMime(mime)}`;
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    form.append('type', mime);
    form.append('file', new Blob([new Uint8Array(options.buffer)], { type: mime }), filename);

    const res = await fetch(`${META_BASE}/${options.phoneNumberId}/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${options.accessToken}` },
      body: form,
    });

    const body = (await res.json()) as { id?: string } & GraphError;
    if (!res.ok || !body.id) {
      throw new MetaApiError(body.error?.message || 'Failed to upload media to Meta', {
        metaCode: body.error?.code,
        metaSubcode: body.error?.error_subcode,
        fbtraceId: body.error?.fbtrace_id,
        status: res.status,
        statusCode: res.status,
      });
    }
    return body.id;
  }

  static async downloadMedia(mediaId: string, accessToken: string): Promise<Buffer> {
    const meta = await this.getMediaMetadata(mediaId, accessToken);
    const res = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      throw new Error('Failed to download media from Meta');
    }
    return Buffer.from(await res.arrayBuffer());
  }

  static async sendTypingIndicator(
    phoneNumberId: string,
    accessToken: string,
    to: string
  ): Promise<void> {
    const phone = to.replace(/\D/g, '');
    try {
      await fetch(`${META_BASE}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: phone,
          typing_indicator: { type: 'text' },
        }),
      });
    } catch {
      /* typing indicator is best-effort */
    }
  }

  static async markAsRead(phoneNumberId: string, accessToken: string, messageId: string) {
    await fetch(`${META_BASE}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId,
      }),
    });
  }

  static encryptToken(token: string): string {
    return encrypt(token);
  }

  static decryptToken(encrypted: string): string {
    return decrypt(encrypted);
  }

  static verifyWebhookSignature(signature: string, body: string, appSecret?: string): boolean {
    const crypto = require('crypto');
    const secret = appSecret || config.meta.appSecret;
    if (!secret) return false;
    const expected = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    const expectedSig = `sha256=${expected}`;

    try {
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSig)
      );
    } catch {
      return false;
    }
  }

  private static getAppAccessToken(credentials?: MetaCredentials): string {
    const creds = requireMetaCredentials(credentials);
    return `${creds.appId}|${creds.appSecret}`;
  }

  static async registerAppWebhook(callbackUrl: string, credentials?: MetaCredentials): Promise<void> {
    const creds = requireMetaCredentials(credentials);
    const params = new URLSearchParams({
      object: 'whatsapp_business_account',
      callback_url: callbackUrl,
      verify_token: config.meta.verifyToken,
      fields: META_WEBHOOK_FIELDS.join(','),
    });
    params.set('access_token', this.getAppAccessToken(credentials));

    const res = await fetch(`${META_BASE}/${creds.appId}/subscriptions`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const data = (await res.json()) as { success?: boolean } & GraphError;
    if (!res.ok && !data.success) {
      throw new Error(data.error?.message || 'Failed to register app webhook');
    }
  }

  private static async postSubscribeWaba(wabaId: string, token: string): Promise<void> {
    const res = await fetch(`${META_BASE}/${wabaId}/subscribed_apps`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = (await res.json()) as { success?: boolean } & GraphError;
    if (res.ok || data.success) return;

    const message = data.error?.message || '';
    if (message.toLowerCase().includes('already') || message.toLowerCase().includes('subscribed')) {
      return;
    }

    const error = new Error(message || 'Failed to subscribe WABA to app') as Error & {
      statusCode?: number;
      metaCode?: number;
      metaSubcode?: number;
      fbtraceId?: string;
    };
    error.statusCode = res.status;
    if (data.error?.code !== undefined) error.metaCode = data.error.code;
    if (data.error?.error_subcode !== undefined) error.metaSubcode = data.error.error_subcode;
    if (data.error?.fbtrace_id) error.fbtraceId = data.error.fbtrace_id;
    throw error;
  }

  /** Links the WABA to this Meta app so Cloud API can send messages (required even without webhooks). */
  static async ensureWabaSubscribed(
    wabaId: string,
    accessToken: string,
    credentials?: MetaCredentials
  ): Promise<void> {
    try {
      await this.postSubscribeWaba(wabaId, accessToken);
      return;
    } catch (userErr) {
      const userMessage = userErr instanceof Error ? userErr.message : String(userErr);
      try {
        await this.postSubscribeWaba(wabaId, this.getAppAccessToken(credentials));
        return;
      } catch (appErr) {
        const status = (userErr as { statusCode?: number }).statusCode;
        if (
          status === 429 ||
          (typeof status === 'number' && status >= 500) ||
          /fetch failed|network|timeout|socket|econnreset|enotfound/i.test(userMessage)
        ) {
          throw userErr;
        }
        throw new Error(
          `Could not link WhatsApp Business Account to this app: ${userMessage}. ` +
            'Disconnect and reconnect WhatsApp in Settings, and ensure your Meta user is an admin on the WABA.',
          { cause: appErr }
        );
      }
    }
  }

  static async subscribeWabaToApp(
    wabaId: string,
    accessToken: string,
    credentials?: MetaCredentials
  ): Promise<void> {
    await this.ensureWabaSubscribed(wabaId, accessToken, credentials);
  }

  static async configureWebhooks(
    wabaId: string,
    accessToken: string,
    credentials?: MetaCredentials
  ): Promise<{ callbackUrl: string }> {
    const callbackUrl = config.meta.webhookUrl;
    if (!callbackUrl) {
      throw new Error(
        'META_WEBHOOK_URL is not set. Use an HTTPS tunnel URL ending with /api/whatsapp/webhook'
      );
    }

    await this.ensureWabaSubscribed(wabaId, accessToken, credentials);
    await this.registerAppWebhook(callbackUrl, credentials);
    return { callbackUrl };
  }

  /** Subscribe app webhook once; link every active WABA, skipping invalid ones. */
  static async configureWebhooksForNumbers(
    numbers: Array<{ phoneNumber: string; wabaId: string; accessToken: string }>,
    credentials?: MetaCredentials
  ): Promise<{ callbackUrl: string; subscribedWabas: number; failures: Array<{ phoneNumber: string; wabaId: string; error: string }> }> {
    const callbackUrl = config.meta.webhookUrl;
    if (!callbackUrl) {
      throw new Error(
        'META_WEBHOOK_URL is not set. Use an HTTPS tunnel URL ending with /api/whatsapp/webhook'
      );
    }

    let subscribedWabas = 0;
    const failures: Array<{ phoneNumber: string; wabaId: string; error: string }> = [];

    for (const number of numbers) {
      try {
        await this.ensureWabaSubscribed(number.wabaId, number.accessToken, credentials);
        subscribedWabas++;
      } catch (err) {
        failures.push({
          phoneNumber: number.phoneNumber,
          wabaId: number.wabaId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (subscribedWabas === 0) {
      throw new Error(
        'Could not link any WhatsApp Business Account to this app. ' +
          'Disconnect and reconnect WhatsApp in Settings, and ensure your Meta user is an admin on the WABA.'
      );
    }

    await this.registerAppWebhook(callbackUrl, credentials);
    return { callbackUrl, subscribedWabas, failures };
  }

  static async getWebhookStatus(
    wabaId: string,
    accessToken: string,
    credentials?: MetaCredentials
  ): Promise<{ subscribed: boolean; apps: string[] }> {
    const creds = requireMetaCredentials(credentials);
    const data = await this.graphGet<{ data?: Array<{ whatsapp_business_api_data?: { id?: string } }> }>(
      `/${wabaId}/subscribed_apps`,
      accessToken
    );
    const apps = (data.data || [])
      .map((app) => app.whatsapp_business_api_data?.id)
      .filter(Boolean) as string[];
    return { subscribed: apps.includes(creds.appId), apps };
  }

  static async listWhatsAppFlows(
    wabaId: string,
    accessToken: string
  ): Promise<
    Array<{
      id: string;
      name: string;
      status: string;
      categories: string[];
      validationErrors: string[];
    }>
  > {
    const data = await this.graphGet<{
      data?: Array<{
        id: string;
        name: string;
        status: string;
        categories?: string[];
        validation_errors?: Array<{ message?: string }>;
      }>;
    }>(`/${wabaId}/flows?fields=id,name,status,categories,validation_errors`, accessToken);

    return (data.data || []).map((flow) => ({
      id: flow.id,
      name: flow.name,
      status: flow.status,
      categories: flow.categories || [],
      validationErrors: (flow.validation_errors || [])
        .map((e) => e.message)
        .filter(Boolean) as string[],
    }));
  }

  static async getWhatsAppFlow(
    flowId: string,
    accessToken: string
  ): Promise<{
    id: string;
    name: string;
    status: string;
    categories: string[];
    validationErrors: string[];
  }> {
    const flow = await this.graphGet<{
      id: string;
      name: string;
      status: string;
      categories?: string[];
      validation_errors?: Array<{ message?: string }>;
    }>(`/${flowId}?fields=id,name,status,categories,validation_errors`, accessToken);

    return {
      id: flow.id,
      name: flow.name,
      status: flow.status,
      categories: flow.categories || [],
      validationErrors: (flow.validation_errors || [])
        .map((e) => e.message)
        .filter(Boolean) as string[],
    };
  }

  static async createWhatsAppFlow(
    wabaId: string,
    accessToken: string,
    payload: { name: string; categories: string[]; flowJson: string }
  ): Promise<{ id: string; status: string }> {
    const res = await fetch(`${META_BASE}/${wabaId}/flows`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: payload.name,
        categories: payload.categories,
        flow_json: payload.flowJson,
      }),
    });

    const data = (await res.json()) as { id?: string; status?: string } & GraphError;
    if (!res.ok || !data.id) {
      throw new Error(data.error?.message || 'Failed to create WhatsApp form');
    }
    return { id: data.id, status: data.status || 'DRAFT' };
  }

  static async publishWhatsAppFlow(flowId: string, accessToken: string): Promise<void> {
    const res = await fetch(`${META_BASE}/${flowId}/publish`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    const data = (await res.json()) as GraphError;
    if (!res.ok) {
      throw new Error(data.error?.message || 'Failed to publish WhatsApp form');
    }
  }

  static async updateWhatsAppFlowJson(
    flowId: string,
    accessToken: string,
    flowJson: string
  ): Promise<void> {
    const res = await fetch(`${META_BASE}/${flowId}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ flow_json: flowJson }),
    });

    const data = (await res.json()) as GraphError;
    if (!res.ok) {
      throw new Error(data.error?.message || 'Failed to update WhatsApp flow');
    }
  }

  static async registerFlowPublicKey(
    wabaId: string,
    accessToken: string,
    publicKeyPem: string
  ): Promise<void> {
    const res = await fetch(`${META_BASE}/${wabaId}/flows/public_key`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        business_public_key: publicKeyPem,
      }),
    });

    const data = (await res.json()) as GraphError;
    if (!res.ok) {
      throw new Error(data.error?.message || 'Failed to register flow public key');
    }
  }

  static async getConversationAnalytics(
    wabaId: string,
    accessToken: string,
    start: number,
    end: number
  ): Promise<
    Array<{
      conversation_category?: string;
      conversation?: number;
      cost?: number;
    }>
  > {
    const params = new URLSearchParams({
      start: String(start),
      end: String(end),
      granularity: 'DAILY',
    });

    const data = await this.graphGet<{
      conversation_analytics?: {
        data?: Array<{
          data_points?: Array<{
            conversation_category?: string;
            conversation?: number;
            cost?: number;
          }>;
        }>;
      };
    }>(`/${wabaId}?fields=conversation_analytics.data(${params})`, accessToken);

    const points: Array<{
      conversation_category?: string;
      conversation?: number;
      cost?: number;
    }> = [];

    for (const series of data.conversation_analytics?.data || []) {
      for (const point of series.data_points || []) {
        points.push(point);
      }
    }
    return points;
  }

  static async getPhoneNumberQuality(
    phoneNumberId: string,
    accessToken: string
  ): Promise<string | null> {
    const data = await this.graphGet<{
      quality_rating?: string;
      quality_score?: { score?: string };
    }>(`/${phoneNumberId}?fields=quality_rating,quality_score`, accessToken);

    return data.quality_rating || data.quality_score?.score || null;
  }
}

export function isWithin24HourWindow(windowOpensAt: Date | null | undefined): boolean {
  if (!windowOpensAt) return false;
  const hoursSince = (Date.now() - windowOpensAt.getTime()) / (1000 * 60 * 60);
  return hoursSince < 24;
}

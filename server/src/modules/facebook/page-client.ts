import { config } from '../../config';
import { createModuleLogger } from '../../utils/logger';

const log = createModuleLogger('facebook-page-client');

function graphBase(): string {
  const version = (config.meta.apiVersion || 'v21.0').replace(/^\//, '');
  return `https://graph.facebook.com/${version}`;
}

type GraphError = {
  error?: { message?: string; code?: number; error_subcode?: number; fbtrace_id?: string };
};

export type FacebookPageSummary = {
  id: string;
  name: string;
  accessToken: string;
};

export type LeadgenField = { name: string; values: string[] };

export type GraphLeadPayload = {
  id: string;
  created_time?: string;
  field_data?: LeadgenField[];
};

async function graphGet<T>(path: string, accessToken: string): Promise<T> {
  // Bearer header — never put Page tokens on the query string (proxy/access logs).
  const url = `${graphBase()}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json()) as T & GraphError;
  if (!res.ok) {
    throw new Error(data.error?.message || `Graph GET ${path} failed (${res.status})`);
  }
  return data;
}

async function graphPost(
  path: string,
  accessToken: string,
  body: Record<string, string>
): Promise<Record<string, unknown>> {
  const params = new URLSearchParams(body);
  const res = await fetch(`${graphBase()}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Bearer ${accessToken}`,
    },
    body: params.toString(),
  });
  const data = (await res.json()) as Record<string, unknown> & GraphError;
  if (!res.ok) {
    const err = new Error(data.error?.message || `Graph POST ${path} failed (${res.status})`) as Error & {
      metaCode?: number;
      fbtraceId?: string;
    };
    err.metaCode = data.error?.code;
    err.fbtraceId = data.error?.fbtrace_id;
    throw err;
  }
  return data;
}

/** List Pages the user can manage (Page access tokens). */
export async function listManagedPages(userAccessToken: string): Promise<FacebookPageSummary[]> {
  const data = await graphGet<{ data?: Array<{ id: string; name: string; access_token: string }> }>(
    '/me/accounts?fields=id,name,access_token',
    userAccessToken
  );
  return (data.data || [])
    .filter((p) => p.id && p.access_token)
    .map((p) => ({ id: p.id, name: p.name || p.id, accessToken: p.access_token }));
}

/** Subscribe the Page app install to leadgen + messages webhooks. */
export async function subscribePageToLeadgen(pageId: string, pageAccessToken: string): Promise<void> {
  try {
    await graphPost(`/${pageId}/subscribed_apps`, pageAccessToken, {
      // Keep leadgen; Phase 3 adds messages. Do not drop Instant Forms.
      subscribed_fields: 'leadgen,messages',
    });
  } catch (err) {
    log.warn('Page webhook subscribe failed', {
      pageId,
      error: err instanceof Error ? err.message : String(err),
      metaCode: err && typeof err === 'object' && 'metaCode' in err ? (err as { metaCode?: number }).metaCode : undefined,
    });
    throw err;
  }
}

export async function fetchLeadgenLead(
  leadgenId: string,
  pageAccessToken: string
): Promise<GraphLeadPayload> {
  return graphGet<GraphLeadPayload>(
    `/${leadgenId}?fields=id,created_time,field_data`,
    pageAccessToken
  );
}

/** Send a text reply on Messenger (Page messages API). Bearer only — not WhatsApp send. */
export async function sendPageTextMessage(opts: {
  pageId: string;
  pageAccessToken: string;
  recipientPsid: string;
  text: string;
}): Promise<{ messageId?: string }> {
  const data = await graphPost(`/${opts.pageId}/messages`, opts.pageAccessToken, {
    recipient: JSON.stringify({ id: opts.recipientPsid }),
    messaging_type: 'RESPONSE',
    message: JSON.stringify({ text: opts.text }),
  });
  const messageId =
    typeof data.message_id === 'string'
      ? data.message_id
      : typeof (data as { messageId?: unknown }).messageId === 'string'
        ? (data as { messageId: string }).messageId
        : undefined;
  return { messageId };
}

export function mapLeadgenFields(fieldData: LeadgenField[] | undefined): {
  name: string | null;
  phone: string | null;
  email: string | null;
} {
  const byName = new Map<string, string>();
  for (const field of fieldData || []) {
    const key = (field.name || '').toLowerCase().trim();
    const value = (field.values?.[0] || '').trim();
    if (key && value) byName.set(key, value);
  }

  const first = byName.get('first_name') || '';
  const last = byName.get('last_name') || '';
  const full =
    byName.get('full_name') ||
    byName.get('full name') ||
    [first, last].filter(Boolean).join(' ').trim() ||
    null;

  const phone =
    byName.get('phone_number') ||
    byName.get('phone') ||
    byName.get('mobile_number') ||
    byName.get('mobile') ||
    null;

  const email = byName.get('email') || byName.get('email_address') || null;

  return { name: full, phone, email };
}

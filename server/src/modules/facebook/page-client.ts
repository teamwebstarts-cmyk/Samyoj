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
  form_id?: string;
  ad_id?: string;
  adset_id?: string;
  campaign_id?: string;
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
    const err = new Error(data.error?.message || `Graph GET ${path} failed (${res.status})`) as Error & {
      metaCode?: number;
    };
    err.metaCode = data.error?.code;
    throw err;
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

type GraphAccount = { id?: string; name?: string; access_token?: string };
type GraphMe = { id?: string; name?: string; metadata?: { type?: string } };

/** Map /me/accounts (user token) or /me-as-Page (Page token). Never logs tokens. */
export function mapManagedPages(
  accounts: GraphAccount[],
  me: GraphMe | undefined,
  userAccessToken: string
): FacebookPageSummary[] {
  const fromAccounts = accounts
    .filter((p): p is GraphAccount & { id: string; access_token: string } =>
      Boolean(p.id && p.access_token)
    )
    .map((p) => ({ id: p.id, name: p.name || p.id, accessToken: p.access_token }));
  if (fromAccounts.length > 0) return fromAccounts;
  // Facebook Login for Business can return a Page token: /me/accounts is empty, /me is the Page.
  if (me?.id && me.metadata?.type === 'page') {
    return [{ id: me.id, name: me.name || me.id, accessToken: userAccessToken }];
  }
  return [];
}

async function fillPageTokens(rows: GraphAccount[], userAccessToken: string): Promise<GraphAccount[]> {
  const filled: GraphAccount[] = [];
  for (const row of rows) {
    if (!row.id) continue;
    if (row.access_token) {
      filled.push(row);
      continue;
    }
    try {
      const page = await graphGet<{ id?: string; name?: string; access_token?: string }>(
        `/${row.id}?fields=id,name,access_token`,
        userAccessToken
      );
      filled.push({
        id: page.id || row.id,
        name: page.name || row.name,
        access_token: page.access_token,
      });
    } catch (err) {
      log.warn('Page token fetch failed', {
        pageId: row.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return filled;
}

/** Pages that live on a Business Manager and never appear on /me/accounts. */
async function listPagesFromBusinesses(userAccessToken: string): Promise<FacebookPageSummary[]> {
  let businesses: Array<{ id: string }> = [];
  try {
    const res = await graphGet<{ data?: Array<{ id?: string }> }>(
      '/me/businesses?fields=id,name&limit=50',
      userAccessToken
    );
    businesses = (res.data || []).filter((b): b is { id: string } => Boolean(b.id));
  } catch (err) {
    log.warn('Facebook /me/businesses failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }

  const byId = new Map<string, FacebookPageSummary>();
  for (const biz of businesses) {
    for (const edge of ['owned_pages', 'client_pages'] as const) {
      try {
        const pages = await graphGet<{ data?: GraphAccount[] }>(
          `/${biz.id}/${edge}?fields=id,name,access_token&limit=100`,
          userAccessToken
        );
        const filled = await fillPageTokens(pages.data || [], userAccessToken);
        for (const p of mapManagedPages(filled, undefined, userAccessToken)) {
          byId.set(p.id, p);
        }
      } catch (err) {
        log.warn('Business Page list failed', {
          edge,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
  log.info('Facebook businesses scanned for Pages', {
    businessCount: businesses.length,
    pageCount: byId.size,
  });
  return [...byId.values()];
}

/** List Pages the user can manage (Page access tokens). */
export async function listManagedPages(userAccessToken: string): Promise<FacebookPageSummary[]> {
  let me: GraphMe = {};
  try {
    // metadata=1: User has no `category` field — requesting it 500s (#100).
    me = await graphGet<GraphMe>('/me?fields=id,name&metadata=1', userAccessToken);
  } catch (err) {
    log.warn('Facebook /me failed', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  let rows: GraphAccount[] = [];
  try {
    const accounts = await graphGet<{ data?: GraphAccount[] }>(
      '/me/accounts?fields=id,name,access_token&limit=100',
      userAccessToken
    );
    rows = accounts.data || [];
  } catch (err) {
    log.warn('Facebook /me/accounts failed; will try /me as Page', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  let mapped = mapManagedPages(await fillPageTokens(rows, userAccessToken), me, userAccessToken);
  if (mapped.length === 0) {
    mapped = await listPagesFromBusinesses(userAccessToken);
  }
  if (mapped.length === 0) {
    let granted: string[] = [];
    try {
      const perms = await graphGet<{ data?: Array<{ permission?: string; status?: string }> }>(
        '/me/permissions',
        userAccessToken
      );
      granted = (perms.data || [])
        .filter((p) => p.status === 'granted' && p.permission)
        .map((p) => p.permission as string);
    } catch {
      /* ignore */
    }
    log.warn('Facebook connect: no Pages on this token', {
      meIdPresent: Boolean(me.id),
      meIsPage: me.metadata?.type === 'page',
      accountRows: rows.length,
      granted,
    });
  }
  return mapped;
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
    `/${leadgenId}?fields=id,created_time,form_id,ad_id,adset_id,campaign_id,field_data`,
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

export async function fetchPageInstagramAccount(
  pageId: string,
  pageAccessToken: string
): Promise<{ id: string; username: string | null } | null> {
  const data = await graphGet<{
    instagram_business_account?: { id?: string; username?: string };
  }>(`/${pageId}?fields=instagram_business_account{id,username}`, pageAccessToken);
  const ig = data.instagram_business_account;
  if (!ig?.id) return null;
  return { id: ig.id, username: ig.username || null };
}

/** Page-linked IG DM. Same /{PAGE_ID}/messages path; recipient is IGSID. No Messenger messaging_type. */
export async function sendInstagramTextMessage(opts: {
  pageId: string;
  pageAccessToken: string;
  recipientIgsid: string;
  text: string;
}): Promise<{ messageId?: string }> {
  const data = await graphPost(`/${opts.pageId}/messages`, opts.pageAccessToken, {
    recipient: JSON.stringify({ id: opts.recipientIgsid }),
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

/** One private reply to a comment — POST /{PAGE_ID}/messages with comment_id. */
export async function sendInstagramPrivateReply(opts: {
  pageId: string;
  pageAccessToken: string;
  commentId: string;
  text: string;
}): Promise<{ messageId?: string; recipientId?: string }> {
  const data = await graphPost(`/${opts.pageId}/messages`, opts.pageAccessToken, {
    recipient: JSON.stringify({ comment_id: opts.commentId }),
    message: JSON.stringify({ text: opts.text }),
  });
  const messageId =
    typeof data.message_id === 'string'
      ? data.message_id
      : typeof (data as { messageId?: unknown }).messageId === 'string'
        ? (data as { messageId: string }).messageId
        : undefined;
  const recipientId = typeof data.recipient_id === 'string' ? data.recipient_id : undefined;
  return { messageId, recipientId };
}

export type GraphAdAccount = {
  id: string;
  name: string | null;
  currency: string | null;
  accountStatus: number | null;
};

function mapAdAccount(row: Record<string, unknown>): GraphAdAccount | null {
  const id = typeof row.id === 'string' ? row.id : '';
  if (!id) return null;
  return {
    id,
    name: typeof row.name === 'string' ? row.name : null,
    currency: typeof row.currency === 'string' ? row.currency : null,
    accountStatus: typeof row.account_status === 'number' ? row.account_status : null,
  };
}

/** Page token first, then /me/adaccounts. Read-only. First non-empty list wins. */
export async function listAdAccountsForPage(
  pageId: string,
  pageAccessToken: string
): Promise<GraphAdAccount[]> {
  const paths = [
    `/${pageId}/assigned_ad_accounts?fields=id,name,currency,account_status&limit=10`,
    `/me/adaccounts?fields=id,name,currency,account_status&limit=10`,
  ];
  let successEmpty = false;
  let permissionErr: unknown;
  for (const path of paths) {
    try {
      const data = await graphGet<{ data?: Array<Record<string, unknown>> }>(path, pageAccessToken);
      const rows = (data.data || [])
        .map((row) => mapAdAccount(row))
        .filter((row): row is GraphAdAccount => Boolean(row));
      if (rows.length) return rows;
      successEmpty = true;
    } catch (err) {
      const code = (err as { metaCode?: number }).metaCode;
      if (code === 100) continue;
      if (code === 10 || code === 200 || code === 190) {
        permissionErr = err;
        continue;
      }
      const message = err instanceof Error ? err.message : '';
      if (/permission|ads_read/i.test(message)) {
        permissionErr = err;
        continue;
      }
      throw err;
    }
  }
  if (!successEmpty && permissionErr) throw permissionErr;
  return [];
}

/** Account-level Insights. Attribution is 7-day click / 1-day view. Period is last 7 days. */
export async function fetchAdAccountInsights(
  adAccountId: string,
  pageAccessToken: string
): Promise<{ data?: unknown }> {
  const id = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
  const windows = encodeURIComponent('["7d_click","1d_view"]');
  return graphGet<{ data?: unknown }>(
    `/${id}/insights?fields=spend,impressions,clicks,actions,date_start,date_stop&date_preset=last_7d&level=account&action_attribution_windows=${windows}`,
    pageAccessToken
  );
}

export async function hideInstagramComment(opts: {
  commentId: string;
  pageAccessToken: string;
  hide: boolean;
}): Promise<void> {
  await graphPost(`/${opts.commentId}`, opts.pageAccessToken, {
    hide: opts.hide ? 'true' : 'false',
  });
}

export async function subscribeInstagramAccount(
  igUserId: string,
  pageAccessToken: string
): Promise<void> {
  try {
    await graphPost(`/${igUserId}/subscribed_apps`, pageAccessToken, {
      subscribed_fields: 'messages,comments,live_comments',
    });
  } catch (err) {
    log.warn('IG webhook subscribe failed', {
      igUserId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
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

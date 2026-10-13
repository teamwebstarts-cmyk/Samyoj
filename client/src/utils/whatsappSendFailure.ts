/**
 * User-facing copy for Meta Cloud API send / delivery failures.
 * Keep in sync with server/src/modules/whatsapp/send-failure-explain.ts
 */

export type WhatsAppSendFailureAction =
  | 'retry'
  | 'connect'
  | 'meta_account'
  | 'template'
  | 'window'
  | 'payment';

export interface WhatsAppSendFailureExplanation {
  code?: number;
  title: string;
  body: string;
  notice: string;
  /** Short numbered fixes shown in Inbox (optional). */
  steps?: string[];
  /** One line under steps when retry is pointless (optional). */
  footnote?: string;
  retryHelps: boolean;
  action: WhatsAppSendFailureAction;
}

type GraphErrorLike = {
  code?: unknown;
  title?: unknown;
  message?: unknown;
  error_data?: { details?: unknown };
};

const BY_CODE: Record<number, Omit<WhatsAppSendFailureExplanation, 'code'>> = {
  131031: {
    title: 'WhatsApp locked this account',
    body: 'This is not a problem with the template fields. Meta locked the WhatsApp Business Account, so every send is blocked until they unlock it. Open Meta Business Suite → Account Quality. Retry will not send.',
    notice: 'WhatsApp locked this Business Account. The template is fine — Meta is blocking all sends.',
    retryHelps: false,
    action: 'meta_account',
  },
  141014: {
    title: 'This WhatsApp account is banned',
    body: 'Meta banned the WhatsApp Business Account. Reconnecting Samyoj will not restore sending until Meta lifts the ban in Account Quality.',
    notice: 'Meta banned this WhatsApp account. Sending is blocked until they lift it.',
    retryHelps: false,
    action: 'meta_account',
  },
  141006: {
    title: 'WhatsApp payment problem',
    body: 'Meta could not bill this WhatsApp account. Add a payment method in WhatsApp Manager, then try again.',
    notice: 'WhatsApp payment failed. Add a payment method in WhatsApp Manager.',
    retryHelps: false,
    action: 'payment',
  },
  141010: {
    title: 'Business verification needed',
    body: 'Meta is blocking sends until business verification is complete in Meta Business Suite.',
    notice: 'Meta needs business verification before this number can send.',
    retryHelps: false,
    action: 'meta_account',
  },
  133010: {
    title: 'Register this number in WhatsApp Manager',
    body: 'Your business line is not registered for Cloud API yet, so Meta blocked this message.',
    notice: 'Register this number in WhatsApp Manager before sending.',
    steps: [
      'Open WhatsApp Manager and select this phone number.',
      'Tap Register and enter the 6-digit PIN Meta sends you.',
      'When the number shows Registered, send again from Samyoj.',
    ],
    footnote: 'Retrying in Samyoj will not work until Meta shows Registered.',
    retryHelps: false,
    action: 'meta_account',
  },
  190: {
    title: 'WhatsApp login expired',
    body: 'Reconnect WhatsApp in Settings. The access token is no longer valid, so messages cannot send.',
    notice: 'WhatsApp login expired. Reconnect the number in Settings.',
    retryHelps: false,
    action: 'connect',
  },
  131047: {
    title: '24-hour window closed',
    body: 'Free-form replies are blocked until the customer messages you, or you send an approved template.',
    notice: '24-hour window closed — send an approved template instead.',
    retryHelps: false,
    action: 'window',
  },
  132001: {
    title: 'This template is paused',
    body: 'WhatsApp paused this template. It cannot send until it is approved again in WhatsApp Manager.',
    notice: 'This template is paused in WhatsApp Manager.',
    retryHelps: false,
    action: 'template',
  },
  132015: {
    title: 'This template is paused',
    body: 'WhatsApp paused this template for quality. Fix it in WhatsApp Manager, then wait for approval.',
    notice: 'WhatsApp paused this template for quality.',
    retryHelps: false,
    action: 'template',
  },
  132012: {
    title: 'Template fields do not match',
    body: 'The number of values in this send does not match the approved template. Edit the fields and try again.',
    notice: 'Template fields do not match the approved template.',
    retryHelps: true,
    action: 'template',
  },
  132000: {
    title: 'Template could not be sent',
    body: 'WhatsApp rejected this template send. Check the template is approved and the fields are filled.',
    notice: 'WhatsApp rejected this template send.',
    retryHelps: true,
    action: 'template',
  },
  131026: {
    title: 'Could not deliver to this number',
    body: 'WhatsApp could not reach this phone. Check the number is on WhatsApp.',
    notice: 'Could not deliver — this phone may not be on WhatsApp.',
    retryHelps: false,
    action: 'retry',
  },
  131000: {
    title: 'WhatsApp profile is not ready',
    body: 'The business profile or display name is incomplete. Finish it in WhatsApp Manager, then retry.',
    notice: 'WhatsApp profile is not ready. Finish it in WhatsApp Manager.',
    retryHelps: false,
    action: 'meta_account',
  },
  368: {
    title: 'WhatsApp temporarily blocked sending',
    body: 'Meta blocked this account from sending after policy or quality issues. Check Account Quality. Retry will not help until Meta lifts the block.',
    notice: 'WhatsApp blocked sending on this account. Check Account Quality.',
    retryHelps: false,
    action: 'meta_account',
  },
};

export function parseWhatsAppMetaCode(raw: unknown): number | undefined {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw);
  if (typeof raw === 'string') {
    const fromHash = raw.match(/#(\d{2,6})/);
    if (fromHash) return Number(fromHash[1]);
    const fromMeta = raw.match(/META_(\d{2,6})/);
    if (fromMeta) return Number(fromMeta[1]);
    if (/^\d{2,6}$/.test(raw.trim())) return Number(raw.trim());
  }
  return undefined;
}

function firstGraphError(errors: unknown): GraphErrorLike | null {
  if (!Array.isArray(errors) || errors.length === 0) return null;
  const first = errors[0];
  if (!first || typeof first !== 'object') return null;
  return first as GraphErrorLike;
}

export function explainWhatsAppSendFailure(input: {
  code?: number | string | null;
  rawMessage?: string | null;
  errors?: unknown;
}): WhatsAppSendFailureExplanation {
  const first = firstGraphError(input.errors);
  const fromErrorCode = parseWhatsAppMetaCode(first?.code);
  const fromErrorMessage =
    (typeof first?.message === 'string' && first.message) ||
    (typeof first?.title === 'string' && first.title) ||
    undefined;
  const code = parseWhatsAppMetaCode(input.code) ?? fromErrorCode;
  const raw = (input.rawMessage || fromErrorMessage || '').trim();
  if (code != null && BY_CODE[code]) {
    return { code, ...BY_CODE[code] };
  }
  if (code === 131047 || /24[- ]hour window|re-engagement required/i.test(raw)) {
    return { code: code ?? 131047, ...BY_CODE[131047] };
  }
  if (/business account locked|account locked/i.test(raw)) {
    return { code: code ?? 131031, ...BY_CODE[131031] };
  }
  const cleaned = raw.replace(/^\(#\d+\)\s*/, '').trim();
  if (cleaned) {
    return {
      code,
      title: 'Message not delivered',
      body: cleaned,
      notice: cleaned,
      retryHelps: true,
      action: 'retry',
    };
  }
  return {
    code,
    title: 'Message not delivered',
    body: 'WhatsApp could not deliver this message. Check the number is connected and try again.',
    notice: 'WhatsApp could not deliver this message.',
    retryHelps: true,
    action: 'retry',
  };
}

/** FAILED always. AMBIGUOUS only when Meta already named a code we can explain. */
export function showsKnownProviderFailure(
  status: string,
  metadata?: { metaCode?: number; metaErrorCode?: number } | null
): boolean {
  const normalized = (status || '').toUpperCase();
  if (normalized === 'FAILED') return true;
  if (normalized !== 'AMBIGUOUS') return false;
  const code = metadata?.metaErrorCode ?? metadata?.metaCode;
  return typeof code === 'number' && Object.prototype.hasOwnProperty.call(BY_CODE, code);
}

export function explainWhatsAppSendFailureFromMessage(message: {
  type?: string;
  metadata?: {
    metaCode?: number;
    metaErrorCode?: number;
    metaErrorTitle?: string;
    metaErrorHint?: string;
    error?: string;
    errors?: unknown;
    retryHelps?: boolean;
  } | null;
}): WhatsAppSendFailureExplanation {
  const meta = message.metadata;
  const explained = explainWhatsAppSendFailure({
    code: meta?.metaErrorCode ?? meta?.metaCode,
    rawMessage: meta?.metaErrorHint || meta?.error || meta?.metaErrorTitle,
    errors: meta?.errors,
  });
  if (typeof meta?.retryHelps === 'boolean') {
    return { ...explained, retryHelps: meta.retryHelps };
  }
  return explained;
}

export function sendFailureActionLink(
  action: WhatsAppSendFailureAction
): { href: string; label: string; external?: boolean } | null {
  switch (action) {
    case 'connect':
      return { href: '/settings?tab=whatsapp', label: 'WhatsApp settings' };
    case 'meta_account':
      return {
        href: 'https://business.facebook.com/latest/whatsapp_manager/phone_numbers',
        label: 'Open WhatsApp Manager',
        external: true,
      };
    case 'template':
      return { href: '/templates', label: 'View templates' };
    case 'window':
      return { href: '/templates', label: 'Send a template' };
    case 'payment':
      return {
        href: 'https://business.facebook.com/billing_hub',
        label: 'Meta billing',
        external: true,
      };
    default:
      return null;
  }
}

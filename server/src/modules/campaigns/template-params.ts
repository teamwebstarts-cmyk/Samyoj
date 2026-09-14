import type { MessageTemplate } from '../whatsapp/meta.service';
import { sanitizeFieldToken, type TemplateParams } from './types';
import { asCustomAttributes } from '../../utils/custom-attributes';

type RecipientVariables = {
  body?: string[];
  header?: string[];
  attributes?: Record<string, string>;
};

export interface RecipientContactContext {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  customAttributes?: Record<string, string> | unknown | null;
}

function contactCustomAttributes(contact: RecipientContactContext | undefined): Record<string, string> {
  return asCustomAttributes(contact?.customAttributes);
}

function textParameters(values: string[]) {
  return values.map((text) => ({ type: 'text' as const, text }));
}

/**
 * Resolve a contact-field token to the recipient's value, with a graceful fallback.
 * Never returns '' — Meta text parameters are positional, so an empty entry would
 * either be rejected or shift every following parameter out of alignment.
 */
function resolveToken(token: string, contact: RecipientContactContext | undefined): string {
  if (token === 'contact.name') return contact?.name?.trim() || 'Valued customer';
  if (token === 'contact.phone') return contact?.phone?.trim() || 'your registered number';
  if (token === 'contact.email') return contact?.email?.trim() || 'your registered email';
  if (token.startsWith('custom.')) {
    const value = contactCustomAttributes(contact)[token.slice(7)]?.trim();
    return value || '-';
  }
  return 'there';
}

function substituteContactTokens(value: string, contact: RecipientContactContext | undefined): string {
  const token = sanitizeFieldToken(value);
  if (token) return resolveToken(token, contact);
  return value
    .replace(/\{\{\s*name\s*\}\}/g, resolveToken('contact.name', contact))
    .replace(/\{\{\s*phone\s*\}\}/g, resolveToken('contact.phone', contact))
    .replace(/\{\{\s*email\s*\}\}/g, resolveToken('contact.email', contact));
}

/**
 * Merge template params for a single recipient.
 * Supports:
 *  - legacy {{name}} substitution (backward compatible)
 *  - contact-field tokens {{name}}/{{phone}}/{{email}} as whole-value entries (from variable mapping)
 * A token entry is resolved from the recipient; a static string passes through.
 */
export function mergeTemplateParams(
  campaignParams: TemplateParams | null | undefined,
  recipientVars: RecipientVariables | null | undefined,
  recipientName?: string | null,
  template?: MessageTemplate | null,
  contact?: RecipientContactContext
): TemplateParams {
  const effectiveContact: RecipientContactContext = {
    name: contact?.name ?? recipientName,
    phone: contact?.phone,
    email: contact?.email,
    customAttributes: {
      ...asCustomAttributes(contact?.customAttributes),
      ...asCustomAttributes(recipientVars?.attributes),
    },
  };

  const mapValue = (value: string) => substituteContactTokens(value, effectiveContact);

  const templateBodyHasName = template?.components?.some(
    (component) => component.type?.toUpperCase() === 'BODY' && component.text?.includes('{{name}}')
  );
  const templateHeaderHasName = template?.components?.some(
    (component) => component.type?.toUpperCase() === 'HEADER' && component.text?.includes('{{name}}')
  );
  const body = recipientVars?.body?.length
    ? recipientVars.body.map(mapValue)
    : campaignParams?.body?.map(mapValue) ||
      (templateBodyHasName ? [resolveToken('contact.name', effectiveContact)] : undefined);

  const header = recipientVars?.header?.length
    ? recipientVars.header.map(mapValue)
    : campaignParams?.header?.map(mapValue) ||
      (templateHeaderHasName ? [resolveToken('contact.name', effectiveContact)] : undefined);

  // Positional params: replace empties in place, never filter — filtering shifts alignment.
  const keepPosition = (values: string[]) => values.map((v) => (v.trim() === '' ? '-' : v));

  return {
    body: body ? keepPosition(body) : undefined,
    header: header ? keepPosition(header) : undefined,
    headerMediaUrl: campaignParams?.headerMediaUrl,
    couponCode: campaignParams?.couponCode,
    buttonUrlSuffixes: campaignParams?.buttonUrlSuffixes,
  };
}

function findCopyCodeButtonIndex(template?: MessageTemplate | null): number | null {
  const buttonsComponent = template?.components?.find((c) => c.type?.toUpperCase() === 'BUTTONS');
  const buttons = buttonsComponent?.buttons;
  if (!buttons?.length) return null;

  const index = buttons.findIndex((btn) => {
    const t = btn.type?.toUpperCase();
    return t === 'COPY_CODE' || t === 'OTP';
  });
  return index >= 0 ? index : null;
}

/**
 * Count the {{n}} placeholders in a template component's text. Named
 * placeholders ({{name}}) are not positional, so they don't count here —
 * Meta only accepts text parameters for numeric {{1}}/{{2}} slots.
 */
function countPlaceholders(text?: string): number {
  if (!text) return 0;
  const numeric = Array.from(text.matchAll(/\{\{(\d+)\}\}/g), (m) => Number(m[1]));
  return numeric.length ? Math.max(...numeric) : 0;
}

export function buildTemplateComponents(
  params: TemplateParams | null | undefined,
  template?: MessageTemplate | null
): unknown[] {
  if (!params) return [];

  // Defensive: never send an unresolved contact-field token to Meta.
  // Replace in place (never filter) — positional params must keep alignment.
  const scrub = (value: string) => {
    const token = sanitizeFieldToken(value);
    if (!token) return value.trim() === '' ? '-' : value;
    if (token === 'contact.name') return 'Valued customer';
    if (token === 'contact.phone') return 'your registered number';
    if (token === 'contact.email') return 'your registered email';
    if (token.startsWith('custom.')) return '-';
    return '-';
  };
  const scrubbed: TemplateParams = {
    ...params,
    body: params.body?.map(scrub),
    header: params.header?.map(scrub),
  };
  const hasUrlSuffix = (scrubbed.buttonUrlSuffixes || []).some((value) => value?.trim());
  if (
    !scrubbed.body?.length &&
    !scrubbed.header?.length &&
    !scrubbed.headerMediaUrl &&
    !scrubbed.couponCode &&
    !hasUrlSuffix
  ) {
    return [];
  }

  const components: unknown[] = [];
  const headerComponent = template?.components?.find((c) => c.type?.toUpperCase() === 'HEADER');
  const bodyComponent = template?.components?.find((c) => c.type?.toUpperCase() === 'BODY');

  // Only attach a parameter component if the approved template actually has a
  // placeholder for it. Sending params to a component with no {{n}} variable is
  // the #132012 "Parameter format does not match" error. This keeps a valid,
  // param-less template sending cleanly even when the UI passes empty params.
  const headerPlaceholderCount = countPlaceholders(headerComponent?.text);
  const bodyPlaceholderCount = countPlaceholders(bodyComponent?.text);

  if (scrubbed.headerMediaUrl && headerComponent?.format && headerComponent.format !== 'TEXT') {
    const mediaType = headerComponent.format.toLowerCase();
    components.push({
      type: 'header',
      parameters: [{ type: mediaType, [mediaType]: { link: scrubbed.headerMediaUrl } }],
    });
  } else if (scrubbed.header?.length && headerPlaceholderCount > 0) {
    components.push({
      type: 'header',
      parameters: textParameters(scrubbed.header.slice(0, headerPlaceholderCount)),
    });
  }

  if (scrubbed.body?.length && bodyPlaceholderCount > 0) {
    components.push({
      type: 'body',
      parameters: textParameters(scrubbed.body.slice(0, bodyPlaceholderCount)),
    });
  }

  const couponCode = scrubbed.couponCode?.trim();
  if (couponCode) {
    const copyCodeIndex = findCopyCodeButtonIndex(template);
    if (copyCodeIndex !== null) {
      components.push({
        type: 'button',
        sub_type: 'copy_code',
        index: String(copyCodeIndex),
        parameters: [{ type: 'coupon_code', coupon_code: couponCode }],
      });
    }
  }

  const suffixes = scrubbed.buttonUrlSuffixes || [];
  if (suffixes.length && template) {
    const buttonsComponent = template.components?.find((c) => c.type?.toUpperCase() === 'BUTTONS');
    const buttons = buttonsComponent?.buttons || [];
    let suffixIndex = 0;
    buttons.forEach((btn, buttonIndex) => {
      if ((btn.type || '').toUpperCase() !== 'URL') return;
      if (!/\{\{/.test(btn.url || '')) return;
      const suffix = suffixes[suffixIndex]?.trim();
      suffixIndex += 1;
      if (!suffix) return;
      components.push({
        type: 'button',
        sub_type: 'url',
        index: String(buttonIndex),
        parameters: [{ type: 'text', text: suffix }],
      });
    });
  }

  return components;
}

export function applyTemplateParamsToPreview(
  template: MessageTemplate | null | undefined,
  params: TemplateParams | null | undefined,
  fallbackName?: string
): string {
  if (!template?.components?.length) {
    return fallbackName ? `Template: ${fallbackName}` : '';
  }

  const lines: string[] = [];
  for (const component of template.components) {
    const type = component.type?.toUpperCase();
    let text = component.text?.trim();
    if (!text) continue;

    const values = type === 'BODY' ? params?.body : params?.header;
    if (values?.length) {
      values.forEach((value, index) => {
        // Preview is campaign-level (no recipient yet) — show a friendly sample for tokens.
        const token = sanitizeFieldToken(value);
        const display =
          token === 'contact.name'
            ? 'Rahul'
            : token === 'contact.phone'
              ? '+91 98765 43210'
              : token === 'contact.email'
                ? 'rahul@example.com'
                : token?.startsWith('custom.')
                  ? `{${token.slice(7)}}`
                  : value;
        text = text!.replace(new RegExp(`\\{\\{${index + 1}\\}\\}`, 'g'), display);
      });
      if (values[0]) text = text!.replace(/\{\{name\}\}/g, values[0]);
    }

    if (type === 'HEADER' || type === 'BODY' || type === 'FOOTER') {
      lines.push(text);
    }
  }

  return lines.join('\n\n') || (fallbackName ? `Template: ${fallbackName}` : '');
}

const NUMBERED_PLACEHOLDER = /\{\{\d+\}\}/;

/** Prefer filled preview; never overwrite stored filled text with raw {{1}} body. */
export function pickHydratedTemplateContent(stored: string, rendered: string): string {
  const filled = (value: string) =>
    Boolean(value) &&
    !NUMBERED_PLACEHOLDER.test(value) &&
    !value.startsWith('Template: ');
  if (filled(rendered)) return rendered;
  if (filled(stored)) return stored;
  return stored || rendered;
}

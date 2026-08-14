import prisma from '../../config/database';
import type { TemplateParams } from '../campaigns/types';
import { normalizeCustomKey } from '../../utils/custom-attributes';

export type TemplateVariableMeta = {
  scope: 'body' | 'header';
  index: number;
  description: string;
  suggestedSource?: 'contact.name' | 'contact.phone' | 'contact.email' | 'custom' | 'contact.custom';
  customKey?: string;
};

export const CONTACT_SOURCE_TOKEN: Record<string, string> = {
  'contact.name': '{{name}}',
  'contact.phone': '{{phone}}',
  'contact.email': '{{email}}',
};

function mapsFromSettings(settings: unknown): Record<string, TemplateVariableMeta[]> {
  const root = (settings && typeof settings === 'object' ? settings : {}) as Record<string, unknown>;
  const maps = root.templateVariableMaps;
  if (!maps || typeof maps !== 'object' || Array.isArray(maps)) return {};
  const out: Record<string, TemplateVariableMeta[]> = {};
  for (const [key, value] of Object.entries(maps as Record<string, unknown>)) {
    if (Array.isArray(value)) out[key] = value as TemplateVariableMeta[];
  }
  return out;
}

export function variableMetaKey(name: string, language?: string) {
  return `${name.trim().toLowerCase()}::${(language || '*').trim() || '*'}`;
}

function tokenForItem(item?: TemplateVariableMeta): string {
  if (!item?.suggestedSource) return '';
  if (item.suggestedSource === 'contact.custom') {
    const key = normalizeCustomKey(item.customKey || '');
    return key ? `{{${key}}}` : '';
  }
  if (item.suggestedSource === 'custom') return '';
  return CONTACT_SOURCE_TOKEN[item.suggestedSource] || '';
}

function cleanVariableMeta(meta: TemplateVariableMeta[]): TemplateVariableMeta[] {
  return meta
    .filter((item) => item && (item.scope === 'body' || item.scope === 'header') && item.index >= 1)
    .map((item) => {
      const customKey =
        item.suggestedSource === 'contact.custom' ? normalizeCustomKey(item.customKey || '') : undefined;
      return {
        scope: item.scope,
        index: item.index,
        description: item.description || '',
        suggestedSource: item.suggestedSource,
        ...(customKey ? { customKey } : {}),
      };
    });
}

export async function getTemplateVariableMeta(
  organizationId: string,
  name: string,
  language?: string
): Promise<TemplateVariableMeta[]> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const maps = mapsFromSettings(org?.settings);
  const exact = maps[variableMetaKey(name, language)];
  if (Array.isArray(exact)) return exact;
  const wildcard = maps[variableMetaKey(name, '*')];
  if (Array.isArray(wildcard)) return wildcard;
  const prefix = `${name.trim().toLowerCase()}::`;
  const fallback = Object.entries(maps).find(([key, meta]) => key.startsWith(prefix) && meta.length);
  return fallback?.[1] || [];
}

export async function saveTemplateVariableMeta(
  organizationId: string,
  name: string,
  meta: TemplateVariableMeta[],
  language?: string
): Promise<TemplateVariableMeta[]> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });
  const settings = (org?.settings && typeof org.settings === 'object' ? org.settings : {}) as Record<
    string,
    unknown
  >;
  const maps = mapsFromSettings(settings);
  const cleaned = cleanVariableMeta(meta);
  maps[variableMetaKey(name, language)] = cleaned;
  await prisma.organization.update({
    where: { id: organizationId },
    data: { settings: { ...settings, templateVariableMaps: maps } },
  });
  return cleaned;
}

export function tokensFromVariableMeta(meta: TemplateVariableMeta[]): Pick<TemplateParams, 'body' | 'header'> {
  const bodyMax = Math.max(0, ...meta.filter((m) => m.scope === 'body').map((m) => m.index));
  const headerMax = Math.max(0, ...meta.filter((m) => m.scope === 'header').map((m) => m.index));
  return {
    body: Array.from({ length: bodyMax }, (_, i) => tokenForItem(meta.find((m) => m.scope === 'body' && m.index === i + 1))),
    header: Array.from({ length: headerMax }, (_, i) =>
      tokenForItem(meta.find((m) => m.scope === 'header' && m.index === i + 1))
    ),
  };
}

import type { PlatformLibraryTemplate, Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { AppError } from '../../utils/response';
import { writePlatformAudit } from '../platform/audit';
import {
  starterCreatePayload,
  type CatalogButton,
  type SamyojCatalogEntry,
} from './catalog';
import { templateTextHasEdgeParams } from './types';

const CATEGORIES = ['UTILITY', 'MARKETING', 'AUTHENTICATION'] as const;

function asCategory(value: string): SamyojCatalogEntry['category'] {
  if (value === 'MARKETING' || value === 'AUTHENTICATION') return value;
  return 'UTILITY';
}

function asButtons(value: Prisma.JsonValue): CatalogButton[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is CatalogButton => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    const type = (item as { type?: string }).type;
    return type === 'URL' || type === 'PHONE_NUMBER' || type === 'COPY_CODE' || type === 'QUICK_REPLY';
  });
}

function asStringArray(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

export function rowToCatalogEntry(row: PlatformLibraryTemplate): SamyojCatalogEntry {
  return {
    id: row.slug,
    title: row.title,
    category: asCategory(row.category),
    tags: row.tags,
    icon: row.icon,
    header: row.header || undefined,
    mediaFormat: row.mediaFormat === 'IMAGE' || row.mediaFormat === 'VIDEO' || row.mediaFormat === 'DOCUMENT'
      ? row.mediaFormat
      : undefined,
    body: row.body,
    bodyHi: row.bodyHi,
    footer: row.footer || undefined,
    footerHi: row.footerHi || undefined,
    buttons: asButtons(row.buttons),
    bodyExamples: asStringArray(row.bodyExamples),
    copy: row.copy,
  };
}

export function toTenantDto(row: PlatformLibraryTemplate) {
  const entry = rowToCatalogEntry(row);
  return {
    ...entry,
    dbId: row.id,
    languages: ['en_US', 'hi_IN'] as const,
    submitMode: 'create' as const,
  };
}

const SEED_SETTING_KEY = 'library_catalog_seeded';

export async function seedPlatformLibraryIfEmpty(): Promise<{ seeded: number }> {
  const flag = await prisma.platformSetting.findUnique({ where: { key: SEED_SETTING_KEY } });
  if (flag) return { seeded: 0 };
  const count = await prisma.platformLibraryTemplate.count();
  await prisma.platformSetting.upsert({
    where: { key: SEED_SETTING_KEY },
    create: {
      key: SEED_SETTING_KEY,
      value: { at: new Date().toISOString(), count },
    },
    update: { value: { at: new Date().toISOString() } },
  });
  return { seeded: 0 };
}

export function unusableTemplateButtonUrl(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return 'That button link is not a valid website.';
  }
  if (parsed.protocol !== 'https:') {
    return 'Use a public https:// website for the button.';
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
  if (
    host === 'github.com' ||
    host.endsWith('.github.com') ||
    host === 'gitlab.com' ||
    host.endsWith('.gitlab.com') ||
    host === 't.me' ||
    host === 'telegram.org' ||
    host === 'telegram.me' ||
    host.endsWith('.telegram.org') ||
    host === 'yourbrand.com' ||
    host === 'example.com' ||
    host.endsWith('.example.com')
  ) {
    return 'That page is not a shop customers can open. Leave this blank to use a chat button, or paste your own https shop or tracking page.';
  }
  return null;
}

export async function getPublishedLibraryTemplate(slug: string) {
  // published flag is the single source of truth — no force-unpublish here.
  const row = await prisma.platformLibraryTemplate.findFirst({
    where: { slug, published: true },
  });
  if (!row) throw new AppError(404, 'Template is not in the Samyoj library');
  return row;
}

export function buildCatalogSubmitPayload(
  row: PlatformLibraryTemplate,
  input: {
    name: string;
    language: string;
    buttonUrl?: string;
    buttonPhone?: string;
    headerMediaHandle?: string;
  }
) {
  const payload = starterCreatePayload(rowToCatalogEntry(row), input.language, input.name, {
    url: input.buttonUrl,
    phone: input.buttonPhone,
  });
  if (row.mediaFormat) {
    return {
      ...payload,
      headerFormat: row.mediaFormat as 'IMAGE' | 'VIDEO' | 'DOCUMENT',
      headerMediaHandle: input.headerMediaHandle,
    };
  }
  return payload;
}

export async function listAdminLibraryTemplates() {
  await seedPlatformLibraryIfEmpty();
  return prisma.platformLibraryTemplate.findMany({
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
  });
}

export type LibraryTemplateWriteInput = {
  slug: string;
  title: string;
  /** Free-form (platform-only taxonomy). Tenant + Meta reads coerce unknowns to UTILITY. */
  category: string;
  tags: string[];
  icon: string;
  header?: string | null;
  mediaFormat?: 'IMAGE' | 'VIDEO' | 'DOCUMENT' | null;
  body: string;
  bodyHi: string;
  footer?: string | null;
  footerHi?: string | null;
  buttons: CatalogButton[];
  bodyExamples: string[];
  copy: string;
  published: boolean;
  sortOrder: number;
};

export function assertLibraryCopySafe(input: {
  body?: string | null;
  bodyHi?: string | null;
  header?: string | null;
  category?: string | null;
}) {
  const skipAuth = input.category === 'AUTHENTICATION';
  if (!skipAuth && input.body && templateTextHasEdgeParams(input.body)) {
    throw new AppError(
      400,
      'Variables can’t be at the start or end of the English body. Add words after the last field — a full stop is not enough.',
    );
  }
  if (!skipAuth && input.bodyHi && templateTextHasEdgeParams(input.bodyHi)) {
    throw new AppError(
      400,
      'Variables can’t be at the start or end of the Hindi body. Add words after the last field — a full stop is not enough.',
    );
  }
  if (input.header && templateTextHasEdgeParams(input.header)) {
    throw new AppError(400, 'The header cannot start or end with a variable.');
  }
}

function writeData(input: LibraryTemplateWriteInput): Prisma.PlatformLibraryTemplateUncheckedCreateInput {
  return {
    slug: input.slug,
    title: input.title,
    category: input.category,
    tags: input.tags,
    icon: input.icon,
    header: input.header || null,
    mediaFormat: input.mediaFormat || null,
    body: input.body,
    bodyHi: input.bodyHi,
    footer: input.footer || null,
    footerHi: input.footerHi || null,
    buttons: input.buttons as Prisma.InputJsonValue,
    bodyExamples: input.bodyExamples as Prisma.InputJsonValue,
    copy: input.copy,
    published: input.published,
    sortOrder: input.sortOrder,
  };
}

export async function createAdminLibraryTemplate(input: {
  actorId: string;
  reason: string;
  data: LibraryTemplateWriteInput;
}) {
  assertLibraryCopySafe(input.data);
  const existing = await prisma.platformLibraryTemplate.findUnique({ where: { slug: input.data.slug } });
  if (existing) throw new AppError(409, 'A library template with this slug already exists');
  const row = await prisma.platformLibraryTemplate.create({ data: writeData(input.data) });
  await writePlatformAudit({
    operatorId: input.actorId,
    action: 'library_template.create',
    targetType: 'PlatformLibraryTemplate',
    targetId: row.id,
    reason: input.reason,
    afterState: { slug: row.slug, title: row.title, published: row.published },
  });
  return row;
}

export async function patchAdminLibraryTemplate(input: {
  actorId: string;
  reason: string;
  id: string;
  data: Partial<LibraryTemplateWriteInput>;
}) {
  const before = await prisma.platformLibraryTemplate.findUnique({ where: { id: input.id } });
  if (!before) throw new AppError(404, 'Library template not found');
  if (
    input.data.body !== undefined ||
    input.data.bodyHi !== undefined ||
    input.data.header !== undefined
  ) {
    assertLibraryCopySafe({
      body: input.data.body ?? before.body,
      bodyHi: input.data.bodyHi ?? before.bodyHi,
      header: input.data.header !== undefined ? input.data.header : before.header,
      category: input.data.category ?? before.category,
    });
  }
  if (input.data.slug && input.data.slug !== before.slug) {
    const clash = await prisma.platformLibraryTemplate.findUnique({ where: { slug: input.data.slug } });
    if (clash) throw new AppError(409, 'A library template with this slug already exists');
  }
  const row = await prisma.platformLibraryTemplate.update({
    where: { id: input.id },
    data: {
      ...(input.data.slug !== undefined ? { slug: input.data.slug } : {}),
      ...(input.data.title !== undefined ? { title: input.data.title } : {}),
      ...(input.data.category !== undefined ? { category: input.data.category } : {}),
      ...(input.data.tags !== undefined ? { tags: input.data.tags } : {}),
      ...(input.data.icon !== undefined ? { icon: input.data.icon } : {}),
      ...(input.data.header !== undefined ? { header: input.data.header || null } : {}),
      ...(input.data.mediaFormat !== undefined ? { mediaFormat: input.data.mediaFormat || null } : {}),
      ...(input.data.body !== undefined ? { body: input.data.body } : {}),
      ...(input.data.bodyHi !== undefined ? { bodyHi: input.data.bodyHi } : {}),
      ...(input.data.footer !== undefined ? { footer: input.data.footer || null } : {}),
      ...(input.data.footerHi !== undefined ? { footerHi: input.data.footerHi || null } : {}),
      ...(input.data.buttons !== undefined ? { buttons: input.data.buttons as Prisma.InputJsonValue } : {}),
      ...(input.data.bodyExamples !== undefined
        ? { bodyExamples: input.data.bodyExamples as Prisma.InputJsonValue }
        : {}),
      ...(input.data.copy !== undefined ? { copy: input.data.copy } : {}),
      ...(input.data.published !== undefined ? { published: input.data.published } : {}),
      ...(input.data.sortOrder !== undefined ? { sortOrder: input.data.sortOrder } : {}),
    },
  });
  await writePlatformAudit({
    operatorId: input.actorId,
    action: 'library_template.patch',
    targetType: 'PlatformLibraryTemplate',
    targetId: row.id,
    reason: input.reason,
    beforeState: { slug: before.slug, title: before.title, published: before.published },
    afterState: { slug: row.slug, title: row.title, published: row.published },
  });
  return row;
}

export async function deleteAdminLibraryTemplate(input: { actorId: string; reason: string; id: string }) {
  const before = await prisma.platformLibraryTemplate.findUnique({ where: { id: input.id } });
  if (!before) throw new AppError(404, 'Library template not found');
  await prisma.platformLibraryTemplate.delete({ where: { id: input.id } });
  await writePlatformAudit({
    operatorId: input.actorId,
    action: 'library_template.delete',
    targetType: 'PlatformLibraryTemplate',
    targetId: before.id,
    reason: input.reason,
    beforeState: { slug: before.slug, title: before.title, published: before.published },
  });
  return { deleted: true, slug: before.slug };
}

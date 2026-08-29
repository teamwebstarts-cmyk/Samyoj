import type { PlatformLibraryTemplate, Prisma } from '@prisma/client';
import prisma from '../../config/database';
import { AppError } from '../../utils/response';
import { writePlatformAudit } from '../platform/audit';
import {
  CATALOG_FILTERS,
  SAMYOJ_CATALOG,
  starterCreatePayload,
  type CatalogButton,
  type SamyojCatalogEntry,
} from './catalog';

export const CATALOG_HONESTY =
  'These drafts live in Samyoj. Submitting still sends this copy to Meta for YOUR WhatsApp number. Utility and authentication are usually faster. Marketing is slower. Samyoj cannot pre-approve Meta on your number.';

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

function seedRow(entry: SamyojCatalogEntry, index: number): Prisma.PlatformLibraryTemplateCreateManyInput {
  return {
    slug: entry.id,
    title: entry.title,
    category: entry.category,
    tags: entry.tags,
    icon: entry.icon,
    header: entry.header ?? null,
    body: entry.body,
    bodyHi: entry.bodyHi,
    footer: entry.footer ?? null,
    footerHi: entry.footerHi ?? null,
    buttons: (entry.buttons || []) as Prisma.InputJsonValue,
    bodyExamples: entry.bodyExamples as Prisma.InputJsonValue,
    copy: entry.copy,
    published: true,
    sortOrder: index,
  };
}

export async function seedPlatformLibraryIfEmpty(): Promise<{ seeded: number }> {
  const count = await prisma.platformLibraryTemplate.count();
  if (count > 0) return { seeded: 0 };
  await prisma.platformLibraryTemplate.createMany({
    data: SAMYOJ_CATALOG.map((entry, index) => seedRow(entry, index)),
    skipDuplicates: true,
  });
  return { seeded: SAMYOJ_CATALOG.length };
}

export async function listPublishedLibraryTemplates() {
  await seedPlatformLibraryIfEmpty();
  const rows = await prisma.platformLibraryTemplate.findMany({
    where: { published: true },
    orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
  });
  return {
    templates: rows.map(toTenantDto),
    filters: CATALOG_FILTERS,
    honesty: CATALOG_HONESTY,
  };
}

export async function getPublishedLibraryTemplate(slug: string) {
  await seedPlatformLibraryIfEmpty();
  const row = await prisma.platformLibraryTemplate.findFirst({
    where: { slug, published: true },
  });
  if (!row) throw new AppError(404, 'Template is not in the Samyoj library');
  return row;
}

export function buildCatalogSubmitPayload(
  row: PlatformLibraryTemplate,
  input: { name: string; language: string; buttonUrl?: string; buttonPhone?: string }
) {
  return starterCreatePayload(rowToCatalogEntry(row), input.language, input.name, {
    url: input.buttonUrl,
    phone: input.buttonPhone,
  });
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
  category: (typeof CATEGORIES)[number];
  tags: string[];
  icon: string;
  header?: string | null;
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

function writeData(input: LibraryTemplateWriteInput): Prisma.PlatformLibraryTemplateUncheckedCreateInput {
  return {
    slug: input.slug,
    title: input.title,
    category: input.category,
    tags: input.tags,
    icon: input.icon,
    header: input.header || null,
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

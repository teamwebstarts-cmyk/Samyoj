import { getOrgWhatsappContext } from '../whatsapp/context';
import { isWhatsAppRateLimit, MetaWhatsAppService } from '../whatsapp/meta.service';
import prisma from '../../config/database';
import {
  buildTenantLibraryCards,
  META_LIBRARY_FILTERS,
  META_LIBRARY_HONESTY,
  type LibraryGraphRow,
} from './meta-library-pack';
import { toTenantDto } from './catalog-store';

export async function listTenantTemplateLibrary(opts?: {
  organizationId?: string;
  whatsappNumberId?: string;
}) {
  let library: LibraryGraphRow[] = [];
  const approvedWabaNames = new Set<string>();

  if (opts?.organizationId) {
    try {
      const { wabaId, accessToken } = await getOrgWhatsappContext(
        opts.organizationId,
        opts.whatsappNumberId
      );
      try {
        const rows = await MetaWhatsAppService.listMessageTemplateLibrary(accessToken, {
          language: 'en_US',
          limit: 100,
        });
        library = rows.map((row) => ({
          name: row.name,
          category: row.category,
          usecase: row.usecase,
          body: row.body,
          header: row.header,
          footer: row.footer,
          buttons: row.buttons,
          body_params: row.body_params,
        }));
      } catch (err) {
        if (!isWhatsAppRateLimit(err)) throw err;
      }
      try {
        const existing = await MetaWhatsAppService.listMessageTemplates(wabaId, accessToken, {
          status: 'APPROVED',
          limit: 100,
        });
        for (const row of existing.templates) {
          if (row.name) approvedWabaNames.add(row.name);
        }
      } catch (err) {
        if (!isWhatsAppRateLimit(err)) throw err;
      }
    } catch {
      /* no connected number — still show the Meta pack */
    }
  }

  // Samyoj-authored catalog drafts (platform admin) listed after the Meta pack.
  // Same row schema, same bilingual clone path — one identity, two surfaces.
  let samyojRows: ReturnType<typeof toTenantDto>[] = [];
  try {
    const rows = await prisma.platformLibraryTemplate.findMany({
      where: { published: true },
      orderBy: [{ sortOrder: 'asc' }, { title: 'asc' }],
    });
    samyojRows = rows.map(toTenantDto);
  } catch {
    /* catalog table unavailable — Meta pack alone still renders */
  }

  return {
    templates: [
      ...buildTenantLibraryCards(library, approvedWabaNames),
      ...samyojRows,
    ],
    filters: samyojRows.some((row) => row.category === 'MARKETING')
      ? [...META_LIBRARY_FILTERS, { id: 'MARKETING', label: 'Marketing' } as const]
      : META_LIBRARY_FILTERS,
    honesty: samyojRows.length
      ? `${META_LIBRARY_HONESTY} Samyoj templates are listed too — pick one and submit it on your number; Meta still reviews it.`
      : META_LIBRARY_HONESTY,
  };
}

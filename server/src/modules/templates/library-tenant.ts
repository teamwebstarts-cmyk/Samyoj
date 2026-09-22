import { getOrgWhatsappContext } from '../whatsapp/context';
import { isWhatsAppRateLimit, MetaWhatsAppService } from '../whatsapp/meta.service';
import {
  buildTenantLibraryCards,
  META_LIBRARY_FILTERS,
  META_LIBRARY_HONESTY,
  type LibraryGraphRow,
} from './meta-library-pack';

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

  return {
    templates: buildTenantLibraryCards(library, approvedWabaNames),
    filters: META_LIBRARY_FILTERS,
    honesty: META_LIBRARY_HONESTY,
  };
}

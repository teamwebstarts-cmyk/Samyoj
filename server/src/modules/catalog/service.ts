import prisma from '../../config/database';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import { getOrgWhatsappContext } from '../whatsapp/context';

interface MetaCatalogProduct {
  id?: string;
  retailer_id?: string;
  name?: string;
  description?: string;
  price?: string;
  currency?: string;
  image_url?: string;
  availability?: string;
}

interface MetaCatalog {
  id: string;
  name?: string;
}

export async function listMetaCatalogs(organizationId: string): Promise<MetaCatalog[]> {
  const { wabaId, accessToken } = await getOrgWhatsappContext(organizationId);
  const data = await MetaWhatsAppService.graphGetPublic<{ data?: MetaCatalog[] }>(
    `/${wabaId}/product_catalogs?fields=id,name`,
    accessToken
  );
  return data.data || [];
}

export async function syncCatalogProducts(
  organizationId: string,
  catalogId: string
): Promise<{ synced: number; catalogId: string }> {
  const { accessToken } = await getOrgWhatsappContext(organizationId);

  const products: MetaCatalogProduct[] = [];
  let nextUrl: string | null =
    `/${catalogId}/products?fields=id,retailer_id,name,description,price,currency,image_url,availability&limit=100`;

  while (nextUrl) {
    const page: {
      data?: MetaCatalogProduct[];
      paging?: { next?: string };
    } = await MetaWhatsAppService.graphGetPublic(nextUrl, accessToken);

    products.push(...(page.data || []));

    const next: string | undefined = page.paging?.next;
    if (next) {
      const parsed: URL = new URL(next);
      nextUrl = parsed.pathname.replace(/^\/v[\d.]+/, '') + parsed.search;
    } else {
      nextUrl = null;
    }
  }

  let synced = 0;
  for (const product of products) {
    const retailerId = product.retailer_id || product.id;
    if (!retailerId || !product.name) continue;

    const priceCents = product.price ? Math.round(parseFloat(product.price) * 100) : null;

    await prisma.catalogProduct.upsert({
      where: {
        organizationId_metaCatalogId_retailerId: {
          organizationId,
          metaCatalogId: catalogId,
          retailerId,
        },
      },
      create: {
        organizationId,
        metaCatalogId: catalogId,
        metaProductId: product.id,
        retailerId,
        name: product.name,
        description: product.description,
        priceCents,
        currency: product.currency || 'INR',
        imageUrl: product.image_url,
        availability: product.availability || 'in stock',
        metadata: product as object,
        syncedAt: new Date(),
      },
      update: {
        metaProductId: product.id,
        name: product.name,
        description: product.description,
        priceCents,
        currency: product.currency || 'INR',
        imageUrl: product.image_url,
        availability: product.availability || 'in stock',
        metadata: product as object,
        syncedAt: new Date(),
      },
    });
    synced++;
  }

  return { synced, catalogId };
}

export async function listCatalogProducts(
  organizationId: string,
  query: { catalogId?: string; search?: string; page?: number; limit?: number }
) {
  const page = Math.max(1, query.page || 1);
  const limit = Math.min(100, Math.max(1, query.limit || 50));
  const skip = (page - 1) * limit;

  const where = {
    organizationId,
    ...(query.catalogId ? { metaCatalogId: query.catalogId } : {}),
    ...(query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: 'insensitive' as const } },
            { retailerId: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };

  const [products, total] = await Promise.all([
    prisma.catalogProduct.findMany({
      where,
      orderBy: { name: 'asc' },
      skip,
      take: limit,
    }),
    prisma.catalogProduct.count({ where }),
  ]);

  return { products, total, page, limit };
}

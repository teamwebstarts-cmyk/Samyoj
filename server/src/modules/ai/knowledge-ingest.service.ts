import prisma from '../../config/database';
import { upsertKnowledgeEmbedding } from './knowledge.service';
import { chunkText, extractPdfText, fetchUrlText } from './ingest.service';

export async function ingestUrlKnowledge(
  organizationId: string,
  botId: string,
  url: string,
  title?: string
): Promise<{ itemsCreated: number }> {
  const text = await fetchUrlText(url);
  if (!text) throw new Error('No text extracted from URL');

  const chunks = chunkText(text);
  const baseTitle = title || new URL(url).hostname;

  let created = 0;
  for (let i = 0; i < chunks.length; i++) {
    const item = await prisma.knowledgeBaseItem.create({
      data: {
        botId,
        title: chunks.length > 1 ? `${baseTitle} (part ${i + 1})` : baseTitle,
        content: chunks[i],
        sourceType: 'URL',
        sourceUrl: url,
      },
    });
    await upsertKnowledgeEmbedding(organizationId, item.id, item.title, item.content, botId);
    created++;
  }

  return { itemsCreated: created };
}

export async function ingestPdfKnowledge(
  organizationId: string,
  botId: string,
  filename: string,
  buffer: Buffer
): Promise<{ itemsCreated: number }> {
  const text = await extractPdfText(buffer);
  if (!text) throw new Error('No text extracted from PDF');

  const chunks = chunkText(text);
  const baseTitle = filename.replace(/\.pdf$/i, '');

  let created = 0;
  for (let i = 0; i < chunks.length; i++) {
    const item = await prisma.knowledgeBaseItem.create({
      data: {
        botId,
        title: chunks.length > 1 ? `${baseTitle} (part ${i + 1})` : baseTitle,
        content: chunks[i],
        sourceType: 'PDF',
      },
    });
    await upsertKnowledgeEmbedding(organizationId, item.id, item.title, item.content, botId);
    created++;
  }

  return { itemsCreated: created };
}

import prisma from '../../config/database';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import { getOrgWhatsappContext } from '../whatsapp/context';
import { readMediaFile, saveMediaBuffer, mediaFileExists } from './storage';
import { logError } from '../../errors';

export interface MessageMediaMetadata {
  mediaId?: string;
  mimeType?: string;
  filename?: string;
  caption?: string;
  mediaPath?: string;
  size?: number;
}

export async function downloadAndStoreMessageMedia(options: {
  organizationId: string;
  messageId: string;
  mediaId: string;
  mimeType?: string;
  filename?: string;
  accessToken: string;
}): Promise<MessageMediaMetadata> {
  const buffer = await MetaWhatsAppService.downloadMedia(options.mediaId, options.accessToken);
  const saved = await saveMediaBuffer({
    organizationId: options.organizationId,
    messageId: options.messageId,
    buffer,
    mimeType: options.mimeType,
    filename: options.filename,
  });

  return {
    mediaId: options.mediaId,
    mimeType: saved.mimeType,
    filename: options.filename,
    mediaPath: saved.mediaPath,
    size: saved.size,
  };
}

export async function ensureMessageMediaStored(options: {
  organizationId: string;
  messageId: string;
  metadata: MessageMediaMetadata;
}): Promise<MessageMediaMetadata> {
  const { metadata } = options;
  if (metadata.mediaPath && (await mediaFileExists(metadata.mediaPath))) {
    return metadata;
  }
  if (!metadata.mediaId) {
    return metadata;
  }

  const { accessToken } = await getOrgWhatsappContext(options.organizationId);
  const stored = await downloadAndStoreMessageMedia({
    organizationId: options.organizationId,
    messageId: options.messageId,
    mediaId: metadata.mediaId,
    mimeType: metadata.mimeType,
    filename: metadata.filename,
    accessToken,
  });

  const updatedMetadata = { ...metadata, ...stored };
  await prisma.message.update({
    where: { id: options.messageId },
    data: { metadata: updatedMetadata },
  });

  return updatedMetadata;
}

export async function getMessageMediaBuffer(options: {
  organizationId: string;
  messageId: string;
  metadata: MessageMediaMetadata;
}): Promise<{ buffer: Buffer; mimeType: string; filename?: string }> {
  let metadata = options.metadata;

  if (!metadata.mediaPath || !(await mediaFileExists(metadata.mediaPath))) {
    try {
      metadata = await ensureMessageMediaStored(options);
    } catch (err) {
      logError(err, {
        source: 'media',
        action: 'Lazy media download failed',
        messageId: options.messageId,
      });
      throw err;
    }
  }

  if (!metadata.mediaPath) {
    throw new Error('Media file not available');
  }

  const buffer = await readMediaFile(metadata.mediaPath);
  return {
    buffer,
    mimeType: metadata.mimeType || 'application/octet-stream',
    filename: metadata.filename,
  };
}

import prisma from '../../config/database';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import { getOrgWhatsappContext } from '../whatsapp/context';
import { readMediaFile, saveMediaBuffer, mediaFileExists } from './storage';
import { optimizeStoredImage } from './image-optimize';
import { logError } from '../../errors';

export interface MessageMediaMetadata {
  mediaId?: string;
  mimeType?: string;
  filename?: string;
  caption?: string;
  mediaPath?: string;
  size?: number;
  /** True when inbound media is a sticker (keep full fidelity — never recompress). */
  isSticker?: boolean;
  isGif?: boolean;
  /** Present when we resized/re-encoded to save disk. */
  originalSize?: number;
  optimized?: boolean;
}

export async function downloadAndStoreMessageMedia(options: {
  organizationId: string;
  messageId: string;
  mediaId: string;
  mimeType?: string;
  filename?: string;
  accessToken: string;
  isSticker?: boolean;
  isGif?: boolean;
}): Promise<MessageMediaMetadata> {
  const raw = await MetaWhatsAppService.downloadMedia(options.mediaId, options.accessToken);
  const optimized = await optimizeStoredImage({
    buffer: raw,
    mimeType: options.mimeType,
    skip: Boolean(options.isSticker || options.isGif),
  });

  const saved = await saveMediaBuffer({
    organizationId: options.organizationId,
    messageId: options.messageId,
    buffer: optimized.buffer,
    mimeType: optimized.mimeType,
    filename: options.filename,
  });

  return {
    mediaId: options.mediaId,
    mimeType: saved.mimeType,
    filename: options.filename,
    mediaPath: saved.mediaPath,
    size: saved.size,
    ...(optimized.optimized
      ? { optimized: true, originalSize: optimized.originalSize }
      : {}),
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
    isSticker: metadata.isSticker,
    isGif: metadata.isGif,
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

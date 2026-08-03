import { Router, Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { authenticate, requireOrg } from '../../middleware/auth';
import { sendSuccess, asyncHandler, AppError } from '../../utils/response';
import { config } from '../../config';
import { buildRelativePath, getPublicMediaUrl, persistMediaBuffer } from './storage-adapter';
import { validateMediaUpload } from './upload.service';

const router = Router();

router.post(
  '/upload-url',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const data = z
      .object({
        mimeType: z.string().min(1),
        size: z.number().int().positive().max(30 * 1024 * 1024),
        filename: z.string().optional(),
      })
      .parse(req.body);

    validateMediaUpload(data.mimeType, data.size);

    const orgId = req.user!.organizationId!;
    const uploadId = randomUUID();
    const relativePath = buildRelativePath(orgId, uploadId, data.mimeType, data.filename);

    if (config.storage.driver === 's3' && config.storage.s3Bucket) {
      let presignedUrl: string;
      try {
        const s3 = await import('@aws-sdk/client-s3' as string);
        const presigner = await import('@aws-sdk/s3-request-presigner' as string);
        const { S3Client, PutObjectCommand } = s3 as {
          S3Client: new (args: Record<string, unknown>) => unknown;
          PutObjectCommand: new (args: Record<string, unknown>) => unknown;
        };
        const { getSignedUrl } = presigner as {
          getSignedUrl: (client: unknown, command: unknown, opts: { expiresIn: number }) => Promise<string>;
        };
        const client = new S3Client({
          region: config.storage.s3Region,
          credentials: {
            accessKeyId: config.storage.s3AccessKey,
            secretAccessKey: config.storage.s3SecretKey,
          },
        });
        const command = new PutObjectCommand({
          Bucket: config.storage.s3Bucket,
          Key: relativePath,
          ContentType: data.mimeType.split(';')[0].trim(),
        });
        presignedUrl = await getSignedUrl(client, command, { expiresIn: 900 });
      } catch {
        throw new AppError(503, 'S3 presigned upload unavailable — use direct upload');
      }

      sendSuccess(res, {
        mode: 'presigned',
        uploadUrl: presignedUrl,
        mediaPath: relativePath,
        publicUrl: getPublicMediaUrl(relativePath),
        expiresIn: 900,
      });
      return;
    }

    sendSuccess(res, {
      mode: 'direct',
      uploadUrl: `${config.serverUrl}/api/media/upload`,
      mediaPath: relativePath,
      publicUrl: getPublicMediaUrl(relativePath),
    });
  })
);

router.post(
  '/upload',
  authenticate,
  requireOrg,
  asyncHandler(async (req: Request, res: Response) => {
    const data = z
      .object({
        mimeType: z.string().min(1),
        data: z.string().min(1),
        filename: z.string().optional(),
      })
      .parse(req.body);

    const buffer = Buffer.from(data.data, 'base64');
    validateMediaUpload(data.mimeType, buffer.length);

    const orgId = req.user!.organizationId!;
    const uploadId = randomUUID();
    const stored = await persistMediaBuffer({
      organizationId: orgId,
      messageId: uploadId,
      buffer,
      mimeType: data.mimeType,
      filename: data.filename,
    });

    sendSuccess(res, {
      mediaPath: stored.mediaPath,
      publicUrl: getPublicMediaUrl(stored.mediaPath),
      mimeType: stored.mimeType,
      size: stored.size,
    });
  })
);

export default router;

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../../config/database';
import type { InstagramPostMediaType, InstagramPostStatus, Prisma } from '@prisma/client';
import { authenticate, requireOrg, loadOrgRole, requireOrgRole } from '../../middleware/auth';
import { requireFeatureOnMutation } from '../../middleware/plan-guard';
import { AppError, asyncHandler, sendSuccess } from '../../utils/response';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import { persistMediaBuffer, getPublicMediaUrl } from '../media/storage-adapter';
import { randomUUID } from 'crypto';
import {
  INSTAGRAM_IMAGE_MAX_BYTES,
  INSTAGRAM_IMAGE_MIMES,
  INSTAGRAM_VIDEO_MAX_BYTES,
  INSTAGRAM_VIDEO_MIMES,
  assertCaption,
  assertScheduleWindow,
} from './posts.limits';
import { parseMediaPayload, resolvePostMedia } from './posts.media';
import { mediaUrlForMeta } from './posts.media-url';
import { publishInstagramPost } from './posts.publish';
import { recoverStaleInstagramPosts } from './posts.recovery';
import {
  fetchInstagramMedia,
  instagramMediaThumbnailUrl,
  listInstagramMediaIds,
} from '../facebook/page-client';
import { createModuleLogger } from '../../utils/logger';
import { createChatCompletion, isAiConfigured } from '../ai/chat-completion.service';
import { captionAiMessages, stripCaptionOutput, type CaptionAiMode } from './posts.caption-ai';

const log = createModuleLogger('instagram-posts');

/**
 * Attach pending KEYWORD·IG automations to a post the moment it gets its
 * igMediaId (publish-now and scheduled-publish paths). Lets users set up
 * comment automation while the post is still a draft/scheduled row.
 */
async function attachPendingPostAutomations(opts: {
  organizationId: string;
  postId: string;
  igMediaId: string | null;
}): Promise<void> {
  if (!opts.igMediaId) return;
  try {
    const pending = await prisma.automation.findMany({
      where: {
        organizationId: opts.organizationId,
        triggerType: 'KEYWORD',
        config: { path: ['igPostId'], equals: opts.postId },
      },
      select: { id: true, config: true },
      take: 20,
    });
    await Promise.all(
      pending.map((row) =>
        prisma.automation.update({
          where: { id: row.id },
          // Json columns replace wholesale — merge so keyword/replies survive.
          data: {
            config: {
              ...((row.config as Record<string, string>) || {}),
              igMediaId: opts.igMediaId as string,
            },
          },
        }),
      ),
    );
    if (pending.length > 0) {
      log.info('Attached pending post automations', {
        postId: opts.postId,
        igMediaId: opts.igMediaId,
        count: pending.length,
      });
    }
  } catch (err) {
    log.warn('Pending post automation attach failed', {
      postId: opts.postId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
const router = Router();
router.use(authenticate, requireOrg, loadOrgRole);

const editors = requireOrgRole('OWNER', 'ADMIN', 'SUPERVISOR');

const mediaItemSchema = z.object({
  url: z.string().url(),
  kind: z.enum(['image', 'video']),
});

const writeSchema = z.object({
  caption: z.string().max(2300).default(''),
  mediaType: z.enum(['IMAGE', 'REELS', 'CAROUSEL']).optional(),
  imageUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  mediaItems: z.array(mediaItemSchema).optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
});

function postId(req: Request): string {
  const raw = req.params.id;
  return Array.isArray(raw) ? raw[0] : raw;
}

function refreshPublicMediaUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  try {
    const parsed = new URL(trimmed);
    const marker = '/api/media/public/';
    const idx = parsed.pathname.indexOf(marker);
    if (idx < 0) return trimmed;
    const relative = decodeURIComponent(parsed.pathname.slice(idx + marker.length));
    if (!relative || relative.includes('..')) return trimmed;
    return getPublicMediaUrl(relative);
  } catch {
    return trimmed;
  }
}

function uploadFilename(req: Request): string | undefined {
  const raw = req.headers['x-file-name'];
  if (typeof raw !== 'string' || !raw) return undefined;
  try {
    return decodeURIComponent(raw);
  } catch {
    return undefined;
  }
}

function toDto(row: {
  id: string;
  status: string;
  mediaType: InstagramPostMediaType;
  caption: string;
  imageUrl: string;
  mediaPayload: Prisma.JsonValue;
  scheduledAt: Date | null;
  publishedAt: Date | null;
  igMediaId: string | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const mediaPayload = parseMediaPayload(row.mediaPayload).map((item) => ({
    ...item,
    url: refreshPublicMediaUrl(item.url),
  }));
  return {
    id: row.id,
    status: row.status,
    mediaType: row.mediaType,
    caption: row.caption,
    imageUrl: refreshPublicMediaUrl(row.imageUrl),
    mediaPayload,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    igMediaId: row.igMediaId,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function activeIg(orgId: string) {
  return prisma.channel.findFirst({
    where: { organizationId: orgId, platform: 'IG', isActive: true },
    select: {
      id: true,
      name: true,
      platformAccountId: true,
      accessToken: true,
    },
    orderBy: { updatedAt: 'desc' },
  });
}

function resolveWriteBody(body: z.infer<typeof writeSchema>) {
  try {
    return resolvePostMedia({
      mediaType: body.mediaType,
      imageUrl: body.imageUrl,
      videoUrl: body.videoUrl,
      mediaItems: body.mediaItems,
    });
  } catch (err) {
    throw new AppError(400, err instanceof Error ? err.message : 'Invalid media');
  }
}

async function publishRow(
  row: {
    id: string;
    caption: string;
    imageUrl: string;
    mediaType: InstagramPostMediaType;
    mediaPayload: Prisma.JsonValue;
  },
  channel: { platformAccountId: string; accessToken: string | null }
) {
  if (!channel.accessToken) throw new Error('Reconnect Instagram to publish.');
  const payload = parseMediaPayload(row.mediaPayload).map((item) => ({
    ...item,
    url: mediaUrlForMeta(item.url),
  }));
  return publishInstagramPost({
    igUserId: channel.platformAccountId,
    accessToken: MetaWhatsAppService.decryptToken(channel.accessToken),
    mediaType: row.mediaType,
    caption: row.caption,
    imageUrl: mediaUrlForMeta(row.imageUrl),
    mediaPayload: payload.length ? payload : null,
  });
}

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const channel = await activeIg(orgId);
    if (!channel) {
      sendSuccess(res, { connected: false, account: null, posts: [] });
      return;
    }
    const status: InstagramPostStatus | 'all' =
      typeof req.query.status === 'string' &&
      (['DRAFT', 'SCHEDULED', 'PROCESSING', 'PUBLISHED', 'FAILED', 'CANCELLED'] as const).includes(
        req.query.status as InstagramPostStatus
      )
        ? (req.query.status as InstagramPostStatus)
        : 'all';
    const posts = await prisma.instagramPost.findMany({
      where: {
        organizationId: orgId,
        channelId: channel.id,
        ...(status !== 'all' ? { status } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    sendSuccess(res, {
      connected: true,
      account: { username: channel.name, igUserId: channel.platformAccountId },
      posts: posts.map(toDto),
    });
  })
);

router.get(
  '/library',
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const channel = await activeIg(orgId);
    if (!channel?.accessToken) {
      sendSuccess(res, { items: [] });
      return;
    }
    const token = MetaWhatsAppService.decryptToken(channel.accessToken);
    const ids: string[] = [];
    let after: string | undefined;
    for (let page = 0; page < 2 && ids.length < 40; page += 1) {
      const batch = await listInstagramMediaIds(channel.platformAccountId, token, after);
      ids.push(...batch.ids);
      after = batch.next;
      if (!after) break;
    }
    const unique = [...new Set(ids)].slice(0, 40);
    const items = [];
    for (const igMediaId of unique) {
      try {
        const media = await fetchInstagramMedia(igMediaId, token);
        if (!media) continue;
        const thumb = instagramMediaThumbnailUrl(media);
        if (!thumb) continue;
        items.push({
          igMediaId,
          mediaType: media.media_type || 'IMAGE',
          thumbnailUrl: thumb,
          permalink: media.permalink || null,
          caption: media.caption || '',
        });
      } catch (err) {
        log.warn('Instagram library media skipped', {
          igMediaId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    }
    sendSuccess(res, { items });
  })
);

const captionAiSchema = z.object({
  mode: z.enum(['polish', 'generate']),
  text: z.string().max(4000),
});

router.post(
  '/caption',
  editors,
  requireFeatureOnMutation('ai'),
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const { mode, text } = captionAiSchema.parse(req.body);
    const input = text.trim();
    if (mode === 'polish' && !input) {
      throw new AppError(400, 'Write a caption first, then Magic can polish it.');
    }
    if (mode === 'generate' && !input) {
      throw new AppError(400, 'Describe the post, then generate a caption.');
    }
    if (!(await isAiConfigured(orgId))) {
      throw new AppError(503, 'AI is not configured for this organization');
    }
    const { system, user } = captionAiMessages(mode as CaptionAiMode, input);
    const result = await createChatCompletion({
      organizationId: orgId,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      maxTokens: 700,
      temperature: mode === 'polish' ? 0.35 : 0.7,
      usageAction: 'instagram_caption',
    });
    const caption = stripCaptionOutput(result.content);
    if (!caption) {
      throw new AppError(502, 'Could not write that caption. Try again.');
    }
    sendSuccess(res, { caption, mode });
  })
);

router.post(
  '/',
  editors,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const channel = await activeIg(orgId);
    if (!channel) throw new AppError(400, 'Connect Instagram first.');
    const body = writeSchema.parse(req.body);
    let caption = '';
    try {
      caption = assertCaption(body.caption);
    } catch (err) {
      throw new AppError(400, err instanceof Error ? err.message : 'Invalid caption');
    }
    const media = resolveWriteBody(body);
    let scheduledAt: Date | null = null;
    let status: 'DRAFT' | 'SCHEDULED' = 'DRAFT';
    if (body.scheduledAt) {
      scheduledAt = new Date(body.scheduledAt);
      try {
        assertScheduleWindow(scheduledAt);
      } catch (err) {
        throw new AppError(400, err instanceof Error ? err.message : 'Invalid schedule');
      }
      status = 'SCHEDULED';
    }
    const row = await prisma.instagramPost.create({
      data: {
        organizationId: orgId,
        channelId: channel.id,
        createdByUserId: req.user!.userId,
        caption,
        mediaType: media.mediaType,
        imageUrl: media.imageUrl,
        mediaPayload: media.mediaPayload ?? undefined,
        scheduledAt,
        status,
      },
    });
    sendSuccess(res, toDto(row), 201);
  })
);

router.patch(
  '/:id',
  editors,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const existing = await prisma.instagramPost.findFirst({
      where: { id: postId(req), organizationId: orgId },
    });
    if (!existing) throw new AppError(404, 'Post not found');
    if (existing.status === 'PUBLISHED' || existing.status === 'PROCESSING') {
      throw new AppError(400, 'This post can no longer be edited.');
    }
    const body = writeSchema.partial().parse(req.body);
    let caption = existing.caption;
    if (body.caption !== undefined) {
      try {
        caption = assertCaption(body.caption);
      } catch (err) {
        throw new AppError(400, err instanceof Error ? err.message : 'Invalid caption');
      }
    }
    let mediaType = existing.mediaType;
    let imageUrl = existing.imageUrl;
    let mediaPayload: Prisma.InputJsonValue | undefined =
      existing.mediaPayload === null ? undefined : (existing.mediaPayload as Prisma.InputJsonValue);
    if (
      body.mediaType !== undefined ||
      body.imageUrl !== undefined ||
      body.videoUrl !== undefined ||
      body.mediaItems !== undefined
    ) {
      try {
        const media = resolvePostMedia({
          mediaType: body.mediaType ?? existing.mediaType,
          imageUrl: body.imageUrl ?? existing.imageUrl,
          videoUrl: body.videoUrl,
          mediaItems:
            body.mediaItems ??
            (existing.mediaPayload ? parseMediaPayload(existing.mediaPayload) : undefined),
        });
        mediaType = media.mediaType;
        imageUrl = media.imageUrl;
        mediaPayload = (media.mediaPayload ?? undefined) as Prisma.InputJsonValue | undefined;
      } catch (err) {
        throw new AppError(400, err instanceof Error ? err.message : 'Invalid media');
      }
    }
    let scheduledAt = existing.scheduledAt;
    let status = existing.status;
    if (body.scheduledAt === null) {
      scheduledAt = null;
      if (status === 'SCHEDULED') status = 'DRAFT';
    } else if (body.scheduledAt) {
      scheduledAt = new Date(body.scheduledAt);
      try {
        assertScheduleWindow(scheduledAt);
      } catch (err) {
        throw new AppError(400, err instanceof Error ? err.message : 'Invalid schedule');
      }
      status = 'SCHEDULED';
    }
    const row = await prisma.instagramPost.update({
      where: { id: existing.id },
      data: {
        caption,
        mediaType,
        imageUrl,
        mediaPayload,
        scheduledAt,
        status,
        lastError: null,
      },
    });
    sendSuccess(res, toDto(row));
  })
);

router.post(
  '/:id/publish',
  editors,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const row = await prisma.instagramPost.findFirst({
      where: { id: postId(req), organizationId: orgId },
    });
    if (!row) throw new AppError(404, 'Post not found');
    if (row.status === 'PUBLISHED') throw new AppError(400, 'Already published.');
    const channel = await activeIg(orgId);
    if (!channel?.accessToken) throw new AppError(400, 'Reconnect Instagram to publish.');
    const claimed = await prisma.instagramPost.updateMany({
      where: { id: row.id, status: { in: ['DRAFT', 'SCHEDULED', 'FAILED'] } },
      data: { status: 'PROCESSING', lastError: null },
    });
    if (claimed.count !== 1) throw new AppError(409, 'This post is already publishing.');
    try {
      const result = await publishRow(row, {
        platformAccountId: channel.platformAccountId,
        accessToken: channel.accessToken,
      });
      const saved = await prisma.instagramPost.update({
        where: { id: row.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          containerId: result.containerId,
          igMediaId: result.igMediaId,
        },
      });
      await attachPendingPostAutomations({
        organizationId: orgId,
        postId: row.id,
        igMediaId: saved.igMediaId,
      });
      sendSuccess(res, toDto(saved));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Publish failed';
      log.warn('Instagram publish failed', { postId: row.id, message });
      const saved = await prisma.instagramPost.update({
        where: { id: row.id },
        data: { status: 'FAILED', lastError: message.slice(0, 500) },
      });
      sendSuccess(res, toDto(saved));
    }
  })
);

router.post(
  '/:id/cancel',
  editors,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const existing = await prisma.instagramPost.findFirst({
      where: { id: postId(req), organizationId: orgId, status: 'SCHEDULED' },
    });
    if (!existing) throw new AppError(404, 'No scheduled post to cancel');
    const row = await prisma.instagramPost.update({
      where: { id: existing.id },
      data: { status: 'CANCELLED', scheduledAt: null },
    });
    sendSuccess(res, toDto(row));
  })
);

router.delete(
  '/:id',
  editors,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const existing = await prisma.instagramPost.findFirst({
      where: {
        id: postId(req),
        organizationId: orgId,
        status: { in: ['DRAFT', 'FAILED', 'CANCELLED'] },
      },
    });
    if (!existing) throw new AppError(404, 'Only drafts and failed posts can be removed.');
    await prisma.instagramPost.delete({ where: { id: existing.id } });
    sendSuccess(res, { ok: true });
  })
);

router.post(
  '/media',
  editors,
  asyncHandler(async (req: Request, res: Response) => {
    const orgId = req.user!.organizationId!;
    const rawUpload = Buffer.isBuffer(req.body) ? req.body : null;
    const jsonBody = rawUpload
      ? null
      : z
          .object({
            mimeType: z.string(),
            data: z.string().min(1),
            filename: z.string().optional(),
          })
          .parse(req.body);
    const headerMime = typeof req.headers['content-type'] === 'string' ? req.headers['content-type'] : '';
    const mime = (rawUpload ? headerMime : jsonBody!.mimeType).split(';')[0].trim().toLowerCase();
    const isImage = INSTAGRAM_IMAGE_MIMES.has(mime);
    const isVideo = INSTAGRAM_VIDEO_MIMES.has(mime);
    if (!isImage && !isVideo) {
      throw new AppError(400, 'Use JPEG/PNG/WebP or MP4/MOV video.');
    }
    const buffer = rawUpload ?? Buffer.from(jsonBody!.data, 'base64');
    if (!buffer.length) throw new AppError(400, 'Media file is empty.');
    const max = isVideo ? INSTAGRAM_VIDEO_MAX_BYTES : INSTAGRAM_IMAGE_MAX_BYTES;
    if (buffer.length > max) {
      throw new AppError(400, isVideo ? 'Video must be 100 MB or smaller.' : 'Image must be 8 MB or smaller.');
    }
    const stored = await persistMediaBuffer({
      organizationId: orgId,
      messageId: randomUUID(),
      buffer,
      mimeType: mime,
      filename: rawUpload ? uploadFilename(req) : jsonBody?.filename,
    });
    const url = getPublicMediaUrl(stored.mediaPath);
    sendSuccess(res, {
      imageUrl: url,
      mediaUrl: url,
      kind: isVideo ? 'video' : 'image',
      mimeType: stored.mimeType,
      size: stored.size,
    });
  })
);

export async function publishDueInstagramPosts(): Promise<void> {
  await recoverStaleInstagramPosts();
  const due = await prisma.instagramPost.findMany({
    where: { status: 'SCHEDULED', scheduledAt: { lte: new Date() } },
    take: 5,
    orderBy: { scheduledAt: 'asc' },
  });
  for (const post of due) {
    const claimed = await prisma.instagramPost.updateMany({
      where: { id: post.id, status: 'SCHEDULED' },
      data: { status: 'PROCESSING' },
    });
    if (claimed.count !== 1) continue;
    const channel = await prisma.channel.findFirst({
      where: { id: post.channelId, isActive: true, platform: 'IG' },
      select: { platformAccountId: true, accessToken: true },
    });
    if (!channel?.accessToken) {
      await prisma.instagramPost.update({
        where: { id: post.id },
        data: { status: 'FAILED', lastError: 'Instagram is disconnected.' },
      });
      continue;
    }
    try {
      const result = await publishRow(post, channel);
      const published = await prisma.instagramPost.update({
        where: { id: post.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: new Date(),
          containerId: result.containerId,
          igMediaId: result.igMediaId,
        },
      });
      await attachPendingPostAutomations({
        organizationId: post.organizationId,
        postId: post.id,
        igMediaId: published.igMediaId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Publish failed';
      log.warn('Scheduled Instagram post failed', { postId: post.id, message });
      await prisma.instagramPost.update({
        where: { id: post.id },
        data: { status: 'FAILED', lastError: message.slice(0, 500) },
      });
    }
  }
}

export function startInstagramPostScheduler(): void {
  const timer = setInterval(() => {
    void publishDueInstagramPosts().catch((err) => {
      log.warn('Instagram post scheduler tick failed', {
        err: err instanceof Error ? err.message : String(err),
      });
    });
  }, 30_000);
  timer.unref?.();
}

export default router;

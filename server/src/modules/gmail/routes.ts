import express, { Request, Response, Router } from 'express';
import crypto from 'crypto';
import { GmailMailboxStatus, OrgRole, Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '../../config/database';
import { authenticate, loadOrgRole, requireOrg, requireOrgRole } from '../../middleware/auth';
import { AppError, asyncHandler, sendSuccess } from '../../utils/response';
import { persistMediaBuffer } from '../media/storage-adapter';
import { gmailSendQueue } from '../../config/queues';
import {
  ATTACHMENT_TTL_MS,
  GMAIL_SCOPES,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  MAX_DECODED_MIME_BYTES,
  safeAttachmentFilename,
  validateAttachmentBuffer,
} from './constants';
import {
  buildGmailOAuthUrl,
  exchangeGmailCode,
  fetchGoogleIdentity,
  consumeGmailOAuthState,
  signGmailOAuthState,
  storeGmailOAuthState,
  verifyGmailOAuthState,
} from './oauth';
import { encrypt } from '../../utils/crypto';
import { sanitizeEmailHtml } from './mime';

const router = Router();

const activeMailboxWhere = (organizationId: string) => ({
  organizationId,
  status: { in: [GmailMailboxStatus.CONNECTED, GmailMailboxStatus.RECONNECT_REQUIRED] },
});

function sendStatus(status: string): string {
  return status === 'ACCEPTED'
    ? 'accepted'
    : status === 'SENDING'
      ? 'sending'
      : status === 'AMBIGUOUS'
        ? 'ambiguous'
    : status === 'RECONNECT_REQUIRED'
          ? 'reconnect-required'
          : status === 'FAILED'
            ? 'failed'
            : 'queued';
}

async function activeMailbox(organizationId: string) {
  return prisma.gmailMailbox.findFirst({
    where: activeMailboxWhere(organizationId),
    orderBy: { updatedAt: 'desc' },
  });
}

function requirePersistedUser(req: Request): void {
  if (req.user?.userId === 'api-key') {
    throw new AppError(403, 'Gmail actions require a human organization user');
  }
}

router.get(
  '/oauth/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const stateValue = typeof req.query.state === 'string' ? req.query.state : '';
    const error = typeof req.query.error === 'string' ? req.query.error : '';
    let state;
    try {
      state = verifyGmailOAuthState(stateValue);
    } catch {
      throw new AppError(400, 'Invalid or expired Gmail connection state');
    }
    if (!(await consumeGmailOAuthState(state))) {
      throw new AppError(400, 'Invalid or already-used Gmail connection state');
    }
    if (error) {
      return res.redirect(`${state.returnUri}&status=failed&reason=${encodeURIComponent('Google cancelled Gmail connection')}`);
    }
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    if (!code) throw new AppError(400, 'Google did not return an authorization code');

    const membership = await prisma.organizationUser.findUnique({
      where: { organizationId_userId: { organizationId: state.organizationId, userId: state.userId } },
      select: { role: true },
    });
    if (
      !membership ||
      (membership.role !== OrgRole.OWNER && membership.role !== OrgRole.ADMIN)
    ) {
      throw new AppError(403, 'Gmail connection requires an active OWNER or ADMIN role');
    }

    const token = await exchangeGmailCode(code);
    const identity = await fetchGoogleIdentity(token.access_token);
    const existing = await prisma.gmailMailbox.findFirst({
      where: activeMailboxWhere(state.organizationId),
      select: { id: true },
    });
    if (existing) {
      await prisma.gmailMailbox.update({
        where: { id: existing.id },
        data: { status: 'DISCONNECTED', disconnectedAt: new Date() },
      });
    }
    await prisma.gmailMailbox.create({
      data: {
        organizationId: state.organizationId,
        email: identity.email,
        providerAccountId: identity.id,
        accessTokenEncrypted: encrypt(token.access_token),
        refreshTokenEncrypted: token.refresh_token ? encrypt(token.refresh_token) : undefined,
        tokenExpiresAt: new Date(Date.now() + (token.expires_in ?? 3600) * 1000),
        scopes: [...GMAIL_SCOPES],
        status: 'CONNECTED',
        connectedById: state.userId,
      },
    });
    return res.redirect(`${state.returnUri}&status=connected`);
  })
);

router.use(authenticate, requireOrg);

router.get(
  '/status',
  asyncHandler(async (req: Request, res: Response) => {
    const mailbox = await activeMailbox(req.user!.organizationId!);
    sendSuccess(res, {
      connected: mailbox?.status === 'CONNECTED',
      email: mailbox?.email || null,
      status: mailbox ? (mailbox.status === 'RECONNECT_REQUIRED' ? 'reconnect-required' : 'connected') : 'disconnected',
      reconnectReason: mailbox?.reconnectReason || null,
      scopes: mailbox?.scopes || [],
    });
  })
);

router.get(
  '/connect',
  loadOrgRole,
  requireOrgRole(OrgRole.OWNER, OrgRole.ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const state = signGmailOAuthState({
        organizationId: req.user!.organizationId!,
        userId: req.user!.userId,
      });
      await storeGmailOAuthState(verifyGmailOAuthState(state));
      sendSuccess(res, { url: buildGmailOAuthUrl(state), scopes: [...GMAIL_SCOPES] });
    } catch (error) {
      throw new AppError(503, error instanceof Error ? error.message : 'Gmail OAuth is not configured');
    }
  })
);

router.post(
  '/disconnect',
  loadOrgRole,
  requireOrgRole(OrgRole.OWNER, OrgRole.ADMIN),
  asyncHandler(async (req: Request, res: Response) => {
    const mailbox = await activeMailbox(req.user!.organizationId!);
    if (mailbox) {
      await prisma.gmailMailbox.update({
        where: { id: mailbox.id },
        data: {
          status: 'DISCONNECTED',
          accessTokenEncrypted: null,
          refreshTokenEncrypted: null,
          disconnectedAt: new Date(),
        },
      });
    }
    sendSuccess(res, { status: 'disconnected' });
  })
);

router.post(
  '/attachments',
  express.raw({ type: '*/*', limit: `${MAX_ATTACHMENT_BYTES}b` }),
  asyncHandler(async (req: Request, res: Response) => {
    requirePersistedUser(req);
    if (!Buffer.isBuffer(req.body)) throw new AppError(400, 'Attachment bytes are required');
    const filenameHeader = req.headers['x-file-name'];
    const mimeHeader = req.headers['x-file-mime-type'] || req.headers['content-type'];
    const filename = Array.isArray(filenameHeader) ? filenameHeader[0] : filenameHeader;
    const mimeType = Array.isArray(mimeHeader) ? mimeHeader[0] : mimeHeader;
    if (!filename || !mimeType) throw new AppError(400, 'x-file-name and x-file-mime-type are required');
    let valid;
    try {
      valid = validateAttachmentBuffer({ filename, mimeType, buffer: req.body });
    } catch (error) {
      throw new AppError(400, error instanceof Error ? error.message : 'Invalid attachment');
    }
    const id = crypto.randomUUID();
    const stored = await persistMediaBuffer({
      organizationId: req.user!.organizationId!,
      messageId: `gmail/${id}`,
      buffer: req.body,
      mimeType: valid.mimeType,
      filename: valid.filename,
    });
    const attachment = await prisma.emailAttachment.create({
      data: {
        id,
        organizationId: req.user!.organizationId!,
        createdById: req.user!.userId,
        originalName: valid.filename,
        mimeType: valid.mimeType,
        sizeBytes: valid.sizeBytes,
        sha256: crypto.createHash('sha256').update(req.body).digest('hex'),
        storagePath: stored.mediaPath,
        expiresAt: new Date(Date.now() + ATTACHMENT_TTL_MS),
      },
      select: { id: true, originalName: true, mimeType: true, sizeBytes: true, expiresAt: true },
    });
    sendSuccess(res, attachment, 201);
  })
);

router.get(
  '/contacts',
  asyncHandler(async (req: Request, res: Response) => {
    const contacts = await prisma.contact.findMany({
      where: { organizationId: req.user!.organizationId!, email: { not: null } },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        emailOptedIn: true,
        emailConsentSource: true,
        emailConsentAt: true,
        emailConsentVersion: true,
        emailOptOutAt: true,
      },
    });
    sendSuccess(res, contacts.map((contact) => ({
      ...contact,
      eligible: Boolean(
        contact.email &&
        contact.emailOptedIn &&
        contact.emailConsentSource &&
        contact.emailConsentAt &&
        contact.emailConsentVersion &&
        !contact.emailOptOutAt
      ),
    })));
  })
);

router.put(
  '/contacts/:id/email-consent',
  asyncHandler(async (req: Request, res: Response) => {
    const body = z.object({
      optedIn: z.boolean(),
      source: z.string().trim().min(1).max(80).optional(),
      version: z.string().trim().max(40).optional(),
    }).parse(req.body);
    const contact = await prisma.contact.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId! },
      select: { id: true },
    });
    if (!contact) throw new AppError(404, 'Contact not found');
    const now = new Date();
    const updated = await prisma.contact.update({
      where: { id: contact.id },
      data: body.optedIn
        ? {
            emailOptedIn: true,
            emailConsentSource: body.source || 'MANUAL',
            emailConsentAt: now,
            emailConsentVersion: body.version || 'email-consent-v1',
            emailOptOutAt: null,
          }
        : { emailOptedIn: false, emailOptOutAt: now },
      select: { id: true, emailOptedIn: true, emailConsentAt: true, emailOptOutAt: true },
    });
    sendSuccess(res, updated);
  })
);

const templateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  subject: z.string().min(1).max(998),
  textBody: z.string().min(1).max(100_000),
  htmlBody: z.string().max(100_000).nullable().optional(),
});

router.get(
  '/templates',
  asyncHandler(async (req: Request, res: Response) => {
    const templates = await prisma.emailTemplate.findMany({
      where: { organizationId: req.user!.organizationId! },
      orderBy: { updatedAt: 'desc' },
    });
    sendSuccess(res, templates);
  })
);

router.post(
  '/templates',
  asyncHandler(async (req: Request, res: Response) => {
    requirePersistedUser(req);
    const data = templateSchema.parse(req.body);
    const mailbox = await activeMailbox(req.user!.organizationId!);
    try {
      const template = await prisma.emailTemplate.create({
        data: {
          organizationId: req.user!.organizationId!,
          mailboxId: mailbox?.id,
          createdById: req.user!.userId,
          ...data,
          htmlBody: data.htmlBody ? sanitizeEmailHtml(data.htmlBody) : null,
        },
      });
      sendSuccess(res, template, 201);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(409, 'A template with that name already exists');
      }
      throw error;
    }
  })
);

router.patch(
  '/templates/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const data = templateSchema.partial().parse(req.body);
    const template = await prisma.emailTemplate.findFirst({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId! },
    });
    if (!template) throw new AppError(404, 'Template not found');
    try {
      const updated = await prisma.emailTemplate.update({
        where: { id: template.id },
        data: { ...data, ...(data.htmlBody !== undefined ? { htmlBody: data.htmlBody ? sanitizeEmailHtml(data.htmlBody) : null } : {}) },
      });
      sendSuccess(res, updated);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new AppError(409, 'A template with that name already exists');
      }
      throw error;
    }
  })
);

router.delete(
  '/templates/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await prisma.emailTemplate.deleteMany({
      where: { id: String(req.params.id), organizationId: req.user!.organizationId! },
    });
    if (!result.count) throw new AppError(404, 'Template not found');
    sendSuccess(res, { deleted: true });
  })
);

export const gmailSendSchema = z.object({
  contactIds: z.array(z.string().uuid()).length(1),
  subject: z.string().min(1).max(998).optional(),
  textBody: z.string().min(1).max(100_000).optional(),
  htmlBody: z.string().max(100_000).nullable().optional(),
  templateId: z.string().uuid().optional(),
  attachmentIds: z.array(z.string().uuid()).max(MAX_ATTACHMENTS).default([]),
});

function fillTemplate(value: string, contact: { name: string | null; email: string | null; phone: string }): string {
  return value
    .replaceAll('{{name}}', contact.name || '')
    .replaceAll('{{email}}', contact.email || '')
    .replaceAll('{{phone}}', contact.phone);
}

router.post(
  '/send',
  asyncHandler(async (req: Request, res: Response) => {
    requirePersistedUser(req);
    const data = gmailSendSchema.parse(req.body);
    const organizationId = req.user!.organizationId!;
    const mailbox = await activeMailbox(organizationId);
    if (!mailbox || mailbox.status !== 'CONNECTED') {
      throw new AppError(409, 'Reconnect Gmail before sending', 'GMAIL_RECONNECT_REQUIRED');
    }
    const template = data.templateId
      ? await prisma.emailTemplate.findFirst({ where: { id: data.templateId, organizationId } })
      : null;
    if (data.templateId && !template) throw new AppError(404, 'Template not found');
    const subject = data.subject ?? template?.subject;
    const textBody = data.textBody ?? template?.textBody;
    const htmlBody = data.htmlBody !== undefined ? data.htmlBody : template?.htmlBody;
    if (!subject || !textBody) throw new AppError(400, 'Subject and plain text body are required');

    const contacts = await prisma.contact.findMany({
      where: { organizationId, id: { in: [...new Set(data.contactIds)] } },
      select: {
        id: true, name: true, email: true, phone: true,
        emailOptedIn: true, emailConsentSource: true, emailConsentAt: true,
        emailConsentVersion: true, emailOptOutAt: true,
      },
    });
    if (contacts.length !== new Set(data.contactIds).size) throw new AppError(400, 'One or more contacts were not found');
    const ineligible = contacts.find(
      (contact) =>
        !contact.email ||
        !contact.emailOptedIn ||
        !contact.emailConsentSource ||
        !contact.emailConsentAt ||
        !contact.emailConsentVersion ||
        contact.emailOptOutAt
    );
    if (ineligible) throw new AppError(400, `Contact ${ineligible.name || ineligible.email || ineligible.id} has no active email consent`);

    const uploaded = data.attachmentIds.length
      ? await prisma.emailAttachment.findMany({
          where: { id: { in: data.attachmentIds }, organizationId, deletedAt: null, emailSendId: null },
          select: { id: true, originalName: true, mimeType: true, sizeBytes: true, sha256: true, storagePath: true },
        })
      : [];
    if (uploaded.length !== data.attachmentIds.length) throw new AppError(400, 'One or more attachments are unavailable');
    if (uploaded.reduce((sum, item) => sum + item.sizeBytes, 0) > MAX_DECODED_MIME_BYTES) {
      throw new AppError(400, `Attachments exceed the ${MAX_DECODED_MIME_BYTES} byte decoded MIME budget`);
    }

    const requestKey = String(req.headers['idempotency-key'] || req.body.idempotencyKey || '').trim();
    if (requestKey && (requestKey.length < 8 || requestKey.length > 200)) {
      throw new AppError(400, 'Idempotency-Key must be between 8 and 200 characters');
    }
    const uniqueContacts = contacts;
    const sends = await prisma.$transaction(async (tx) => {
      const created = [];
      for (const contact of uniqueContacts) {
        const idempotencyKey = requestKey ? `${requestKey}:${contact.id}` : undefined;
        if (idempotencyKey) {
          const existing = await tx.emailSend.findUnique({
            where: { organizationId_idempotencyKey: { organizationId, idempotencyKey } },
          });
          if (existing) {
            created.push(existing);
            continue;
          }
        }
        const send = await tx.emailSend.create({
          data: {
            organizationId,
            mailboxId: mailbox.id,
            templateId: template?.id,
            contactId: contact.id,
            createdById: req.user!.userId,
            recipientEmail: contact.email!,
            recipientName: contact.name,
            subject: fillTemplate(subject, contact),
            textBody: fillTemplate(textBody, contact),
            htmlBody: htmlBody ? fillTemplate(htmlBody, contact) : null,
            idempotencyKey,
          },
        });
        for (const attachment of uploaded) {
          await tx.emailAttachment.create({
            data: {
              organizationId,
              emailSendId: send.id,
              createdById: req.user!.userId,
              originalName: attachment.originalName,
              mimeType: attachment.mimeType,
              sizeBytes: attachment.sizeBytes,
              sha256: attachment.sha256,
              storagePath: attachment.storagePath,
              expiresAt: new Date(Date.now() + ATTACHMENT_TTL_MS),
            },
          });
        }
        created.push(send);
      }
      if (uploaded.length) {
        await tx.emailAttachment.updateMany({
          where: { id: { in: uploaded.map((item) => item.id) } },
          data: { deletedAt: new Date() },
        });
      }
      return created;
    });
    await Promise.all(
      sends
        .filter((send) => send.status === 'QUEUED')
        .map((send) => gmailSendQueue.add('send-email', { emailSendId: send.id }, { jobId: `gmail-send:${send.id}` }))
    );
    sendSuccess(res, sends.map((send) => ({ id: send.id, recipientEmail: send.recipientEmail, status: sendStatus(send.status) })), 202);
  })
);

router.get(
  '/sends',
  asyncHandler(async (req: Request, res: Response) => {
    const sends = await prisma.emailSend.findMany({
      where: { organizationId: req.user!.organizationId! },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true, recipientEmail: true, recipientName: true, subject: true,
        textBody: true, status: true, statusReason: true, createdAt: true,
        acceptedAt: true, failedAt: true,
      },
    });
    sendSuccess(res, sends.map((send) => ({ ...send, status: sendStatus(send.status) })));
  })
);

export default router;


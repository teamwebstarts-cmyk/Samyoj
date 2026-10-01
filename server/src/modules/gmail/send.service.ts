import crypto from 'crypto';
import prisma from '../../config/database';
import { logError } from '../../errors';
import { deleteMediaObject, fetchMediaBuffer } from '../media/storage-adapter';
import {
  GMAIL_ENQUEUE_FAILED,
  GMAIL_ENQUEUE_FAILED_MESSAGE,
  GMAIL_SEND_LEASE_MS,
  gmailSendJobId,
} from './constants';
import { GmailProviderError, GmailReconnectRequiredError, sendGmailMessage } from './provider';

export async function enqueueGmailSend(
  emailSendId: string,
  context?: { source?: 'api' | 'worker'; organizationId?: string; path?: string; action?: string },
): Promise<void> {
  const { gmailSendQueue } = await import('../../config/queues');
  try {
    await gmailSendQueue.add(
      'send-email',
      { emailSendId },
      { jobId: gmailSendJobId(emailSendId) },
    );
  } catch (error) {
    await markEmailSendFailed(
      emailSendId,
      'FAILED',
      GMAIL_ENQUEUE_FAILED_MESSAGE,
      GMAIL_ENQUEUE_FAILED,
    );
    logError(error, {
      source: context?.source ?? 'api',
      path: context?.path ?? '/api/gmail/send',
      organizationId: context?.organizationId,
      action: context?.action ?? 'enqueueGmailSend',
      emailSendId,
    });
    throw error;
  }
}

async function cleanupAttachments(sendId: string): Promise<void> {
  const attachments = await prisma.emailAttachment.findMany({
    where: {
      emailSendId: sendId,
      whatsappNumberId: { not: null },
      whatsappNumber: { isActive: true },
      deletedAt: null,
    },
    select: { id: true, storagePath: true },
  });
  await Promise.all(attachments.map((attachment) => deleteMediaObject(attachment.storagePath)));
  await prisma.emailAttachment.updateMany({
    where: {
      emailSendId: sendId,
      whatsappNumberId: { not: null },
      whatsappNumber: { isActive: true },
      deletedAt: null,
    },
    data: { deletedAt: new Date() },
  });
}

export async function markEmailSendFailed(
  sendId: string,
  status: 'FAILED' | 'AMBIGUOUS' | 'RECONNECT_REQUIRED',
  reason: string,
  errorCode?: string
): Promise<void> {
  const updated = await prisma.emailSend.updateMany({
    where: {
      id: sendId,
      whatsappNumberId: { not: null },
      whatsappNumber: { isActive: true },
      status: { in: ['QUEUED', 'SENDING'] },
    },
    data: {
      status,
      statusReason: reason,
      errorCode,
      failedAt: new Date(),
      sendingLeaseToken: null,
      sendingLeaseExpiresAt: null,
    },
  });
  if (updated.count === 1) await cleanupAttachments(sendId);
}

export async function claimGmailSend(
  sendId: string,
  now = new Date(),
): Promise<string | null> {
  const leaseToken = crypto.randomUUID();
  const claimed = await prisma.emailSend.updateMany({
    where: {
      id: sendId,
      whatsappNumberId: { not: null },
      whatsappNumber: { isActive: true },
      status: 'QUEUED',
    },
    data: {
      status: 'SENDING',
      attempts: { increment: 1 },
      sendingLeaseToken: leaseToken,
      sendingLeaseExpiresAt: new Date(now.getTime() + GMAIL_SEND_LEASE_MS),
    },
  });
  return claimed.count === 1 ? leaseToken : null;
}

async function releaseGmailSendForRetry(
  sendId: string,
  leaseToken: string,
  reason: string,
): Promise<void> {
  await prisma.emailSend.updateMany({
    where: {
      id: sendId,
      whatsappNumberId: { not: null },
      whatsappNumber: { isActive: true },
      status: 'SENDING',
      sendingLeaseToken: leaseToken,
    },
    data: {
      status: 'QUEUED',
      statusReason: reason,
      sendingLeaseToken: null,
      sendingLeaseExpiresAt: null,
      providerCallStartedAt: null,
    },
  });
}

export async function processGmailSend(sendId: string): Promise<void> {
  const send = await prisma.emailSend.findFirst({
    where: {
      id: sendId,
      whatsappNumberId: { not: null },
      whatsappNumber: { isActive: true },
    },
    include: {
      mailbox: true,
    },
  });
  if (!send || send.status !== 'QUEUED' || !send.whatsappNumberId) return;

  if (send.mailbox.status !== 'CONNECTED') {
    await markEmailSendFailed(
      sendId,
      'RECONNECT_REQUIRED',
      'Reconnect Gmail before sending from this mailbox',
      'GMAIL_RECONNECT_REQUIRED'
    );
    return;
  }

  const leaseToken = await claimGmailSend(sendId);
  if (!leaseToken) return;

  const now = new Date();
  const attachmentWhere = {
    emailSendId: send.id,
    organizationId: send.organizationId,
    whatsappNumberId: send.whatsappNumberId,
    whatsappNumber: { isActive: true },
    deletedAt: null,
  } as const;
  const expiredAttachmentCount = await prisma.emailAttachment.count({
    where: { ...attachmentWhere, expiresAt: { lte: now } },
  });
  if (expiredAttachmentCount > 0) {
    await markEmailSendFailed(
      sendId,
      'FAILED',
      'Attachment upload expired before send',
      'ATTACHMENT_EXPIRED',
    );
    return;
  }
  const persistedAttachments = await prisma.emailAttachment.findMany({
    where: { ...attachmentWhere, expiresAt: { gt: now } },
    select: { originalName: true, mimeType: true, storagePath: true },
  });

  let attachments: Array<{ filename: string; mimeType: string; buffer: Buffer }>;
  try {
    attachments = await Promise.all(
      persistedAttachments.map(async (attachment) => ({
          filename: attachment.originalName,
          mimeType: attachment.mimeType,
          buffer: await fetchMediaBuffer(attachment.storagePath),
        }))
    );
  } catch (error) {
    await releaseGmailSendForRetry(sendId, leaseToken, 'Attachment storage was unavailable; retrying');
    throw error instanceof Error ? error : new Error('Attachment storage is unavailable');
  }

  try {
    const boundary = await prisma.emailSend.updateMany({
      where: {
        id: sendId,
        whatsappNumberId: send.whatsappNumberId,
        whatsappNumber: { isActive: true },
        status: 'SENDING',
        sendingLeaseToken: leaseToken,
      },
      data: { providerCallStartedAt: new Date() },
    });
    if (boundary.count !== 1) return;

    const result = await sendGmailMessage({
      mailbox: send.mailbox,
      from: send.mailbox.email,
      to: send.recipientEmail,
      subject: send.subject,
      textBody: send.textBody,
      htmlBody: send.htmlBody,
      attachments,
    });
    const completed = await prisma.emailSend.updateMany({
      where: {
        id: sendId,
        whatsappNumberId: send.whatsappNumberId,
        whatsappNumber: { isActive: true },
        status: 'SENDING',
        sendingLeaseToken: leaseToken,
      },
      data: {
        status: 'ACCEPTED',
        gmailMessageId: result.id,
        statusReason: 'Accepted by Gmail',
        acceptedAt: new Date(),
        sendingLeaseToken: null,
        sendingLeaseExpiresAt: null,
      },
    });
    if (completed.count !== 1) {
      await markEmailSendFailed(
        sendId,
        'AMBIGUOUS',
        'Gmail accepted the request but the send lease was lost; reconcile with Gmail',
        'GMAIL_ACCEPTED_LEASE_LOST',
      );
      return;
    }
    await cleanupAttachments(sendId);
  } catch (error) {
    if (error instanceof GmailReconnectRequiredError) {
      await prisma.gmailMailbox.updateMany({
        where: { id: send.mailboxId },
        data: { status: 'RECONNECT_REQUIRED', reconnectReason: error.message },
      });
      await markEmailSendFailed(sendId, 'RECONNECT_REQUIRED', error.message, 'GMAIL_RECONNECT_REQUIRED');
      return;
    }
    if (error instanceof GmailProviderError) {
      if (error.code === 'GMAIL_FORBIDDEN') {
        await prisma.gmailMailbox.updateMany({
          where: { id: send.mailboxId },
          data: {
            status: 'RECONNECT_REQUIRED',
            reconnectReason: 'Gmail rejected the send with 403; reconnect or resolve the Gmail quota/permission issue',
          },
        });
        await markEmailSendFailed(
          sendId,
          'RECONNECT_REQUIRED',
          'Gmail rejected the send with 403; reconnect or resolve the Gmail quota/permission issue',
          error.code,
        );
        return;
      }
      if (!error.providerBoundaryReached && error.retryable) {
        await releaseGmailSendForRetry(sendId, leaseToken, error.message);
        // BullMQ retries only explicit negative responses or failures before
        // Gmail could accept the request. Network/timeouts remain ambiguous.
        throw error;
      }
      const ambiguous = error.providerBoundaryReached;
      await markEmailSendFailed(
        sendId,
        ambiguous ? 'AMBIGUOUS' : 'FAILED',
        error.message,
        error.code,
      );
      return;
    }
    await markEmailSendFailed(
      sendId,
      'AMBIGUOUS',
      error instanceof Error ? error.message : 'Gmail did not accept the email',
      error instanceof Error ? 'GMAIL_SEND_FAILED' : 'GMAIL_SEND_UNKNOWN',
    );
  }
}

/** Re-enqueue queued rows and close leases left behind by a worker crash. */
export async function reconcileGmailSends(): Promise<void> {
  const now = new Date();
  const stale = await prisma.emailSend.findMany({
    where: {
      status: 'SENDING',
      sendingLeaseExpiresAt: { lt: now },
      whatsappNumberId: { not: null },
      whatsappNumber: { isActive: true },
    },
    select: { id: true },
    take: 100,
  });
  for (const send of stale) {
    await markEmailSendFailed(
      send.id,
      'AMBIGUOUS',
      'Gmail send worker lease expired; reconcile with Gmail before retrying',
      'GMAIL_SEND_LEASE_EXPIRED',
    );
  }

  const queued = await prisma.emailSend.findMany({
    where: {
      status: 'QUEUED',
      whatsappNumberId: { not: null },
      whatsappNumber: { isActive: true },
    },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });
  if (!queued.length) return;
  for (const send of queued) {
    try {
      await enqueueGmailSend(send.id, { source: 'worker', action: 'reconcileGmailSends' });
    } catch {
      // Row is already FAILED + logged. Do not rethrow or reconcile will 500 every minute.
    }
  }
}


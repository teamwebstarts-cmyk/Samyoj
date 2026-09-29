import crypto from 'crypto';
import prisma from '../../config/database';
import { deleteMediaObject, fetchMediaBuffer } from '../media/storage-adapter';
import { GMAIL_SEND_LEASE_MS } from './constants';
import { GmailProviderError, GmailReconnectRequiredError, sendGmailMessage } from './provider';

async function cleanupAttachments(sendId: string): Promise<void> {
  const attachments = await prisma.emailAttachment.findMany({
    where: { emailSendId: sendId, deletedAt: null },
    select: { id: true, storagePath: true },
  });
  await Promise.all(attachments.map((attachment) => deleteMediaObject(attachment.storagePath)));
  await prisma.emailAttachment.updateMany({
    where: { emailSendId: sendId, deletedAt: null },
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
    where: { id: sendId, status: { in: ['QUEUED', 'SENDING'] } },
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
    where: { id: sendId, status: 'QUEUED' },
    data: {
      status: 'SENDING',
      attempts: { increment: 1 },
      sendingLeaseToken: leaseToken,
      sendingLeaseExpiresAt: new Date(now.getTime() + GMAIL_SEND_LEASE_MS),
    },
  });
  return claimed.count === 1 ? leaseToken : null;
}

async function releaseGmailSendForRetry(sendId: string, leaseToken: string, reason: string): Promise<void> {
  await prisma.emailSend.updateMany({
    where: { id: sendId, status: 'SENDING', sendingLeaseToken: leaseToken },
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
  const send = await prisma.emailSend.findUnique({
    where: { id: sendId },
    include: {
      mailbox: true,
      attachments: true,
    },
  });
  if (!send || send.status !== 'QUEUED') return;

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

  let attachments: Array<{ filename: string; mimeType: string; buffer: Buffer }>;
  try {
    attachments = await Promise.all(
      send.attachments
        .filter((attachment) => !attachment.deletedAt)
        .map(async (attachment) => ({
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
      where: { id: sendId, status: 'SENDING', sendingLeaseToken: leaseToken },
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
      where: { id: sendId, status: 'SENDING', sendingLeaseToken: leaseToken },
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
        // BullMQ retries only this safe pre-provider failure.
        throw error;
      }
      const ambiguous =
        error.providerBoundaryReached &&
        (error.code === 'GMAIL_REQUEST_TIMEOUT' ||
          error.code === 'GMAIL_REQUEST_FAILED' ||
          error.code === '429' ||
          Number(error.code) >= 500);
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
    where: { status: 'QUEUED' },
    select: { id: true },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });
  if (!queued.length) return;
  const { gmailSendQueue } = await import('../../config/queues');
  for (const send of queued) {
    await gmailSendQueue.add(
      'send-email',
      { emailSendId: send.id },
      { jobId: `gmail-send:${send.id}` },
    );
  }
}


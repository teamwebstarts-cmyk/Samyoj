import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../utils/response';

vi.mock('../../config/database', () => ({
  default: {
    organizationUser: { findFirst: vi.fn() },
    outreachLog: { create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    platformAuditLog: { create: vi.fn() },
  },
}));

vi.mock('../../services/email.service', () => ({
  sendEmail: vi.fn(),
  isSmtpConfigured: vi.fn(),
}));

import prisma from '../../config/database';
import { isSmtpConfigured, sendEmail } from '../../services/email.service';
import {
  outreachAgingBucket,
  outreachAgeDays,
  sendOrgOutreach,
} from './outreach';

const findOwner = vi.mocked(prisma.organizationUser.findFirst);
const createLog = vi.mocked(prisma.outreachLog.create);
const updateLog = vi.mocked(prisma.outreachLog.update);
const send = vi.mocked(sendEmail);
const smtp = vi.mocked(isSmtpConfigured);

describe('platform outreach', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findOwner.mockResolvedValue({
      user: { email: 'owner@example.com' },
      organization: { companyName: 'Acme' },
    } as never);
    createLog.mockResolvedValue({ id: 'log-1' } as never);
    updateLog.mockResolvedValue({} as never);
    send.mockResolvedValue(true);
    smtp.mockReturnValue(true);
  });

  it('sends only a server-owned template to the org owner', async () => {
    const result = await sendOrgOutreach({
      organizationId: 'org-1',
      operatorId: 'ops-1',
      templateId: 'connect_whatsapp',
      reason: 'Stuck on WhatsApp connect for 7 days',
    });

    expect(result.status).toBe('SENT');
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'owner@example.com',
        subject: expect.stringContaining('Connect WhatsApp'),
      })
    );
    expect(createLog.mock.calls[0][0].data).not.toHaveProperty('recipientEmail');
    expect(createLog.mock.calls[0][0].data).not.toHaveProperty('body');
  });

  it('stores LOGGED instead of SENT when SMTP is unset', async () => {
    smtp.mockReturnValue(false);
    send.mockResolvedValue(false);

    const result = await sendOrgOutreach({
      organizationId: 'org-1',
      operatorId: 'ops-1',
      templateId: 'connect_whatsapp',
      reason: 'Stuck on WhatsApp connect for 7 days',
    });

    expect(result.status).toBe('LOGGED');
    expect(result.status).not.toBe('SENT');
    expect(updateLog.mock.calls[0][0].data.status).toBe('LOGGED');
    expect(updateLog.mock.calls[0][0].data.errorCode).toBe('SMTP_NOT_CONFIGURED');
    expect(updateLog.mock.calls[0][0].data.sentAt).toBeNull();
  });

  it('stores FAILED when SMTP is configured but the send does not deliver', async () => {
    smtp.mockReturnValue(true);
    send.mockResolvedValue(false);

    const result = await sendOrgOutreach({
      organizationId: 'org-1',
      operatorId: 'ops-1',
      templateId: 'add_contacts',
      reason: 'Connected empty book for two weeks',
    });

    expect(result.status).toBe('FAILED');
    expect(updateLog.mock.calls[0][0].data.status).toBe('FAILED');
  });

  it('rejects unknown templates and does not accept an arbitrary recipient', async () => {
    await expect(
      sendOrgOutreach({
        organizationId: 'org-1',
        operatorId: 'ops-1',
        templateId: 'custom_blast',
        reason: 'Need a one-off email',
      })
    ).rejects.toBeInstanceOf(AppError);
    expect(send).not.toHaveBeenCalled();
  });

  it('splits stuck stages into 7/14/30-day aging buckets', () => {
    const now = new Date('2026-08-17T12:00:00.000Z');
    expect(outreachAgingBucket(new Date('2026-08-16T12:00:00.000Z'), now)).toBe('recent');
    expect(outreachAgingBucket(new Date('2026-08-10T12:00:00.000Z'), now)).toBe('d7');
    expect(outreachAgingBucket(new Date('2026-08-01T12:00:00.000Z'), now)).toBe('d14');
    expect(outreachAgingBucket(new Date('2026-07-01T12:00:00.000Z'), now)).toBe('d30');
    expect(outreachAgeDays(new Date('2026-08-10T12:00:00.000Z'), now)).toBe(7);
  });
});

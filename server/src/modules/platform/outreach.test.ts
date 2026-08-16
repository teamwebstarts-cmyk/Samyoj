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
}));

import prisma from '../../config/database';
import { sendEmail } from '../../services/email.service';
import { sendOrgOutreach } from './outreach';

const findOwner = vi.mocked(prisma.organizationUser.findFirst);
const createLog = vi.mocked(prisma.outreachLog.create);
const updateLog = vi.mocked(prisma.outreachLog.update);
const send = vi.mocked(sendEmail);

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
});

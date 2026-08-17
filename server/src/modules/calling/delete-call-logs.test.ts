import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../utils/response';
import prisma from '../../config/database';
import { deleteCallLogs, requireWhatsappNumberId } from './delete-call-logs';

vi.mock('../../config/database', () => ({
  default: {
    call: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

const call = prisma.call as unknown as {
  findMany: ReturnType<typeof vi.fn>;
  deleteMany: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
  call.findMany.mockResolvedValue([{ id: 'call-1' }, { id: 'call-2' }]);
  call.deleteMany.mockResolvedValue({ count: 2 });
});

describe('requireWhatsappNumberId', () => {
  it('throws 409 when the number header is missing', () => {
    try {
      requireWhatsappNumberId(undefined);
      throw new Error('expected 409');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).statusCode).toBe(409);
    }
  });

  it('returns the number id when present', () => {
    expect(requireWhatsappNumberId('wa-1')).toBe('wa-1');
  });
});

describe('deleteCallLogs', () => {
  it('hard-deletes only Call rows scoped to org + number', async () => {
    const result = await deleteCallLogs({
      organizationId: 'org-1',
      whatsappNumberId: 'wa-1',
      callIds: ['call-1', 'call-2'],
    });

    expect(call.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['call-1', 'call-2'] },
        organizationId: 'org-1',
        whatsappNumberId: 'wa-1',
      },
      select: { id: true },
    });
    expect(call.deleteMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['call-1', 'call-2'] },
        organizationId: 'org-1',
        whatsappNumberId: 'wa-1',
      },
    });
    expect(result.deletedIds).toEqual(['call-1', 'call-2']);
  });

  it('does not delete when any id is outside the number workspace', async () => {
    call.findMany.mockResolvedValue([{ id: 'call-1' }]);

    await expect(
      deleteCallLogs({
        organizationId: 'org-1',
        whatsappNumberId: 'wa-1',
        callIds: ['call-1', 'other-org'],
      })
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(call.deleteMany).not.toHaveBeenCalled();
  });

  it('returns 404 for a single missing call', async () => {
    call.findMany.mockResolvedValue([]);

    await expect(
      deleteCallLogs({
        organizationId: 'org-1',
        whatsappNumberId: 'wa-1',
        callIds: ['missing'],
        missingAs: 'not_found',
      })
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(call.deleteMany).not.toHaveBeenCalled();
  });

  it('never deletes when the WhatsApp number id is missing', async () => {
    await expect(
      deleteCallLogs({
        organizationId: 'org-1',
        whatsappNumberId: undefined,
        callIds: ['call-1'],
      })
    ).rejects.toMatchObject({ statusCode: 409 });

    expect(call.findMany).not.toHaveBeenCalled();
    expect(call.deleteMany).not.toHaveBeenCalled();
  });
});

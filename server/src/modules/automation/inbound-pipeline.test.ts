import { describe, expect, it, vi, beforeEach } from 'vitest';

const tx = {
  $queryRaw: vi.fn(),
  message: {
    update: vi.fn(),
  },
};

vi.mock('../../config/database', () => ({
  default: {
    $transaction: vi.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
    message: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import prisma from '../../config/database';
import {
  getInboundPipeline,
  isInboundStageComplete,
  markInboundPipelineStage,
  claimInboundPipelineStage,
} from './inbound-pipeline';

describe('inbound-pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tx.$queryRaw.mockResolvedValue([{ metadata: { inboundPipeline: { flow: true } } }]);
    tx.message.update.mockResolvedValue({});
  });

  it('reads pipeline stages from message metadata', async () => {
    vi.mocked(prisma.message.findUnique).mockResolvedValue({
      metadata: { inboundPipeline: { flow: true, flowHandled: false } },
    } as never);

    const pipeline = await getInboundPipeline('msg-1');
    expect(pipeline.flow).toBe(true);
    expect(isInboundStageComplete(pipeline, 'flow')).toBe(true);
    expect(isInboundStageComplete(pipeline, 'static')).toBe(false);
  });

  it('merges pipeline stages into metadata', async () => {
    vi.mocked(prisma.message.findUnique).mockResolvedValue({
      metadata: { inboundPipeline: { flow: true } },
    } as never);
    vi.mocked(prisma.message.update).mockResolvedValue({} as never);

    await markInboundPipelineStage('msg-1', { static: true });

    expect(prisma.message.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'msg-1' },
        data: expect.objectContaining({
          metadata: expect.objectContaining({
            inboundPipeline: { flow: true, static: true },
          }),
        }),
      })
    );
  });

  it('claims a free inbound stage once', async () => {
    tx.$queryRaw.mockResolvedValue([{ metadata: { inboundPipeline: { flow: true } } }]);
    await expect(claimInboundPipelineStage('msg-1', 'static')).resolves.toBe(true);
    expect(tx.message.update).toHaveBeenCalled();
  });

  it('refuses a stage that is already complete', async () => {
    tx.$queryRaw.mockResolvedValue([{ metadata: { inboundPipeline: { static: true } } }]);
    await expect(claimInboundPipelineStage('msg-1', 'static')).resolves.toBe(false);
    expect(tx.message.update).not.toHaveBeenCalled();
  });
});

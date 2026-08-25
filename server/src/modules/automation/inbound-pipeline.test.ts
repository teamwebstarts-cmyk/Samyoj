import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../config/database', () => ({
  default: {
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
} from './inbound-pipeline';

describe('inbound-pipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});

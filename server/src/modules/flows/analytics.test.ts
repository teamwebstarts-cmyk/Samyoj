import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../../config/database', () => ({
  default: {
    flow: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import prisma from '../../config/database';
import { incrementFlowStat } from './analytics';

describe('incrementFlowStat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('increments handoffs without affecting dropoffs', async () => {
    vi.mocked(prisma.flow.findUnique).mockResolvedValue({
      stats: { starts: 0, completions: 0, handoffs: 0, dropoffs: {} },
    } as never);

    await incrementFlowStat('flow-1', 'handoffs', 'node-1');

    expect(prisma.flow.update).toHaveBeenCalledWith({
      where: { id: 'flow-1' },
      data: {
        stats: {
          starts: 0,
          completions: 0,
          handoffs: 1,
          dropoffs: {},
        },
      },
    });
  });

  it('increments dropoffs only when field is dropoffs', async () => {
    vi.mocked(prisma.flow.findUnique).mockResolvedValue({
      stats: { starts: 0, completions: 0, handoffs: 0, dropoffs: {} },
    } as never);

    await incrementFlowStat('flow-1', 'dropoffs', 'node-x');

    expect(prisma.flow.update).toHaveBeenCalledWith({
      where: { id: 'flow-1' },
      data: {
        stats: {
          starts: 0,
          completions: 0,
          handoffs: 0,
          dropoffs: { 'node-x': 1 },
        },
      },
    });
  });
});

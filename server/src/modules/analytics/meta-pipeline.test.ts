import { describe, expect, it } from 'vitest';
import { pipelineColumn, type PipelineLead } from './meta-pipeline';

const day = new Date('2026-09-20T00:00:00.000Z');

function lead(partial: Partial<PipelineLead> & Pick<PipelineLead, 'id' | 'stage'>): PipelineLead {
  return {
    title: partial.id,
    amount: null,
    metaLeadId: 'leadgen-1',
    createdAt: day,
    ...partial,
  };
}

describe('meta pipeline column', () => {
  it('shows — revenue when a won Meta lead has no amount', () => {
    const result = pipelineColumn([lead({ id: 'a', stage: 'WON' })], 'facebook');
    expect(result.won).toBe(1);
    expect(result.revenue).toBeNull();
  });

  it('sums amount only for won Meta leads', () => {
    const result = pipelineColumn(
      [
        lead({ id: 'a', stage: 'WON', amount: '100.50' }),
        lead({ id: 'b', stage: 'QUALIFIED', amount: '999' }),
        lead({ id: 'c', stage: 'WON', amount: null, metaLeadId: null }),
      ],
      'all'
    );
    expect(result.qualified).toBe(1);
    expect(result.won).toBe(1);
    expect(result.revenue).toBe('100.50');
  });

  it('does not count a WhatsApp chat as pipeline', () => {
    const result = pipelineColumn(
      [lead({ id: 'chat', stage: 'WON', amount: '50', metaLeadId: null })],
      'whatsapp'
    );
    expect(result.won).toBe(0);
    expect(result.revenue).toBeNull();
  });
});

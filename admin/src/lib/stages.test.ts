import { describe, expect, it } from 'vitest';
import { ACTIVATION_STAGES, STAGE_LABELS, isCompletedStage } from './stages';

describe('admin lifecycle mapping', () => {
  it('keeps the six-stage funnel in order', () => {
    expect(ACTIVATION_STAGES).toEqual([
      'REGISTERED',
      'NOT_CONNECTED',
      'CONNECTED_EMPTY',
      'CONTACTS_READY',
      'OUTBOUND_ONLY',
      'LIVE',
    ]);
    expect(STAGE_LABELS.OUTBOUND_ONLY).toBe('Outbound only');
    expect(isCompletedStage('LIVE', 'NOT_CONNECTED')).toBe(true);
    expect(isCompletedStage('REGISTERED', 'LIVE')).toBe(false);
  });
});

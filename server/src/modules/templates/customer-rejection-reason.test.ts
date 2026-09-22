import { describe, expect, it } from 'vitest';
import { customerTemplateRejectionBrief, sanitizeTemplateRejectionAlert } from './customer-rejection-reason';

describe('customerTemplateRejectionBrief', () => {
  it('replaces raw SCAM labels', () => {
    const out = customerTemplateRejectionBrief('SCAM');
    expect(out).toMatch(/flagged this template/i);
    expect(out).not.toMatch(/scam/i);
  });

  it('sanitizes alert rows for GET /settings/alerts', () => {
    const row = sanitizeTemplateRejectionAlert({
      templateName: 'order_confirmed',
      reason: 'SCAM',
    });
    expect(row.reason).not.toMatch(/scam/i);
  });
});

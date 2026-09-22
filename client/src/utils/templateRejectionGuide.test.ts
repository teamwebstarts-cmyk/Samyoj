import { describe, expect, it } from 'vitest';
import {
  formatCustomerTemplateRejectionBrief,
  formatCustomerTemplateRejectionTitle,
  getTemplateRejectionGuide,
} from './templateRejectionGuide';

describe('template rejection customer copy', () => {
  it('does not surface raw SCAM labels', () => {
    expect(formatCustomerTemplateRejectionBrief('SCAM')).not.toMatch(/scam/i);
    expect(formatCustomerTemplateRejectionTitle('SCAM')).toBe('Policy review');
    expect(getTemplateRejectionGuide('SCAM')?.summary).toMatch(/flagged this template/i);
  });
});

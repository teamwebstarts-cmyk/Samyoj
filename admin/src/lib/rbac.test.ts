import { describe, expect, it } from 'vitest';
import { can } from './rbac';

describe('platform RBAC', () => {
  it('keeps ANALYST read-only and SUPPORT off operators/sessions', () => {
    expect(can('ANALYST', 'organization.read')).toBe(true);
    expect(can('ANALYST', 'organization.write')).toBe(false);
    expect(can('ANALYST', 'outreach.send')).toBe(false);
    expect(can('SUPPORT', 'organization.write')).toBe(true);
    expect(can('SUPPORT', 'outreach.send')).toBe(true);
    expect(can('SUPPORT', 'operators.manage')).toBe(false);
    expect(can('SUPPORT', 'sessions.manage')).toBe(false);
    expect(can('SUPER_ADMIN', 'operators.manage')).toBe(true);
  });
});

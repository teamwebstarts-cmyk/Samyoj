import { describe, expect, it } from 'vitest';
import { maskBusinessPhone } from './session';

describe('admin masking', () => {
  it('masks middle digits and never returns the original phone', () => {
    const raw = '+919876543210';
    const masked = maskBusinessPhone(raw);
    expect(masked).toBe('91••••10');
    expect(masked).not.toContain('987654');
  });
});

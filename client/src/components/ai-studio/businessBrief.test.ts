import { describe, expect, it } from 'vitest';
import { buildBusinessStudioBrief } from './businessBrief';

describe('buildBusinessStudioBrief', () => {
  it('returns null without a company name', () => {
    expect(buildBusinessStudioBrief({ companyName: '', profile: { description: 'A salon' } })).toBeNull();
  });

  it('builds a brief from profile fields', () => {
    const brief = buildBusinessStudioBrief({
      companyName: 'Glow Jaipur',
      profile: { description: 'Skincare studio in C Scheme' },
      audience: 'Women 25–45',
      valueProps: ['Organic products', 'Free consultation'],
    });
    expect(brief).toContain('Glow Jaipur');
    expect(brief).toContain('Organic products');
    expect(brief!.length).toBeLessThanOrEqual(2000);
  });
});

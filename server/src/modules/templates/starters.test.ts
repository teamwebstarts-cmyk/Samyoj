import { describe, expect, it } from 'vitest';
import { listSamyojStarters, starterCreatePayload } from './catalog';
import { createTemplateSchema, templateTextHasEdgeParams } from './types';

describe('Samyoj catalog templates', () => {
  it('ships at least 30 bilingual drafts', () => {
    const starters = listSamyojStarters();
    expect(starters.length).toBeGreaterThanOrEqual(30);
    const ids = new Set(starters.map((row) => row.id));
    expect(ids.size).toBe(starters.length);
    for (const starter of starters) {
      expect(starter.languages).toEqual(['en_US', 'hi_IN']);
      expect(starter.bodyHi.length).toBeGreaterThan(8);
      expect(starter.body).not.toMatch(/^\{\{\d+\}\}/);
      expect(['UTILITY', 'MARKETING', 'AUTHENTICATION']).toContain(starter.category);
    }
  });

  it('does not start or end non-OTP bodies with a variable (Meta rejects {{3}}.)', () => {
    for (const starter of listSamyojStarters()) {
      if (starter.category === 'AUTHENTICATION') continue;
      expect(templateTextHasEdgeParams(starter.body), starter.id).toBe(false);
      expect(templateTextHasEdgeParams(starter.bodyHi), `${starter.id} hi`).toBe(false);
    }
  });

  it('submits OTP starters in Meta authentication format', () => {
    const otp = listSamyojStarters().find((row) => row.id === 'otp_login');
    expect(otp).toBeTruthy();
    const payload = starterCreatePayload(otp!, 'hi_IN', 'samyoj_otp_login');
    expect(payload.category).toBe('AUTHENTICATION');
    expect(payload.authType).toBe('OTP');
    expect(payload.addSecurityRecommendation).toBe(true);
    expect(payload.body).toContain('{{1}}');
    expect(payload.body).not.toMatch(/^\{\{\d+\}\}/);
    expect(() => createTemplateSchema.parse(payload)).not.toThrow();
  });

  it('builds a valid Meta create payload for every seed draft', () => {
    for (const starter of listSamyojStarters()) {
      const payload = starterCreatePayload(starter, 'en_US', `samyoj_${starter.id}`);
      expect(() => createTemplateSchema.parse(payload), starter.id).not.toThrow();
      const hi = starterCreatePayload(starter, 'hi_IN', `samyoj_${starter.id}_hi`);
      expect(() => createTemplateSchema.parse(hi), starter.id).not.toThrow();
    }
  });

  it('turns URL buttons into chat buttons when no website is given', () => {
    const shipped = listSamyojStarters().find((row) => row.id === 'order_shipped');
    expect(shipped).toBeTruthy();
    const withoutUrl = starterCreatePayload(shipped!, 'en_US', 'order_shipped_3');
    expect(withoutUrl.buttons?.every((button) => button.type !== 'URL')).toBe(true);
    expect(withoutUrl.buttons?.some((button) => button.type === 'QUICK_REPLY' && button.text === 'Track shipment')).toBe(
      true,
    );
    const withUrl = starterCreatePayload(shipped!, 'en_US', 'order_shipped_3', {
      url: 'https://yourstore.com/track',
    });
    expect(withUrl.buttons?.some((button) => button.type === 'URL' && button.url === 'https://yourstore.com/track')).toBe(
      true,
    );
  });
});

describe('unusableTemplateButtonUrl', () => {
  it('rejects GitHub and sample hosts', async () => {
    const { unusableTemplateButtonUrl } = await import('./catalog-store');
    expect(unusableTemplateButtonUrl('https://github.com/teamwebstarts-cmyk/Samyoj')).toMatch(
      /GitHub|shop or tracking/i
    );
    expect(unusableTemplateButtonUrl('https://www.yourbrand.com/')).toMatch(/GitHub|shop or tracking|sample/i);
    expect(unusableTemplateButtonUrl('https://yourstore.com/track')).toBeNull();
  });

  it('rejects trailing variables on admin catalog copy', async () => {
    const { assertLibraryCopySafe } = await import('./catalog-store');
    expect(() =>
      assertLibraryCopySafe({
        category: 'UTILITY',
        body: 'Hi {{1}}, tracking {{2}}.',
        bodyHi: 'Namaste {{1}} tracking theek hai.',
      }),
    ).toThrow(/start or end of the English body/i);
  });
});

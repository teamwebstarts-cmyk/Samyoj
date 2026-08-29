import { describe, expect, it } from 'vitest';
import { listSamyojStarters, starterCreatePayload } from './catalog';
import { createTemplateSchema } from './types';

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

  it('keeps marketing opt-out footer on create payload', () => {
    const offer = listSamyojStarters().find((row) => row.id === 'festival_offer');
    expect(offer).toBeTruthy();
    const payload = starterCreatePayload(offer!, 'en_US', 'samyoj_festival_offer', {
      url: 'https://shop.example/',
    });
    expect(payload.category).toBe('MARKETING');
    expect(payload.footer).toMatch(/STOP/i);
    expect(() => createTemplateSchema.parse(payload)).not.toThrow();
  });
});

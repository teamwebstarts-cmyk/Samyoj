import { describe, expect, it } from 'vitest';
import { listSamyojStarters, starterCreatePayload } from './starters';

describe('Samyoj starter templates', () => {
  it('ships three UTILITY/AUTH definitions with Hindi and English', () => {
    const starters = listSamyojStarters();
    expect(starters).toHaveLength(3);
    expect(starters.map((row) => row.id).sort()).toEqual(
      ['appointment_reminder', 'otp_login', 'order_update'].sort()
    );
    for (const starter of starters) {
      expect(starter.languages).toEqual(['en_US', 'hi_IN']);
      expect(['UTILITY', 'AUTHENTICATION']).toContain(starter.category);
      expect(starter.copy).toContain('Meta still reviews');
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
  });
});

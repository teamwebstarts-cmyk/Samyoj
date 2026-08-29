import { describe, expect, it } from 'vitest';
import {
  resolveWhatsAppPreviewIdentity,
  WHATSAPP_BUSINESS_FALLBACK,
} from './whatsappPreviewIdentity';

describe('resolveWhatsAppPreviewIdentity', () => {
  it('uses the written company name with initials and formatted number', () => {
    const identity = resolveWhatsAppPreviewIdentity({
      companyName: 'Samyoj Store',
      phoneNumber: '15551977746',
      officialBusinessAccount: false,
    });

    expect(identity.title).toBe('Samyoj Store');
    expect(identity.initials).toBe('SS');
    expect(identity.subtitle).toMatch(/\+1/);
    expect(identity.usingFallback).toBe(false);
    expect(identity.showOfficialBadge).toBe(false);
  });

  it('falls back to WhatsApp Business when no company name is written', () => {
    const identity = resolveWhatsAppPreviewIdentity({
      companyName: '  ',
      phoneNumber: '919876543210',
    });

    expect(identity.title).toBe(WHATSAPP_BUSINESS_FALLBACK);
    expect(identity.initials).toBe('');
    expect(identity.usingFallback).toBe(true);
    expect(identity.subtitle).toBeTruthy();
  });

  it('only shows the official badge when Meta marks the account official', () => {
    expect(
      resolveWhatsAppPreviewIdentity({
        companyName: 'Acme',
        officialBusinessAccount: true,
      }).showOfficialBadge,
    ).toBe(true);
  });
});

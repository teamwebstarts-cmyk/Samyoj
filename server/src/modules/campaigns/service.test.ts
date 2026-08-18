import { describe, expect, it } from 'vitest';
import { recipientsToCsv, canEditCampaign, canRescheduleCampaign } from './service';

/* ── recipientsToCsv ───────────────────────────────────────────────── */

describe('recipientsToCsv', () => {
  it('generates header + one row for a single recipient', () => {
    const csv = recipientsToCsv([
      {
        phone: '919876543210',
        name: 'Alice',
        status: 'SENT',
        errorMessage: null,
        sentAt: new Date('2026-08-01T10:00:00.000Z'),
        deliveredAt: null,
        readAt: null,
      },
    ]);

    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('phone,name,status,error,sent_at,delivered_at,read_at');
    expect(lines[1]).toContain('"919876543210"');
    expect(lines[1]).toContain('"Alice"');
    expect(lines[1]).toContain('"SENT"');
  });

  it('handles empty name and empty error gracefully', () => {
    const csv = recipientsToCsv([
      { phone: '14155552671', name: null, status: 'FAILED', errorMessage: null },
    ]);
    const row = csv.split('\n')[1];
    expect(row).toContain('""');  // empty name
    expect(row).toContain('""');  // empty error
  });

  it('escapes double quotes in error messages', () => {
    const csv = recipientsToCsv([
      {
        phone: '123',
        name: 'Bob',
        status: 'FAILED',
        errorMessage: 'He said "retry"',
        sentAt: null,
        deliveredAt: null,
        readAt: null,
      },
    ]);
    const row = csv.split('\n')[1];
    expect(row).toContain('"He said ""retry"""');
  });

  it('returns only header for empty array', () => {
    const csv = recipientsToCsv([]);
    expect(csv).toBe('phone,name,status,error,sent_at,delivered_at,read_at');
  });

  it('formats Date fields as ISO strings', () => {
    const sent = new Date('2026-08-10T12:00:00.000Z');
    const csv = recipientsToCsv([
      {
        phone: '911',
        name: 'X',
        status: 'READ',
        errorMessage: null,
        sentAt: sent,
        deliveredAt: sent,
        readAt: sent,
      },
    ]);
    const row = csv.split('\n')[1];
    expect(row).toContain('"2026-08-10T12:00:00.000Z"');
  });

  it('handles multiple recipients', () => {
    const csv = recipientsToCsv([
      { phone: '1', name: 'A', status: 'SENT', errorMessage: null, sentAt: null, deliveredAt: null, readAt: null },
      { phone: '2', name: 'B', status: 'FAILED', errorMessage: 'err', sentAt: null, deliveredAt: null, readAt: null },
    ]);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('"1"');
    expect(lines[2]).toContain('"2"');
  });
});

/* ── canEditCampaign ────────────────────────────────────────────────── */

describe('canEditCampaign', () => {
  it('returns true for DRAFT', () => {
    expect(canEditCampaign('DRAFT')).toBe(true);
  });

  it('returns true for SCHEDULED', () => {
    expect(canEditCampaign('SCHEDULED')).toBe(true);
  });

  it.each(['RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED'])(
    'returns false for %s',
    (status) => {
      expect(canEditCampaign(status)).toBe(false);
    }
  );
});

/* ── canRescheduleCampaign ──────────────────────────────────────────── */

describe('canRescheduleCampaign', () => {
  it.each(['DRAFT', 'SCHEDULED', 'COMPLETED'])('returns true for %s', (status) => {
    expect(canRescheduleCampaign(status)).toBe(true);
  });

  it.each(['RUNNING', 'PAUSED', 'FAILED', 'CANCELLED'])('returns false for %s', (status) => {
    expect(canRescheduleCampaign(status)).toBe(false);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { lookup } from 'node:dns/promises';
import { describeUnsafeWebhookUrl, isPrivateOrReservedIp, resolveWebhookPin } from './safe-webhook-url';
import { AppError } from './response';

vi.mock('node:dns/promises', () => ({
  lookup: vi.fn(),
}));

const mockedLookup = vi.mocked(lookup);

describe('isPrivateOrReservedIp', () => {
  it('blocks loopback, RFC1918, link-local, and metadata ranges', () => {
    expect(isPrivateOrReservedIp('127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('10.0.0.5')).toBe(true);
    expect(isPrivateOrReservedIp('192.168.1.20')).toBe(true);
    expect(isPrivateOrReservedIp('172.16.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('169.254.169.254')).toBe(true);
    expect(isPrivateOrReservedIp('0.0.0.0')).toBe(true);
    expect(isPrivateOrReservedIp('::1')).toBe(true);
    expect(isPrivateOrReservedIp('::ffff:127.0.0.1')).toBe(true);
  });

  it('allows public unicast addresses', () => {
    expect(isPrivateOrReservedIp('8.8.8.8')).toBe(false);
    expect(isPrivateOrReservedIp('1.1.1.1')).toBe(false);
  });
});

describe('describeUnsafeWebhookUrl', () => {
  it('requires HTTPS', () => {
    expect(describeUnsafeWebhookUrl('http://example.com/hook')).toMatch(/HTTPS/i);
  });

  it('rejects localhost and literal private IPs', () => {
    expect(describeUnsafeWebhookUrl('https://localhost/hook')).toMatch(/private or internal/i);
    expect(describeUnsafeWebhookUrl('https://127.0.0.1/hook')).toMatch(/private or reserved/i);
    expect(describeUnsafeWebhookUrl('https://192.168.0.10/callback')).toMatch(/private or reserved/i);
  });

  it('allows a public HTTPS URL at the sync layer', () => {
    expect(describeUnsafeWebhookUrl('https://example.com/webhooks/samyoj')).toBeNull();
  });
});

describe('resolveWebhookPin', () => {
  it('pins TCP to the resolved public IP while keeping TLS SNI on the hostname', async () => {
    mockedLookup.mockResolvedValue([{ address: '1.1.1.1', family: 4 }] as never);
    const pin = await resolveWebhookPin('https://hooks.example.com/samyoj?x=1');
    expect(pin.connectIp).toBe('1.1.1.1');
    expect(pin.servername).toBe('hooks.example.com');
    expect(pin.hostHeader).toBe('hooks.example.com');
    expect(pin.path).toBe('/samyoj?x=1');
  });

  it('rejects when DNS returns a private address', async () => {
    mockedLookup.mockResolvedValue([{ address: '127.0.0.1', family: 4 }] as never);
    await expect(resolveWebhookPin('https://evil.example.com/hook')).rejects.toBeInstanceOf(AppError);
  });
});

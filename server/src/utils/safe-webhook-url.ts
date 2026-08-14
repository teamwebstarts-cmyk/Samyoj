import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { AppError } from './response';

const BLOCKED_HOSTS = new Set([
  'localhost',
  'metadata.google.internal',
  'metadata.google.com',
  'kubernetes',
  'kubernetes.default',
  'kubernetes.default.svc',
]);

const V4_BLOCKS = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.0.2.0/24',
  '192.168.0.0/16',
  '198.18.0.0/15',
  '198.51.100.0/24',
  '203.0.113.0/24',
  '224.0.0.0/4',
  '240.0.0.0/4',
  '255.255.255.255/32',
];

function ipv4ToInt(ip: string): number {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => !Number.isInteger(p) || p < 0 || p > 255)) {
    return -1;
  }
  return ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

function inCidrV4(ip: string, cidr: string): boolean {
  const [base, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base);
  if (ipInt < 0 || baseInt < 0 || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipInt >>> 0 & mask) === (baseInt >>> 0 & mask);
}

export function isPrivateOrReservedIp(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) {
    return V4_BLOCKS.some((cidr) => inCidrV4(ip, cidr));
  }
  if (version === 6) {
    const normalized = ip.toLowerCase();
    if (normalized === '::' || normalized === '::1') return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    if (normalized.startsWith('fe80:')) return true;
    if (normalized.startsWith('2001:db8:')) return true;
    if (normalized.startsWith('::ffff:')) {
      const mapped = normalized.slice('::ffff:'.length);
      if (isIP(mapped) === 4) return isPrivateOrReservedIp(mapped);
    }
    return false;
  }
  return true;
}

function hostnameLooksInternal(hostname: string): boolean {
  if (BLOCKED_HOSTS.has(hostname)) return true;
  return (
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan')
  );
}

/** Sync URL checks (protocol, host, literal IPs). DNS is done in assertSafeWebhookUrl. */
export function describeUnsafeWebhookUrl(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return 'Webhook URL is invalid';
  }

  if (url.protocol !== 'https:') {
    return 'Webhook URL must use HTTPS';
  }
  if (url.username || url.password) {
    return 'Webhook URL must not include credentials';
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!hostname) return 'Webhook URL is missing a hostname';
  if (hostnameLooksInternal(hostname)) {
    return 'Webhook URL must not target a private or internal host';
  }

  if (isIP(hostname) && isPrivateOrReservedIp(hostname)) {
    return 'Webhook URL must not target a private or reserved address';
  }

  return null;
}

export async function assertSafeWebhookUrl(rawUrl: string): Promise<URL> {
  const syncError = describeUnsafeWebhookUrl(rawUrl);
  if (syncError) {
    throw new AppError(400, syncError, 'UNSAFE_WEBHOOK_URL');
  }

  const url = new URL(rawUrl);
  const hostname = url.hostname.replace(/^\[|\]$/g, '');

  if (isIP(hostname)) {
    return url;
  }

  let addresses: Array<{ address: string }>;
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new AppError(400, 'Webhook hostname could not be resolved', 'UNSAFE_WEBHOOK_URL');
  }

  if (!addresses.length) {
    throw new AppError(400, 'Webhook hostname could not be resolved', 'UNSAFE_WEBHOOK_URL');
  }

  for (const record of addresses) {
    if (isPrivateOrReservedIp(record.address)) {
      throw new AppError(
        400,
        'Webhook URL must not resolve to a private or reserved address',
        'UNSAFE_WEBHOOK_URL'
      );
    }
  }

  return url;
}

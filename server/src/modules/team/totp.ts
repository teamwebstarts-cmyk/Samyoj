import crypto from 'crypto';

const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_CHARS[(value << (5 - bits)) & 31];
  }
  return output;
}

function base32Decode(input: string): Buffer {
  const cleaned = input.replace(/=+$/, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of cleaned) {
    const idx = BASE32_CHARS.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function generateTotp(secret: Buffer, counter: number, digits = 6): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 10 ** digits).padStart(digits, '0');
}

export function otpauthUrlForSecret(
  email: string,
  secret: string,
  issuerName = 'WhatsApp Platform'
): string {
  const issuer = encodeURIComponent(issuerName);
  const account = encodeURIComponent(email);
  return `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&digits=6&period=30`;
}

export function generateTwoFactorSecret(
  email: string,
  issuerName = 'WhatsApp Platform'
): { secret: string; otpauthUrl: string } {
  const raw = crypto.randomBytes(20);
  const secret = base32Encode(raw);
  return {
    secret,
    otpauthUrl: otpauthUrlForSecret(email, secret, issuerName),
  };
}

export function enrollmentFromSecret(
  email: string,
  secret: string,
  issuerName = 'WhatsApp Platform'
): { secret: string; otpauthUrl: string } {
  return {
    secret,
    otpauthUrl: otpauthUrlForSecret(email, secret, issuerName),
  };
}

export function verifyTotp(secret: string, token: string, window = 1): boolean {
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 30000);
  for (let i = -window; i <= window; i++) {
    const expected = generateTotp(key, counter + i);
    if (
      expected.length === token.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(token))
    ) {
      return true;
    }
  }
  return false;
}

export function generateBackupCodes(count = 8): string[] {
  return Array.from({ length: count }, () =>
    crypto.randomBytes(4).toString('hex').toUpperCase()
  );
}

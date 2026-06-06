import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';

export function encrypt(text: string): string {
  const key = Buffer.from(config.encryptionKey.slice(0, 64), 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const key = Buffer.from(config.encryptionKey.slice(0, 64), 'hex');
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + config.jwt.secret).digest('hex');
}

// Use bcrypt in auth service instead - this is a fallback
export { default as bcryptHash } from 'bcryptjs';

import { config } from './index';
import logger from '../utils/logger';

const DEFAULT_VERIFY_TOKEN = 'whatsapp_verify_token';
const DEFAULT_JWT_SECRET = 'dev-secret';
const DEFAULT_JWT_REFRESH = 'dev-refresh-secret';

function isValidEncryptionKey(key: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(key);
}

function looksWeakSecret(secret: string): boolean {
  return !secret || secret.length < 32 || secret === DEFAULT_JWT_SECRET || secret === DEFAULT_JWT_REFRESH;
}

export function validateConfig(): void {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProd = config.nodeEnv === 'production';

  if (!config.databaseUrl) {
    errors.push('DATABASE_URL is required');
  }

  if (looksWeakSecret(config.jwt.secret)) {
    if (isProd) errors.push('JWT_SECRET must be a strong secret (32+ chars), not the default');
    else warnings.push('JWT_SECRET is weak/default — generate a strong value for any shared env');
  }
  if (looksWeakSecret(config.jwt.refreshSecret)) {
    if (isProd) errors.push('JWT_REFRESH_SECRET must be a strong secret (32+ chars), not the default');
    else warnings.push('JWT_REFRESH_SECRET is weak/default — generate a strong value for any shared env');
  }

  if (isProd) {
    if (!config.encryptionKey || !isValidEncryptionKey(config.encryptionKey)) {
      errors.push('ENCRYPTION_KEY must be a 64-character hex string in production');
    }
    if (!config.meta.appSecret) {
      logger.warn(
        'META_APP_SECRET is not set globally — each organization must configure Meta credentials in Settings',
        { source: 'startup' }
      );
    }
    if (!config.meta.verifyToken || config.meta.verifyToken === DEFAULT_VERIFY_TOKEN) {
      errors.push('META_VERIFY_TOKEN must be set to a non-default value in production');
    }
    if (!config.email.smtpHost) {
      warnings.push('SMTP_HOST is not set — password reset and email verification will only log emails');
    }
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      warnings.push('Google OAuth not configured — Continue with Google will be unavailable');
    }
  } else {
    if (!process.env.GOOGLE_CLIENT_ID) {
      warnings.push('GOOGLE_CLIENT_ID missing — Google login disabled until you add it to server/.env');
    }
    if (!config.email.smtpHost) {
      warnings.push('SMTP not configured — forgot-password / verify-email links will be logged to server logs only');
    }
  }

  for (const w of warnings) {
    logger.warn(`Config: ${w}`, { source: 'startup' });
  }

  if (errors.length > 0) {
    for (const err of errors) {
      logger.error(`Config validation failed: ${err}`, { source: 'startup' });
    }
    process.exit(1);
  }
}

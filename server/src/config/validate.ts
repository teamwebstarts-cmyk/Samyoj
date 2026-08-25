import { config } from './index';
import logger from '../utils/logger';

const DEFAULT_VERIFY_TOKEN = 'whatsapp_verify_token';
const DEFAULT_JWT_SECRET = 'dev-secret';
const DEFAULT_JWT_REFRESH = 'dev-refresh-secret';

function isValidEncryptionKey(key: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(key);
}

export function looksWeakSecret(secret: string): boolean {
  return !secret || secret.length < 32 || secret === DEFAULT_JWT_SECRET || secret === DEFAULT_JWT_REFRESH;
}

/** Weak JWT fallbacks are allowed only for explicit local development. */
export function jwtDevFallbackAllowed(nodeEnv = process.env.NODE_ENV): boolean {
  return nodeEnv === 'development';
}

export function jwtSecretErrors(
  nodeEnv: string | undefined,
  secret: string,
  refreshSecret: string
): string[] {
  const errors: string[] = [];
  if (looksWeakSecret(secret) && !jwtDevFallbackAllowed(nodeEnv)) {
    errors.push('JWT_SECRET must be a strong secret (32+ chars), not the default');
  }
  if (looksWeakSecret(refreshSecret) && !jwtDevFallbackAllowed(nodeEnv)) {
    errors.push('JWT_REFRESH_SECRET must be a strong secret (32+ chars), not the default');
  }
  return errors;
}

export function platformAdminUrlErrors(
  nodeEnv: string | undefined,
  value: string
): string[] {
  try {
    const url = new URL(value);
    const isOriginOnly =
      url.pathname === '/' &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password;
    if (!isOriginOnly) {
      return ['PLATFORM_ADMIN_URL must be an origin without a path, query, or credentials'];
    }
    if (nodeEnv === 'production' && url.protocol !== 'https:') {
      return ['PLATFORM_ADMIN_URL must use HTTPS in production'];
    }
    return [];
  } catch {
    return ['PLATFORM_ADMIN_URL must be a valid absolute URL'];
  }
}

export function validateConfig(): void {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProd = config.nodeEnv === 'production';
  const allowDevJwt = jwtDevFallbackAllowed(process.env.NODE_ENV);

  if (!config.databaseUrl) {
    errors.push('DATABASE_URL is required');
  }

  errors.push(...jwtSecretErrors(process.env.NODE_ENV, config.jwt.secret, config.jwt.refreshSecret));
  errors.push(...platformAdminUrlErrors(process.env.NODE_ENV, config.platformAdminUrl));
  if (allowDevJwt && looksWeakSecret(config.jwt.secret)) {
    warnings.push('JWT_SECRET is weak/default — generate a strong value for any shared env');
  }
  if (allowDevJwt && looksWeakSecret(config.jwt.refreshSecret)) {
    warnings.push('JWT_REFRESH_SECRET is weak/default — generate a strong value for any shared env');
  }

  if (isProd) {
    if (!process.env.PLATFORM_ADMIN_URL) {
      errors.push('PLATFORM_ADMIN_URL is required in production');
    }
    const hasRazorpayKey = Boolean(config.razorpay.keyId && config.razorpay.keySecret);
    const hasRazorpayWebhook = Boolean(config.razorpay.webhookSecret);
    if (!hasRazorpayKey) {
      warnings.push('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET not set — paid checkout will be disabled');
    }
    if (hasRazorpayKey && !hasRazorpayWebhook) {
      errors.push('RAZORPAY_WEBHOOK_SECRET is required in production when Razorpay keys are configured');
    }
    if (!config.encryptionKey || !isValidEncryptionKey(config.encryptionKey)) {
      errors.push('ENCRYPTION_KEY must be a 64-character hex string in production');
    }
    if (!config.meta.appSecret) {
      logger.warn(
        'META_APP_SECRET is not set — put META_APP_ID / META_APP_SECRET in server/.env (platform credentials only; Settings UI never collects them)',
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

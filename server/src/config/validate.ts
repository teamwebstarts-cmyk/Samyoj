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
  refreshSecret: string,
  oauthStateSecret?: string
): string[] {
  const errors: string[] = [];
  if (looksWeakSecret(secret) && !jwtDevFallbackAllowed(nodeEnv)) {
    errors.push('JWT_SECRET must be a strong secret (32+ chars), not the default');
  }
  if (looksWeakSecret(refreshSecret) && !jwtDevFallbackAllowed(nodeEnv)) {
    errors.push('JWT_REFRESH_SECRET must be a strong secret (32+ chars), not the default');
  }
  if (oauthStateSecret !== undefined && looksWeakSecret(oauthStateSecret) && !jwtDevFallbackAllowed(nodeEnv)) {
    errors.push('OAUTH_STATE_SECRET must be a strong secret (32+ chars), not the default');
  }
  return errors;
}

const META_CALLBACK_PATHS = new Set([
  '/settings/whatsapp/callback',
  '/settings/whatsapp/callback/popup',
]);

function isDurableMetaWebhookUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname || '';
    if (!host || /localhost|127\.0\.0\.1|ngrok/i.test(host)) return false;
    return parsed.pathname.includes('/api/whatsapp/webhook');
  } catch {
    return false;
  }
}

function isProductionMetaRedirectUri(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname || '';
    if (!host || /localhost|127\.0\.0\.1|ngrok|\.app\.github\.dev$/i.test(host)) return false;
    const path = parsed.pathname.replace(/\/$/, '');
    return META_CALLBACK_PATHS.has(path) && !parsed.search && !parsed.hash;
  } catch {
    return false;
  }
}

export type ProductionMetaConnectSnapshot = {
  appId: string;
  appSecret: string;
  esConfigId: string;
  connectFlow: string;
  allowTunnelWebhook: boolean;
  webhookUrl: string;
  productionWebhookUrl: string;
  redirectUri: string;
};

/** Fail-closed Tech Provider Connect on VPS. Dev still warns instead of exiting. */
export function productionMetaConnectErrors(snap: ProductionMetaConnectSnapshot): string[] {
  const errors: string[] = [];
  if (!snap.appId) errors.push('META_APP_ID is required in production');
  if (!snap.appSecret) errors.push('META_APP_SECRET is required in production');
  if (!snap.esConfigId) {
    errors.push('META_ES_CONFIG_ID is required in production (Facebook Login for Business configuration ID)');
  }
  if (/^(oauth|legacy_oauth)$/i.test(snap.connectFlow)) {
    errors.push('META_CONNECT_FLOW=oauth is not allowed in production — use Embedded Signup v4 (omit META_CONNECT_FLOW or set es_v4)');
  }
  if (snap.allowTunnelWebhook) {
    errors.push('META_ALLOW_TUNNEL_WEBHOOK must not be set on the VPS');
  }
  if (!isDurableMetaWebhookUrl(snap.webhookUrl) && !isDurableMetaWebhookUrl(snap.productionWebhookUrl)) {
    errors.push(
      'META_WEBHOOK_URL or META_PRODUCTION_WEBHOOK_URL must be a durable https callback (e.g. https://app.samyoj.com/api/whatsapp/webhook)'
    );
  }
  if (snap.redirectUri && !isProductionMetaRedirectUri(snap.redirectUri)) {
    errors.push(
      'META_REDIRECT_URI must be https://app.samyoj.com/settings/whatsapp/callback or .../callback/popup in production'
    );
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

export function productionAuthErrors(env: Record<string, string | undefined>): string[] {
  const errors: string[] = [];
  if (env.ALLOW_UNVERIFIED_LOGIN === 'true') {
    errors.push('ALLOW_UNVERIFIED_LOGIN must be false or unset in production');
  }
  if (env.PLATFORM_MFA_REQUIRED !== 'true') {
    errors.push('PLATFORM_MFA_REQUIRED=true is required in production');
  }
  return errors;
}

export function validateConfig(): void {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProd = config.nodeEnv === 'production';
  const allowDevJwt = jwtDevFallbackAllowed(process.env.NODE_ENV);

  if (!config.databaseUrl) {
    errors.push('DATABASE_URL is required');
  }

  errors.push(
    ...jwtSecretErrors(
      process.env.NODE_ENV,
      config.jwt.secret,
      config.jwt.refreshSecret,
      config.jwt.oauthStateSecret
    )
  );
  errors.push(...platformAdminUrlErrors(process.env.NODE_ENV, config.platformAdminUrl));
  if (allowDevJwt && looksWeakSecret(config.jwt.secret)) {
    warnings.push('JWT_SECRET is weak/default — generate a strong value for any shared env');
  }
  if (allowDevJwt && looksWeakSecret(config.jwt.refreshSecret)) {
    warnings.push('JWT_REFRESH_SECRET is weak/default — generate a strong value for any shared env');
  }

  if (isProd) {
    errors.push(...productionAuthErrors(process.env));
    if (config.billing.allowTestBypass) {
      errors.push('BILLING_TEST_BYPASS must be disabled in production');
    }
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
    if (!config.billing.supplierGstin || !config.billing.supplierAddress || !config.billing.supplierStateCode) {
      warnings.push(
        'BILLING_SUPPLIER_GSTIN, BILLING_SUPPLIER_ADDRESS, and BILLING_SUPPLIER_STATE_CODE must be set for issued GST invoices'
      );
    }
    errors.push(
      ...productionMetaConnectErrors({
        appId: config.meta.appId,
        appSecret: config.meta.appSecret,
        esConfigId: config.meta.esConfigId,
        connectFlow: config.meta.connectFlow,
        allowTunnelWebhook: config.meta.allowTunnelWebhook,
        webhookUrl: config.meta.webhookUrl,
        productionWebhookUrl: config.meta.productionWebhookUrl,
        redirectUri: config.meta.redirectUri,
      })
    );
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
    if (!config.meta.esConfigId) {
      warnings.push(
        'META_ES_CONFIG_ID is not set — Connect WhatsApp will return 503 until you copy the Embedded Signup v4 Configuration ID into server/.env'
      );
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

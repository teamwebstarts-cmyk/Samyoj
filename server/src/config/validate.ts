import { config } from './index';
import logger from '../utils/logger';

const DEFAULT_VERIFY_TOKEN = 'whatsapp_verify_token';
const DEFAULT_JWT_SECRET = 'dev-secret';
const DEFAULT_JWT_REFRESH = 'dev-refresh-secret';

function isValidEncryptionKey(key: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(key);
}

export function validateConfig(): void {
  const errors: string[] = [];
  const isProd = config.nodeEnv === 'production';

  if (!config.databaseUrl) {
    errors.push('DATABASE_URL is required');
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
    if (config.jwt.secret === DEFAULT_JWT_SECRET) {
      errors.push('JWT_SECRET must not use the default dev-secret in production');
    }
    if (config.jwt.refreshSecret === DEFAULT_JWT_REFRESH) {
      errors.push('JWT_REFRESH_SECRET must not use the default dev-refresh-secret in production');
    }
  }

  if (errors.length > 0) {
    for (const err of errors) {
      logger.error(`Config validation failed: ${err}`, { source: 'startup' });
    }
    process.exit(1);
  }
}

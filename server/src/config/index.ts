import dotenv from 'dotenv';
dotenv.config();

const defaultPort = 8000;
const defaultBaseUrl = `http://localhost:${defaultPort}`;
const defaultClientUrl = 'http://localhost:3000';

function resolveBrainProvider(): 'sarvam' | 'azure' {
  const v = (process.env.AI_BRAIN_PROVIDER || 'sarvam').toLowerCase();
  return v === 'azure' ? 'azure' : 'sarvam';
}

export const config = {
  port: parseInt(process.env.PORT || String(defaultPort), 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  clientUrl: process.env.CLIENT_URL || defaultClientUrl,
  baseUrl:
    process.env.BASE_URL ||
    process.env.SERVER_URL ||
    process.env.API_URL ||
    defaultBaseUrl,
  serverUrl:
    process.env.BASE_URL ||
    process.env.SERVER_URL ||
    process.env.API_URL ||
    defaultBaseUrl,
  databaseUrl: process.env.DATABASE_URL!,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  meta: {
    appId: process.env.META_APP_ID || '',
    appSecret: process.env.META_APP_SECRET || '',
    verifyToken: process.env.META_VERIFY_TOKEN || 'whatsapp_verify_token',
    apiVersion: process.env.META_API_VERSION || 'v21.0',
    redirectUri: process.env.META_REDIRECT_URI || 'http://localhost:3000/settings/whatsapp/callback',
    webhookUrl: process.env.META_WEBHOOK_URL || '',
  },
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  /** AI brain configuration — Sarvam is the default brain provider. */
  ai: {
    /** 'sarvam' | 'azure' — platform-wide brain provider. Org override via OrgAiSettings.brainProvider. */
    brainProvider: resolveBrainProvider(),
  },
  /** Sarvam AI — one vendor for chat brain + voice STT/TTS. */
  sarvam: {
    apiKey: process.env.SARVAM_API_KEY || '',
    chatModel: process.env.SARVAM_CHAT_MODEL || 'sarvam-105b',
    /** Fast model for voice calls — 3-5× lower latency than sarvam-105b. */
    voiceChatModel: process.env.SARVAM_VOICE_CHAT_MODEL || 'sarvam-105b-conversations',
    chatTimeoutMs: parseInt(process.env.SARVAM_CHAT_TIMEOUT_MS || '30000', 10),
    /** Chat completions endpoint — OpenAI-compatible. */
    chatEndpoint: process.env.SARVAM_CHAT_ENDPOINT || 'https://api.sarvam.ai/v1',
    sttModel: process.env.SARVAM_STT_MODEL || 'saaras:v3-realtime',
    sttMode: (process.env.SARVAM_STT_MODE || 'codemix') as 'codemix' | 'transcribe',
    sttLanguage: process.env.SARVAM_STT_LANGUAGE || 'auto',
    ttsModel: process.env.SARVAM_TTS_MODEL || 'bulbul:v3',
    ttsSpeaker: process.env.SARVAM_TTS_SPEAKER || 'shubh',
    sampleRate: parseInt(process.env.SARVAM_SAMPLE_RATE || '16000', 10),
  },
  /** Legacy Azure config — kept only for embeddings (Sarvam has no vector API). */
  azure: {
    endpoint: (process.env.AZURE_OPENAI_ENDPOINT || '').replace(/\/$/, ''),
    apiKey: process.env.AZURE_OPENAI_API_KEY || '',
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-35-turbo',
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview',
  },
  calling: {
    /** Voice provider — always sarvam. Legacy deepgram_google removed. */
    voiceProvider: 'sarvam' as const,
    aiAutoAnswer: process.env.CALLING_AI_AUTO_ANSWER !== 'false',
    aiGreeting:
      process.env.CALLING_AI_GREETING ||
      'Hello! Thank you for calling. How can I help you today?',
  },
  email: {
    from: process.env.EMAIL_FROM || 'noreply@whatsapp-platform.local',
    smtpHost: process.env.SMTP_HOST || '',
    smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
    smtpUser: process.env.SMTP_USER || '',
    smtpPass: process.env.SMTP_PASS || '',
    smtpSecure: process.env.SMTP_SECURE === 'true',
  },
  storage: {
    driver: (process.env.STORAGE_DRIVER || 'local') as 'local' | 's3',
    s3Bucket: process.env.S3_BUCKET || '',
    s3Region: process.env.S3_REGION || 'us-east-1',
    s3AccessKey: process.env.S3_ACCESS_KEY || '',
    s3SecretKey: process.env.S3_SECRET_KEY || '',
    s3PublicUrl: process.env.S3_PUBLIC_URL || '',
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },
  alerts: {
    checkIntervalMs: parseInt(process.env.ALERT_CHECK_INTERVAL_MS || '30000', 10),
    defaultSlaMinutes: parseInt(process.env.DEFAULT_SLA_MINUTES || '15', 10),
  },
  sentry: {
    dsn: process.env.SENTRY_DSN || '',
  },
};

import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
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
    redirectUri: process.env.META_REDIRECT_URI || 'http://localhost:5173/settings/whatsapp/callback',
    webhookUrl: process.env.META_WEBHOOK_URL || '',
  },
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  azureOpenAI: {
    endpoint: (process.env.AZURE_OPENAI_ENDPOINT || '').replace(/\/$/, ''),
    apiKey: process.env.AZURE_OPENAI_API_KEY || '',
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-35-turbo',
    apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-12-01-preview',
  },
  calling: {
    deepgramApiKey: process.env.DEEPGRAM_API_KEY || '',
    deepgramLanguage: process.env.DEEPGRAM_LANGUAGE || 'hi',
    deepgramSampleRate: parseInt(process.env.DEEPGRAM_SAMPLE_RATE || '48000', 10),
    googleCredentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || 'key.json',
    googleTtsVoice: process.env.GOOGLE_TTS_VOICE || 'en-IN-Neural2-A',
    googleTtsLanguage: process.env.GOOGLE_TTS_LANGUAGE || 'en-IN',
    aiAutoAnswer: process.env.CALLING_AI_AUTO_ANSWER !== 'false',
    aiGreeting:
      process.env.CALLING_AI_GREETING ||
      'Hello! Thank you for calling. How can I help you today?',
  },
};

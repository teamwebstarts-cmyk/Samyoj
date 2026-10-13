import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config } from './config';
import { corsOriginDelegate, platformCorsOriginDelegate } from './config/cors';
import { clientBuildExists, getAdminPaths, getClientPaths, adminBuildExists } from './config/paths';
import { validateConfig } from './config/validate';
import { isPlatformAdminHost } from './config/admin-host';
import { helmetContentSecurityPolicyDirectives } from './config/csp';
import { initSentry } from './config/sentry';
import { errorHandler, logError, setupGlobalErrorHandlers } from './errors';
import logger, { requestLogger } from './utils/logger';
import { socketAuthMiddleware, startMembershipGuard } from './middleware/socket-auth';
import { requireTenantCsrf } from './middleware/tenant-csrf';
import { skipGlobalHttpRateLimit } from './middleware/http-rate-limit';
import prisma from './config/database';
import Redis from 'ioredis';

import authRoutes from './modules/auth/routes';
import whatsappRoutes from './modules/whatsapp/routes';
import facebookRoutes from './modules/facebook/routes';
import instagramRoutes from './modules/instagram';
import inboxRoutes from './modules/inbox/routes';
import automationRoutes from './modules/automation/routes';
import flowRoutes from './modules/flows/routes';
import flowAssetsRoutes from './modules/flows-assets/routes';
import settingsRoutes from './modules/settings/routes';
import campaignRoutes from './modules/campaigns/routes';
import contactRoutes from './modules/contacts/routes';
import analyticsRoutes from './modules/analytics/routes';
import templateRoutes from './modules/templates/routes';
import messageRoutes from './modules/messages/routes';
import teamRoutes from './modules/team/routes';
import aiBotRoutes from './modules/ai-bot/routes';
import callingRoutes from './modules/calling/routes';
import labelRoutes from './modules/labels/routes';
import cannedReplyRoutes from './modules/canned-replies/routes';
import billingRoutes from './modules/billing/routes';
import complianceRoutes from './modules/compliance/routes';
import integrationsRoutes from './modules/integrations/routes';
import waFormsRoutes from './modules/wa-forms/routes';
import onboardingRoutes from './modules/onboarding/routes';
import publicMediaRoutes from './modules/media/public.routes';
import mediaRoutes from './modules/media/routes';
import catalogRoutes from './modules/catalog/routes';
import commerceRoutes from './modules/commerce/routes';
import contentStudioRoutes from './modules/content-studio/routes';
import aiStudioRoutes from './modules/ai-studio/routes';
import publicApiRoutes from './modules/public-api/routes';
import leadRoutes from './modules/leads/routes';
import ticketRoutes from './modules/tickets/routes';
import supportRoutes from './modules/support/routes';
import gmailRoutes from './modules/gmail/routes';
import platformRoutes from './modules/platform/routes';
import { setRealtimeIO } from './realtime';
import { registerPresenceHandlers, startPresenceSweeper } from './modules/inbox/presence';
import { registerCallingPreviewHandlers } from './modules/ai-bot/calling-preview.socket';
import { initTelemetry } from './config/telemetry';
import { attachOpsErrorFileTransport } from './modules/ops/error-log';
import { refreshBillingConfig } from './modules/billing/config';

const app = express();
const httpServer = createServer(app);
const customerCors = cors({
  origin: corsOriginDelegate,
  credentials: true,
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-WhatsApp-Number-Id',
    'X-File-Name',
    'X-File-Mime-Type',
    'Idempotency-Key',
    'x-csrf-token',
  ],
});
const platformCors = cors({
  origin: platformCorsOriginDelegate,
  credentials: true,
  allowedHeaders: ['Content-Type', 'x-platform-csrf-token'],
});

app.set('trust proxy', 1);
app.set('etag', false);

/** Under `/api` so Path=/api HttpOnly cookies are sent on the handshake. */
export const SOCKET_IO_PATH = '/api/socket.io';

const io = new Server(httpServer, {
  path: SOCKET_IO_PATH,
  cors: {
    origin: corsOriginDelegate,
    credentials: true,
  },
  transports: ['polling', 'websocket'],
});

// Socket.IO auth & rooms — JWT + OrganizationUser membership (same as HTTP requireOrg)
io.use(socketAuthMiddleware);

startPresenceSweeper(io);

io.on('connection', (socket) => {
  const user = socket.data.user;
  if (!user) {
    socket.disconnect(true);
    return;
  }
  // Membership already verified in socketAuthMiddleware — never join org:{jwtOrgId} otherwise.
  if (user.organizationId) {
    socket.join(`org:${user.organizationId}`);
  }
  if (user.userId) {
    socket.join(`user:${user.userId}`);
  }

  registerPresenceHandlers(io, socket);
  registerCallingPreviewHandlers(io, socket);

  // Periodically re-verify org membership; disconnect if user was removed.
  startMembershipGuard(socket);

  socket.on('error', (err) => {
    logError(err, {
      source: 'socket',
      userId: user?.userId,
      organizationId: user?.organizationId,
    });
  });

  socket.on('disconnect', () => {
    // cleanup handled by socket.io
  });
});

io.engine.on('connection_error', (err) => {
  logError(err, { source: 'socket', path: 'connection_error' });
});

export { io };

const useHttps = config.baseUrl.startsWith('https://');

app.use(
  helmet({
    // Inbox <img>/<video> often load signed media from the API origin while the
    // SPA is on another origin (Vite :3000 → API :8000). Default CORP
    // "same-origin" blocks those embeds → broken stickers/images in the thread.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    // FB.login popup must keep window.opener; default same-origin kills it.
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    contentSecurityPolicy: {
      useDefaults: true,
      directives: helmetContentSecurityPolicyDirectives(useHttps),
    },
  })
);
app.use(
  (req, res, next) => {
    const isPlatformPath =
      req.path === '/api/platform' || req.path.startsWith('/api/platform/');
    const applyCors = isPlatformPath ? platformCors : customerCors;
    applyCors(req, res, next);
  }
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20_000,
    skipFailedRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => skipGlobalHttpRateLimit(req.originalUrl || req.path, req.headers.upgrade),
  })
);

function rawJsonBodyParser(req: express.Request, _res: express.Response, next: express.NextFunction) {
  if (req.method === 'POST' && Buffer.isBuffer(req.body)) {
    const raw = req.body.toString('utf8');
    req.rawBody = raw;
    try {
      req.body = JSON.parse(raw);
    } catch {
      req.body = {};
    }
  }
  next();
}

// Preserve raw body for webhook signature verification
app.use(
  '/api/whatsapp/webhook',
  express.raw({ type: 'application/json', limit: '10mb' }),
  rawJsonBodyParser
);

app.use(
  '/api/billing/webhook',
  express.raw({ type: 'application/json', limit: '1mb' }),
  rawJsonBodyParser
);

app.use(
  '/api/flows-assets/webhook/nfm',
  express.raw({ type: 'application/json', limit: '1mb' }),
  rawJsonBodyParser
);

// Instagram post media is uploaded as the original bytes. Keeping this
// route-scoped avoids base64's 4/3 expansion against the global JSON limit.
app.use(
  '/api/instagram/posts/media',
  express.raw({
    type: ['image/*', 'video/*', 'application/octet-stream'],
    limit: '100mb',
  })
);

app.use(express.json({ limit: '10mb' }));

app.use(requireTenantCsrf);

app.use(requestLogger);

app.get('/health', async (_req, res) => {
  const checks: Record<string, string> = { api: 'ok' };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = 'ok';
  } catch {
    checks.database = 'error';
  }

  try {
    const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: 1, connectTimeout: 3000 });
    await redis.ping();
    redis.disconnect();
    checks.redis = 'ok';
  } catch {
    checks.redis = 'error';
  }

  let workersStarted = false;
  try {
    const { areWorkersStarted } = await import('./workers/index');
    workersStarted = areWorkersStarted();
  } catch {
    workersStarted = false;
  }

  const healthy = Object.values(checks).every((v) => v === 'ok');
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
    workersStarted,
    version: '1.0.0',
  });
});

app.use('/api/media/public', publicMediaRoutes);
app.use('/api/media', mediaRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/facebook', facebookRoutes);
app.use('/api/instagram', instagramRoutes);
app.use('/api/inbox', inboxRoutes);
app.use('/api/automations', automationRoutes);
app.use('/api/flows', flowRoutes);
app.use('/api/flows-assets', flowAssetsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/ai-bot', aiBotRoutes);
app.use('/api/calling', callingRoutes);
app.use('/api/labels', labelRoutes);
app.use('/api/canned-replies', cannedReplyRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/compliance', complianceRoutes);
app.use('/api/integrations', integrationsRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/wa-forms', waFormsRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/commerce', commerceRoutes);
app.use('/api/content-studio', contentStudioRoutes);
app.use('/api/ai-studio', aiStudioRoutes);
app.use('/api/v1', publicApiRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/gmail', gmailRoutes);
app.use('/api/platform', platformRoutes);

const { clientDist, clientPublic } = getClientPaths();
const { adminDist, adminPublic } = getAdminPaths();
const serveClient = config.nodeEnv === 'production' || clientBuildExists();
const serveAdmin = config.nodeEnv === 'production' || adminBuildExists();

if (serveAdmin) {
  app.use((req, res, next) => {
    if (!isPlatformAdminHost(req.get('host'), config.platformAdminUrl)) {
      return next();
    }
    if (
      req.path.startsWith('/api') ||
      req.path === '/health' ||
      req.path.startsWith('/socket.io')
    ) {
      return next();
    }
    express.static(adminPublic)(req, res, (err) => {
      if (err) return next(err);
      express.static(adminDist)(req, res, (staticErr) => {
        if (staticErr) return next(staticErr);
        if (req.method !== 'GET') return next();
        res.sendFile(path.join(adminDist, 'index.html'), (sendErr) => {
          if (sendErr) next(sendErr);
        });
      });
    });
  });
}

if (serveClient) {
  app.use((req, res, next) => {
    if (isPlatformAdminHost(req.get('host'), config.platformAdminUrl)) {
      return next();
    }
    next();
  });
  app.use(express.static(clientPublic));
  app.use(express.static(clientDist));

  app.get('*', (req, res, next) => {
    if (req.method !== 'GET') return next();
    if (
      req.path.startsWith('/api') ||
      req.path === '/health' ||
      req.path.startsWith('/socket.io')
    ) {
      return next();
    }
    if (isPlatformAdminHost(req.get('host'), config.platformAdminUrl)) {
      return next();
    }
    res.sendFile(path.join(clientDist, 'index.html'), (err) => {
      if (err) next(err);
    });
  });
}

app.use(errorHandler);

async function listen(): Promise<void> {
  return new Promise((resolve, reject) => {
    const onError = (err: NodeJS.ErrnoException) => {
      httpServer.off('listening', onListening);

      if (err.code === 'EADDRINUSE') {
        logger.error(
          `Port ${config.port} is already in use. Stop the other server (e.g. root "npm run dev") before starting another instance.`,
          { source: 'startup', port: config.port }
        );
        process.exit(1);
      }

      reject(err);
    };

    const onListening = () => {
      httpServer.off('error', onError);
      resolve();
    };

    httpServer.once('error', onError);
    httpServer.once('listening', onListening);
    httpServer.listen(config.port);
  });
}

async function start() {
  validateConfig();
  initTelemetry();
  attachOpsErrorFileTransport();
  await initSentry();
  setupGlobalErrorHandlers();
  setRealtimeIO(io);
  await refreshBillingConfig();

  await listen();

  // On restart, any in-flight calls lost their in-memory AI sessions (WebRTC bridge, STT, TTS).
  // Mark them TERMINATED so they don't stay stuck in "Listening..." forever.
  try {
    const stuck = await prisma.call.updateMany({
      where: { status: { in: ['RINGING', 'CONNECTING', 'CONNECTED'] } },
      data: { status: 'TERMINATED', endedAt: new Date() },
    });
    if (stuck.count > 0) {
      logger.warn(`Startup cleanup: marked ${stuck.count} stale call(s) as TERMINATED`, {
        source: 'startup',
      });
    }
  } catch (err) {
    logger.warn('Startup call cleanup failed', {
      source: 'startup',
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const { checkRedisConnection } = await import('./config/redis');
  const redisAvailable = await checkRedisConnection();

  if (redisAvailable) {
    const { hydrateWebhookHealth } = await import('./modules/whatsapp/webhook-health');
    await hydrateWebhookHealth();

    const { setSocketIO, startWorkers } = await import('./workers/index');
    setSocketIO(io);
    startWorkers();

    const { startAlertWorker } = await import('./workers/alert.worker');
    startAlertWorker();

    const { startMediaRetentionWorker } = await import('./workers/media-retention.worker');
    startMediaRetentionWorker();

    const { startPresenceSweeperWorker } = await import('./workers/presence-sweeper.worker');
    startPresenceSweeperWorker();

    // Clean stale Redis call state left from a previous crash/restart.
    // In-memory AI/WebRTC sessions are gone, but Redis keys would otherwise
    // inflate concurrent-call counts for up to 2 hours (their TTL).
    try {
      const { getRedis } = await import('./config/redis');
      const redis = getRedis();
      const activeKeys = await redis.keys('call:active:*');
      const pendingKeys = await redis.keys('call:pending:*');
      const orgSetKeys = await redis.keys('call:org:*:active');
      let cleaned = 0;
      if (activeKeys.length) {
        cleaned += await redis.del(...activeKeys);
      }
      if (pendingKeys.length) {
        cleaned += await redis.del(...pendingKeys);
      }
      if (orgSetKeys.length) {
        cleaned += await redis.del(...orgSetKeys);
      }
      if (cleaned > 0) {
        logger.info(`Startup cleanup: removed ${cleaned} stale Redis call state entries`, {
          source: 'startup',
        });
      }
    } catch (err) {
      logger.warn('Startup Redis call state cleanup failed', {
        source: 'startup',
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // Pre-warm the Sarvam voice chat model so the first call doesn't hit cold-start latency.
    if (config.sarvam.apiKey) {
      import('./modules/ai/sarvam-chat.service')
        .then(({ createSarvamChatCompletion }) =>
          createSarvamChatCompletion({
            messages: [{ role: 'user', content: 'ping' }],
            model: 'sarvam-105b-conversations',
            maxTokens: 1,
            temperature: 0,
          })
        )
        .then(() => logger.info('Sarvam voice model pre-warmed', { source: 'startup' }))
        .catch((err) =>
          logger.warn('Sarvam voice model pre-warm failed (calling will still work)', {
            source: 'startup',
            error: err instanceof Error ? err.message : String(err),
          })
        );
    }
  } else {
    logger.warn(
      `Redis is not reachable at ${config.redisUrl}. Background workers are disabled — campaigns, webhooks, and queued messages will not process.`,
      {
        source: 'startup',
        hint: 'Start Redis from the repo root: docker compose up -d',
      }
    );
  }

  logger.info('API server started', {
    source: 'startup',
    port: config.port,
    env: config.nodeEnv,
    logLevel: config.logLevel,
  });
  logger.info('WebSocket server ready', { source: 'startup' });
}

start().catch((err) => {
  logError(err, { source: 'startup', path: 'index.start' });
  process.exit(1);
});

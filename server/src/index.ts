import express from 'express';
import path from 'path';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config } from './config';
import { corsOriginDelegate } from './config/cors';
import { clientBuildExists, getClientPaths } from './config/paths';
import { validateConfig } from './config/validate';
import { initSentry } from './config/sentry';
import { errorHandler, logError, setupGlobalErrorHandlers } from './errors';
import { verifyAccessToken } from './utils/jwt';
import logger, { requestLogger } from './utils/logger';
import prisma from './config/database';
import Redis from 'ioredis';

import authRoutes from './modules/auth/routes';
import whatsappRoutes from './modules/whatsapp/routes';
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
import publicApiRoutes from './modules/public-api/routes';
import leadRoutes from './modules/leads/routes';
import ticketRoutes from './modules/tickets/routes';
import { setRealtimeIO } from './realtime';
import { registerPresenceHandlers, startPresenceSweeper } from './modules/inbox/presence';
import { initTelemetry } from './config/telemetry';

const app = express();
const httpServer = createServer(app);

app.set('trust proxy', 1);
app.set('etag', false);

const io = new Server(httpServer, {
  cors: {
    origin: corsOriginDelegate,
    credentials: true,
  },
});

// Socket.IO auth & rooms
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    logError(new Error('Authentication required'), { source: 'socket', path: '/connect' });
    return next(new Error('Authentication required'));
  }
  try {
    const user = verifyAccessToken(token);
    socket.data.user = user;
    next();
  } catch (err) {
    logError(err, { source: 'socket', path: '/connect' });
    next(new Error('Invalid token'));
  }
});

startPresenceSweeper(io);

io.on('connection', (socket) => {
  const user = socket.data.user;
  if (user.organizationId) {
    socket.join(`org:${user.organizationId}`);
  }
  if (user.userId) {
    socket.join(`user:${user.userId}`);
  }

  registerPresenceHandlers(io, socket);

  socket.on('join:conversation', (conversationId: string) => {
    socket.join(`conversation:${conversationId}`);
  });

  socket.on('leave:conversation', (conversationId: string) => {
    socket.leave(`conversation:${conversationId}`);
  });

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
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        // HTTP deployments (IP-only) break when the browser upgrades asset URLs to HTTPS.
        upgradeInsecureRequests: useHttps ? [] : null,
        // Vite index.html includes a small inline theme bootstrap script.
        scriptSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  })
);
app.use(
  cors({
    origin: corsOriginDelegate,
    credentials: true,
  })
);

app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
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

app.use(express.json({ limit: '10mb' }));

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

  const healthy = Object.values(checks).every((v) => v === 'ok');
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
    version: '1.0.0',
  });
});

app.use('/api/media/public', publicMediaRoutes);
app.use('/api/media', mediaRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/whatsapp', whatsappRoutes);
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
app.use('/api/v1', publicApiRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/tickets', ticketRoutes);

const { clientDist, clientPublic } = getClientPaths();
const serveClient = config.nodeEnv === 'production' || clientBuildExists();

if (serveClient) {
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
  await initSentry();
  setupGlobalErrorHandlers();
  setRealtimeIO(io);

  await listen();

  const { checkRedisConnection } = await import('./config/redis');
  const redisAvailable = await checkRedisConnection();

  if (redisAvailable) {
    const { setSocketIO, startWorkers } = await import('./workers/index');
    setSocketIO(io);
    startWorkers();

    const { startAlertWorker } = await import('./workers/alert.worker');
    startAlertWorker();

    const { startMediaRetentionWorker } = await import('./workers/media-retention.worker');
    startMediaRetentionWorker();
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

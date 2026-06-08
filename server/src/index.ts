import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { config } from './config';
import { errorHandler, logError, setupGlobalErrorHandlers } from './errors';
import { verifyAccessToken } from './utils/jwt';
import logger, { requestLogger } from './utils/logger';

import authRoutes from './modules/auth/routes';
import whatsappRoutes from './modules/whatsapp/routes';
import inboxRoutes from './modules/inbox/routes';
import automationRoutes from './modules/automation/routes';
import flowRoutes from './modules/flows/routes';
import settingsRoutes from './modules/settings/routes';
import campaignRoutes from './modules/campaigns/routes';
import contactRoutes from './modules/contacts/routes';
import analyticsRoutes from './modules/analytics/routes';
import templateRoutes from './modules/templates/routes';
import messageRoutes from './modules/messages/routes';
import teamRoutes from './modules/team/routes';
import aiBotRoutes from './modules/ai-bot/routes';
import callingRoutes from './modules/calling/routes';
import publicMediaRoutes from './modules/media/public.routes';
import { setRealtimeIO } from './realtime';

const app = express();
const httpServer = createServer(app);

app.set('trust proxy', 1);

const io = new Server(httpServer, {
  cors: {
    origin: config.clientUrl,
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

io.on('connection', (socket) => {
  const user = socket.data.user;
  if (user.organizationId) {
    socket.join(`org:${user.organizationId}`);
  }
  if (user.userId) {
    socket.join(`user:${user.userId}`);
  }

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

app.use(helmet());
app.use(
  cors({
    origin: config.clientUrl,
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

// Preserve raw body for Meta webhook signature verification
app.use(
  '/api/whatsapp/webhook',
  express.raw({ type: 'application/json', limit: '10mb' }),
  (req, _res, next) => {
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
);

app.use(express.json({ limit: '10mb' }));

app.use(requestLogger);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/media/public', publicMediaRoutes);

app.use('/api/auth', authRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/inbox', inboxRoutes);
app.use('/api/automations', automationRoutes);
app.use('/api/flows', flowRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/ai-bot', aiBotRoutes);
app.use('/api/calling', callingRoutes);

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
  setupGlobalErrorHandlers();
  setRealtimeIO(io);

  await listen();

  const { setSocketIO } = await import('./workers/index');
  setSocketIO(io);

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

import express from 'express';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * G3 — P1-1: one unreachable WABA must not 500 / blank Templates for the org.
 * The real router is exercised; only auth, the DB and Meta are doubled.
 * The route's catch accepts any error carrying `metaCode` 100/190/200 through
 * isMetaUnavailableError, so the mock throws real instances from the module.
 */
const numbers = [
  { id: 'num-dead', organizationId: 'org-1', phoneNumber: '918839888531', wabaId: 'waba-dead', accessToken: 'enc-dead' },
  { id: 'num-live', organizationId: 'org-1', phoneNumber: '919303618219', wabaId: 'waba-live', accessToken: 'enc-live' },
];

const listMessageTemplates = vi.fn();
const listAllMessageTemplates = vi.fn();
const decryptToken = vi.fn((token: string) => token);

vi.mock('../../middleware/auth', () => ({
  authenticate: (req: { user?: unknown }, _res: unknown, next: () => void) => {
    req.user = { userId: 'user-1', organizationId: 'org-1', email: 'a@b.c', role: 'ADMIN' };
    next();
  },
  requireOrg: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../../middleware/permissions', () => ({ withPermission: () => [] }));
vi.mock('../../config/database', () => ({
  default: {
    whatsappNumber: {
      findMany: vi.fn(async () => numbers),
      findFirst: vi.fn(async () => numbers[1]),
    },
  },
}));
vi.mock('../whatsapp/meta.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../whatsapp/meta.service')>();
  return {
    ...actual,
    MetaWhatsAppService: {
      ...actual.MetaWhatsAppService,
      listMessageTemplates,
      listAllMessageTemplates,
      decryptToken,
    },
  };
});
vi.mock('../whatsapp/context', () => ({
  getOrgWhatsappContext: vi.fn(async () => ({ wabaId: 'waba-dead', accessToken: 'enc-dead' })),
}));
vi.mock('../whatsapp/active-number', () => ({
  resolveActiveWhatsappNumber: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const { default: templateRoutes } = await import('./routes');
const metaModule = await import('../whatsapp/meta.service');
const { MetaApiError } = metaModule;

function app() {
  const server = express();
  server.use(express.json());
  server.use('/api/templates', templateRoutes);
  // Mirror production errorHandler shape so assertions read the same fields.
  server.use((error: { statusCode?: number; code?: string; message?: string }, _req: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }, _n: () => void) => {
    res.status(error.statusCode ?? 500).json({ success: false, error: { message: error.message, code: error.code } });
  });
  return server;
}

describe('dead WABA isolation', () => {
  beforeEach(() => {
    listMessageTemplates.mockReset();
    listAllMessageTemplates.mockReset();
  });

  it('returns the healthy number templates and reports the dead one (200, not 500)', async () => {
    listAllMessageTemplates.mockImplementation(async (wabaId: string) => {
      if (wabaId === 'waba-dead') {
        throw new MetaApiError('Unsupported get request.', { metaCode: 100, status: 400 });
      }
      return [{ name: 'hello_account', status: 'APPROVED', language: 'en_US' }];
    });

    const res = await request(app()).get('/api/templates/by-any-active-number?all=true');

    expect(res.status).toBe(200);
    expect(res.body?.data?.templates?.[0]?.name).toBe('hello_account');
    expect(res.body?.data?.whatsappNumberId).toBe('num-live');
    expect(res.body?.data?.unavailableNumbers).toEqual(['918839888531']);
    expect(listAllMessageTemplates).toHaveBeenCalledTimes(2);
  });

  it('answers 503 META_OBJECT_UNAVAILABLE when every number is dead', async () => {
    listAllMessageTemplates.mockRejectedValue(new MetaApiError('Unsupported get request.', { metaCode: 100 }));

    const res = await request(app()).get('/api/templates/by-any-active-number?all=true');

    expect(res.status).toBe(503);
    expect(res.body?.error?.code).toBe('META_OBJECT_UNAVAILABLE');
  });

  it('does not swallow real failures (rate limit still surfaces)', async () => {
    listAllMessageTemplates.mockRejectedValue(new MetaApiError('Rate limit hit', { metaCode: 80008 }));

    const res = await request(app()).get('/api/templates/by-any-active-number?all=true');

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body?.error?.code).not.toBe('META_OBJECT_UNAVAILABLE');
  });
});

afterAll(() => {
  console.log('dead WABA isolation verification passed');
});

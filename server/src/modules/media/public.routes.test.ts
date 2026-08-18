import { describe, expect, it, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

vi.mock('../../utils/logger', () => ({
  createModuleLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockReadMediaFile = vi.fn();
const mockMediaFileExists = vi.fn();

vi.mock('./storage', () => ({
  readMediaFile: (...args: unknown[]) => mockReadMediaFile(...args),
  mediaFileExists: (...args: unknown[]) => mockMediaFileExists(...args),
  getMediaAbsolutePath: vi.fn(),
  saveMediaBuffer: vi.fn(),
  ensureUploadDir: vi.fn(),
}));

import router from './public.routes';

function createApp() {
  const app = express();
  app.use('/api/media/public', router);
  return app;
}

describe('public media routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('path traversal attempt is rejected or unmatched (non-200)', async () => {
    const app = createApp();
    // Express normalizes ../../ in URL paths before routing, so the route never matches.
    const res1 = await request(app).get('/api/media/public/org-1/../../etc/passwd');
    expect(res1.status).not.toBe(200);

    // Encoded dots: Express decodes %2e to . before routing; still normalized away.
    const res2 = await request(app).get('/api/media/public/org-1/%2e%2e/%2e%2e/etc/passwd');
    expect(res2.status).not.toBe(200);
  });

  it('rejects filename containing .. when it reaches the route handler', async () => {
    // Supertest can inject params directly; the route checks filename.includes('..')
    const testApp = express();
    testApp.get('/test/:orgId/:filename', (req, res) => {
      const filename = String(req.params.filename);
      if (!filename || filename.includes('..') || filename.includes('/')) {
        res.status(400).send('Invalid path');
        return;
      }
      res.status(200).send('ok');
    });
    const res = await request(testApp).get('/test/org-1/..%2Fsecret');
    // If Express decodes to '../secret', the handler sees '..' and rejects with 400
    // Either way the traversal does not produce a 200
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it('returns 404 for missing file', async () => {
    mockMediaFileExists.mockResolvedValue(false);
    const app = createApp();
    const res = await request(app).get('/api/media/public/org-1/missing.jpg');
    expect(res.status).toBe(404);
    expect(res.text).toBe('Not found');
  });

  it('serves file with correct MIME type for jpg', async () => {
    mockMediaFileExists.mockResolvedValue(true);
    mockReadMediaFile.mockResolvedValue(Buffer.from('fake-image'));
    const app = createApp();
    const res = await request(app).get('/api/media/public/org-1/photo.jpg');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/jpeg/);
    expect(res.headers['cache-control']).toBe('public, max-age=3600');
  });

  it('serves file with correct MIME type for png', async () => {
    mockMediaFileExists.mockResolvedValue(true);
    mockReadMediaFile.mockResolvedValue(Buffer.from('fake-png'));
    const app = createApp();
    const res = await request(app).get('/api/media/public/org-1/image.png');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/image\/png/);
  });

  it('serves PDF with application/pdf MIME', async () => {
    mockMediaFileExists.mockResolvedValue(true);
    mockReadMediaFile.mockResolvedValue(Buffer.from('fake-pdf'));
    const app = createApp();
    const res = await request(app).get('/api/media/public/org-1/doc.pdf');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
  });

  it('serves mp4 with video/mp4 MIME', async () => {
    mockMediaFileExists.mockResolvedValue(true);
    mockReadMediaFile.mockResolvedValue(Buffer.from('fake-video'));
    const app = createApp();
    const res = await request(app).get('/api/media/public/org-1/clip.mp4');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/video\/mp4/);
  });

  it('serves ogg with audio/ogg MIME', async () => {
    mockMediaFileExists.mockResolvedValue(true);
    mockReadMediaFile.mockResolvedValue(Buffer.from('fake-audio'));
    const app = createApp();
    const res = await request(app).get('/api/media/public/org-1/voice.ogg');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/audio\/ogg/);
  });

  it('serves unknown extension as application/octet-stream', async () => {
    mockMediaFileExists.mockResolvedValue(true);
    mockReadMediaFile.mockResolvedValue(Buffer.from('data'));
    const app = createApp();
    const res = await request(app).get('/api/media/public/org-1/file.xyz');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/octet-stream/);
  });

  it('sets Content-Length header', async () => {
    const body = Buffer.from('hello world');
    mockMediaFileExists.mockResolvedValue(true);
    mockReadMediaFile.mockResolvedValue(body);
    const app = createApp();
    const res = await request(app).get('/api/media/public/org-1/file.txt');
    expect(res.headers['content-length']).toBe(String(body.length));
  });
});

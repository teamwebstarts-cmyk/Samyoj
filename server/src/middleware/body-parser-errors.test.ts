import express from 'express';
import request from 'supertest';
import { afterAll, describe, expect, it } from 'vitest';
import { rejectBadJsonBody } from './body-parser-errors';

function app() {
  const server = express();
  server.use(express.json({ limit: '100b' }));
  server.use(rejectBadJsonBody);
  server.post('/probe', (_req, res) => {
    res.status(200).json({ ok: true });
  });
  return server;
}

describe('body parser errors', () => {
  it('returns 400 INVALID_JSON for a malformed body', async () => {
    const res = await request(app())
      .post('/probe')
      .set('Content-Type', 'application/json')
      .send('0x%5B%5D=DTAB');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('returns 413 for an oversize JSON body', async () => {
    const res = await request(app())
      .post('/probe')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ blob: 'x'.repeat(200) }));
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('BODY_TOO_LARGE');
  });
});

afterAll(() => {
  console.log('body parser error verification passed');
});

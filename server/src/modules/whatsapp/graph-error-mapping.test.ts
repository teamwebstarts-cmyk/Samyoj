import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import {
  graphApiError,
  isMetaUnavailableError,
  isWhatsAppRateLimit,
  MetaApiError,
  MetaWhatsAppService,
} from './meta.service';

/**
 * G2 — P1-1 typed Graph errors.
 * A Graph 100 (dead/unreadable WABA) used to surface as a plain Error -> HTTP 500.
 * These assertions fail if graphGet ever regresses to `throw new Error(...)`.
 */
function stubFetch(status: number, body: unknown, asText?: string) {
  const mock = vi.fn().mockResolvedValue({
    ok: status < 400,
    status,
    text: async () => (asText !== undefined ? asText : JSON.stringify(body)),
    json: async () => body,
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

describe('Graph error mapping', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('graphGet throws MetaApiError with the Graph code for a dead object (100)', async () => {
    stubFetch(400, { error: { message: 'Unsupported get request.', code: 100, fbtrace_id: 'trace-100' } });
    const error = await MetaWhatsAppService.listMessageTemplates('1593477159022923', 'token').catch((e) => e);
    expect(error).toBeInstanceOf(MetaApiError);
    expect(error.metaCode).toBe(100);
    expect(error.fbtraceId).toBe('trace-100');
    expect(isMetaUnavailableError(error)).toBe(true);
    expect(isWhatsAppRateLimit(error)).toBe(false);
  });

  it('marks expired tokens (190) as unavailable so callers can stop polling', () => {
    const error = graphApiError(401, { message: 'Invalid OAuth access token.', code: 190 }, 'fallback');
    expect(error).toBeInstanceOf(MetaApiError);
    expect(error.status).toBe(401);
    expect(isMetaUnavailableError(error)).toBe(true);
  });

  it('recognises #80008 as a rate limit from the typed code, not only from the text', async () => {
    stubFetch(400, { error: { message: 'Rate limit hit', code: 80008 } });
    const error = await MetaWhatsAppService.getMessageTemplate('waba', 'token', 'hello').catch((e) => e);
    expect(isWhatsAppRateLimit(error)).toBe(true);
    expect(isMetaUnavailableError(error)).toBe(false);
  });

  it('keeps a Meta 5xx distinguishable from a bad request (status preserved, no 500 leak)', () => {
    const error = graphApiError(503, { message: 'Service unavailable', code: 2 }, 'fallback');
    expect(error.status).toBe(503);
    expect(isMetaUnavailableError(error)).toBe(false);
  });

  it('does not crash when Meta returns a non-JSON body', async () => {
    stubFetch(502, null, '<html>Bad gateway</html>');
    const error = await MetaWhatsAppService.listMessageTemplates('waba', 'token').catch((e) => e);
    expect(error).toBeInstanceOf(MetaApiError);
    expect(error.status).toBe(502);
  });

  it('healthy responses still return data unchanged', async () => {
    stubFetch(200, { data: [{ name: 'hello_account', status: 'APPROVED', language: 'en_US' }] });
    const result = await MetaWhatsAppService.listMessageTemplates('waba', 'token');
    expect(result.templates[0]?.name).toBe('hello_account');
  });
});

afterAll(() => {
  console.log('Graph error mapping verification passed');
});

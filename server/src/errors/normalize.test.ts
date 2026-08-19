import { describe, expect, it } from 'vitest';
import { normalizeError } from './index';

describe('normalizeError', () => {
  it('maps URIError from malformed paths to 400', () => {
    const err = new URIError("Failed to decode param '/%C0'");
    const normalized = normalizeError(err);
    expect(normalized.statusCode).toBe(400);
    expect(normalized.isOperational).toBe(true);
    expect(normalized.code).toBe('URIError');
  });

  it('maps client-aborted requests as operational, not 500', () => {
    const err = new Error('Request aborted');
    const normalized = normalizeError(err);
    expect(normalized.statusCode).toBe(499);
    expect(normalized.isOperational).toBe(true);
  });
});

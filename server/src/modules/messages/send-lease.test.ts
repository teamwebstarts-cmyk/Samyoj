import { describe, expect, it } from 'vitest';
import { MetaApiError } from '../whatsapp/meta.service';
import { outboundStatusAfterProviderCallError, shouldSkipOutboundProviderRetry } from './send-lease';

describe('shouldSkipOutboundProviderRetry', () => {
  it('skips completed and failed rows', () => {
    expect(shouldSkipOutboundProviderRetry({ status: 'SENT' })).toBe(true);
    expect(shouldSkipOutboundProviderRetry({ status: 'DELIVERED' })).toBe(true);
    expect(shouldSkipOutboundProviderRetry({ status: 'READ' })).toBe(true);
    expect(shouldSkipOutboundProviderRetry({ status: 'FAILED' })).toBe(true);
    expect(shouldSkipOutboundProviderRetry({ status: 'AMBIGUOUS' })).toBe(true);
  });

  it('skips in-flight PENDING rows that already crossed the provider boundary', () => {
    expect(
      shouldSkipOutboundProviderRetry({
        status: 'PENDING',
        providerCallStartedAt: new Date(),
      })
    ).toBe(true);
  });

  it('allows a fresh PENDING row that has not called Meta yet', () => {
    expect(shouldSkipOutboundProviderRetry({ status: 'PENDING', providerCallStartedAt: null })).toBe(
      false
    );
  });
});

describe('outboundStatusAfterProviderCallError', () => {
  it('fails closed to AMBIGUOUS on timeouts and unknown network errors', () => {
    expect(outboundStatusAfterProviderCallError(new Error('socket hang up'))).toBe('AMBIGUOUS');
    expect(outboundStatusAfterProviderCallError(new Error('fetch failed'))).toBe('AMBIGUOUS');
  });

  it('marks explicit Meta policy/permanent rejections as FAILED so the agent can retry', () => {
    expect(
      outboundStatusAfterProviderCallError(
        new MetaApiError('Template rejected', { metaCode: 132001, status: 400 })
      )
    ).toBe('FAILED');
    expect(
      outboundStatusAfterProviderCallError(
        new MetaApiError('Customer service window closed', { metaCode: 131047, status: 400 })
      )
    ).toBe('FAILED');
  });
});

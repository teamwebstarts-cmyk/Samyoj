import { describe, expect, it, vi } from 'vitest';
import { formatGraphErrorMessage } from './meta.service';

describe('formatGraphErrorMessage', () => {
  it('prefers error_user_msg over Invalid parameter', () => {
    expect(
      formatGraphErrorMessage({
        message: 'Invalid parameter',
        code: 100,
        error_user_title: 'Template Name Already Exists',
        error_user_msg: 'You already have a template named delivery_failed.',
      })
    ).toContain('already have a template');
  });

  it('gives actionable copy when Graph only says Invalid parameter', () => {
    expect(formatGraphErrorMessage({ message: 'Invalid parameter', code: 100 })).toMatch(
      /shop or tracking|unique template name/i
    );
  });
});

describe('createMessageTemplate', () => {
  it('does not crash when Meta returns a non-JSON body', async () => {
    const { MetaWhatsAppService, MetaApiError } = await import('./meta.service');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError('Unexpected token <');
        },
      }),
    );
    await expect(
      MetaWhatsAppService.createMessageTemplate('waba', 'token', {
        name: 'order_shipped',
        language: 'en_US',
        category: 'UTILITY',
        components: [],
      }),
    ).rejects.toBeInstanceOf(MetaApiError);
    vi.unstubAllGlobals();
  });
});

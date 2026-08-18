import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFromLibrarySchema } from './types';
import { MetaWhatsAppService } from '../whatsapp/meta.service';
import { config } from '../../config';

describe('createFromLibrarySchema', () => {
  const base = {
    name: 'account_creation_confirmation',
    language: 'en_US',
    libraryTemplateName: 'account_creation_confirmation_3',
  };

  it('accepts a minimal payload without button inputs', () => {
    const result = createFromLibrarySchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.libraryTemplateButtonInputs).toBeUndefined();
    }
  });

  it('accepts a URL button input with base_url and url_suffix_example', () => {
    const result = createFromLibrarySchema.safeParse({
      ...base,
      libraryTemplateButtonInputs: [
        {
          type: 'URL',
          url: {
            base_url: 'https://yourstore.com/{{1}}',
            url_suffix_example: 'https://yourstore.com/demo',
          },
        },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const btn = result.data.libraryTemplateButtonInputs![0];
      expect(btn.type).toBe('URL');
    }
  });

  it('accepts a URL button input with base_url only (suffix optional)', () => {
    const result = createFromLibrarySchema.safeParse({
      ...base,
      libraryTemplateButtonInputs: [
        {
          type: 'URL',
          url: { base_url: 'https://yourstore.com/verify' },
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a PHONE_NUMBER button input', () => {
    const result = createFromLibrarySchema.safeParse({
      ...base,
      libraryTemplateButtonInputs: [
        { type: 'PHONE_NUMBER', phone_number: '+919876543210' },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const btn = result.data.libraryTemplateButtonInputs![0];
      expect(btn.type).toBe('PHONE_NUMBER');
    }
  });

  it('accepts an OTP button input', () => {
    const result = createFromLibrarySchema.safeParse({
      ...base,
      category: 'AUTHENTICATION',
      libraryTemplateButtonInputs: [
        { type: 'OTP', otp_type: 'COPY_CODE' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts an OTP button input with ONE_TAP', () => {
    const result = createFromLibrarySchema.safeParse({
      ...base,
      category: 'AUTHENTICATION',
      libraryTemplateButtonInputs: [
        { type: 'OTP', otp_type: 'ONE_TAP' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('accepts mixed button inputs (URL + PHONE_NUMBER + OTP)', () => {
    const result = createFromLibrarySchema.safeParse({
      ...base,
      libraryTemplateButtonInputs: [
        {
          type: 'URL',
          url: { base_url: 'https://yourstore.com/{{1}}', url_suffix_example: 'demo' },
        },
        { type: 'PHONE_NUMBER', phone_number: '+919876543210' },
        { type: 'OTP', otp_type: 'COPY_CODE' },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.libraryTemplateButtonInputs).toHaveLength(3);
    }
  });

  it('rejects a URL button missing base_url', () => {
    const result = createFromLibrarySchema.safeParse({
      ...base,
      libraryTemplateButtonInputs: [
        { type: 'URL', url: {} },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a URL button with empty base_url', () => {
    const result = createFromLibrarySchema.safeParse({
      ...base,
      libraryTemplateButtonInputs: [
        { type: 'URL', url: { base_url: '' } },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a URL button missing the url field entirely', () => {
    const result = createFromLibrarySchema.safeParse({
      ...base,
      libraryTemplateButtonInputs: [
        { type: 'URL' },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a PHONE_NUMBER button with short number', () => {
    const result = createFromLibrarySchema.safeParse({
      ...base,
      libraryTemplateButtonInputs: [
        { type: 'PHONE_NUMBER', phone_number: '123' },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a PHONE_NUMBER button missing phone_number', () => {
    const result = createFromLibrarySchema.safeParse({
      ...base,
      libraryTemplateButtonInputs: [
        { type: 'PHONE_NUMBER' },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects an unknown button type', () => {
    const result = createFromLibrarySchema.safeParse({
      ...base,
      libraryTemplateButtonInputs: [
        { type: 'QUICK_REPLY', text: 'Yes' },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects a bare record without type field', () => {
    const result = createFromLibrarySchema.safeParse({
      ...base,
      libraryTemplateButtonInputs: [
        { foo: 'bar' },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects more than 10 button inputs', () => {
    const inputs = Array.from({ length: 11 }, () => ({
      type: 'OTP',
      otp_type: 'COPY_CODE',
    }));
    const result = createFromLibrarySchema.safeParse({
      ...base,
      libraryTemplateButtonInputs: inputs,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid category', () => {
    const result = createFromLibrarySchema.safeParse({
      ...base,
      category: 'MARKETING',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid template name characters', () => {
    const result = createFromLibrarySchema.safeParse({
      ...base,
      name: 'my-template!',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty libraryTemplateName', () => {
    const result = createFromLibrarySchema.safeParse({
      ...base,
      libraryTemplateName: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('MetaWhatsAppService.createMessageTemplateFromLibrary', () => {
  const originalMeta = {
    appId: config.meta.appId,
    appSecret: config.meta.appSecret,
  };

  beforeEach(() => {
    config.meta.appId = '111111111111';
    config.meta.appSecret = 'app-secret';
  });

  afterEach(() => {
    config.meta.appId = originalMeta.appId;
    config.meta.appSecret = originalMeta.appSecret;
    vi.unstubAllGlobals();
  });

  it('sends library_template_name and library_template_button_inputs to Meta', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: '12345', status: 'APPROVED', category: 'UTILITY' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await MetaWhatsAppService.createMessageTemplateFromLibrary(
      'waba-123',
      'user-token',
      {
        name: 'my_account_confirmation',
        language: 'en_US',
        libraryTemplateName: 'account_creation_confirmation_3',
        libraryTemplateButtonInputs: [
          {
            type: 'URL',
            url: {
              base_url: 'https://yourstore.com/{{1}}',
              url_suffix_example: 'https://yourstore.com/demo',
            },
          },
        ],
      },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, { body?: string; headers?: Record<string, string> }];
    expect(String(url)).toContain('/waba-123/message_templates');
    expect(init.headers?.Authorization).toBe('Bearer user-token');

    const body = JSON.parse(init.body!);
    expect(body.library_template_name).toBe('account_creation_confirmation_3');
    expect(body.language).toBe('en_US');
    expect(body.category).toBe('UTILITY');
    expect(body.library_template_button_inputs).toEqual([
      {
        type: 'URL',
        url: {
          base_url: 'https://yourstore.com/{{1}}',
          url_suffix_example: 'https://yourstore.com/demo',
        },
      },
    ]);
    expect(result).toEqual({ id: '12345', status: 'APPROVED', category: 'UTILITY' });
  });

  it('omits library_template_button_inputs when not provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: '67890', status: 'APPROVED', category: 'UTILITY' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await MetaWhatsAppService.createMessageTemplateFromLibrary(
      'waba-123',
      'user-token',
      {
        name: 'delivery_update',
        language: 'en_US',
        libraryTemplateName: 'delivery_update_1',
      },
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.library_template_name).toBe('delivery_update_1');
    expect(body.library_template_button_inputs).toBeUndefined();
  });

  it('sets category to AUTHENTICATION when specified', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: '111', status: 'APPROVED', category: 'AUTHENTICATION' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await MetaWhatsAppService.createMessageTemplateFromLibrary(
      'waba-123',
      'user-token',
      {
        name: 'otp_login',
        language: 'en_US',
        libraryTemplateName: 'otp_login_1',
        category: 'AUTHENTICATION',
        libraryTemplateButtonInputs: [
          { type: 'OTP', otp_type: 'COPY_CODE' },
        ],
      },
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.category).toBe('AUTHENTICATION');
    expect(result.category).toBe('AUTHENTICATION');
  });

  it('throws on Meta API error', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        error: { message: '(#100) Invalid parameter', code: 100 },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      MetaWhatsAppService.createMessageTemplateFromLibrary(
        'waba-123',
        'user-token',
        {
          name: 'bad_template',
          language: 'en_US',
          libraryTemplateName: 'nonexistent_template',
        },
      ),
    ).rejects.toThrow(/Invalid parameter/);
  });

  it('throws a generic error when Meta returns no error message', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      MetaWhatsAppService.createMessageTemplateFromLibrary(
        'waba-123',
        'user-token',
        {
          name: 'bad_template',
          language: 'en_US',
          libraryTemplateName: 'nonexistent',
        },
      ),
    ).rejects.toThrow(/Failed to create template from library/);
  });

  it('passes allow_category_change when provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: '222', status: 'APPROVED', category: 'UTILITY' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await MetaWhatsAppService.createMessageTemplateFromLibrary(
      'waba-123',
      'user-token',
      {
        name: 'my_template',
        language: 'en_US',
        libraryTemplateName: 'delivery_update_1',
        allow_category_change: true,
      },
    );

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.allow_category_change).toBe(true);
  });

  it('propagates fetch timeout (AbortError) without hanging', async () => {
    const fetchMock = vi.fn().mockRejectedValue(
      Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      MetaWhatsAppService.createMessageTemplateFromLibrary(
        'waba-123',
        'user-token',
        { name: 't', language: 'en_US', libraryTemplateName: 't_1' },
      ),
    ).rejects.toThrow(/aborted/i);
  });

  it('propagates connection-refused network errors', async () => {
    const fetchMock = vi.fn().mockRejectedValue(
      new TypeError('fetch failed: connect ECONNREFUSED'),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      MetaWhatsAppService.createMessageTemplateFromLibrary(
        'waba-123',
        'user-token',
        { name: 't', language: 'en_US', libraryTemplateName: 't_1' },
      ),
    ).rejects.toThrow(/ECONNREFUSED/);
  });

  it('handles non-JSON response body gracefully', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => { throw new SyntaxError('Unexpected token < in JSON'); },
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      MetaWhatsAppService.createMessageTemplateFromLibrary(
        'waba-123',
        'user-token',
        { name: 't', language: 'en_US', libraryTemplateName: 't_1' },
      ),
    ).rejects.toThrow(/non-JSON body/);
  });

  it('handles partial success response (missing id)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'APPROVED', category: 'UTILITY' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await MetaWhatsAppService.createMessageTemplateFromLibrary(
      'waba-123',
      'user-token',
      { name: 't', language: 'en_US', libraryTemplateName: 't_1' },
    );

    // id is undefined but the call does not throw — caller must handle missing id
    expect(result.id).toBeUndefined();
    expect(result.status).toBe('APPROVED');
  });
});

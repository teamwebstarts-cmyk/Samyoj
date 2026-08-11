import { describe, expect, it, vi } from 'vitest';
import { NON_MESSAGE_WEBHOOK_FIELDS } from '../calling/call.processor';
import { HANDLED_FIELDS, providerWebhookEventKey } from './webhook-dispatcher';
import { META_WEBHOOK_FIELDS, MetaWhatsAppService } from './meta.service';
import { config } from '../../config';

describe('non-message webhook dispatch wiring', () => {
  it('routes every supported account, template, and phone event through the dispatcher', () => {
    for (const field of NON_MESSAGE_WEBHOOK_FIELDS) {
      expect(HANDLED_FIELDS.has(field)).toBe(true);
    }
  });

  it('registers the complete supported field set without credential fields', () => {
    expect(META_WEBHOOK_FIELDS).toEqual([
      'messages',
      'calls',
      'account_alerts',
      'business_capability_update',
      'phone_number_quality_update',
      'phone_number_name_update',
      'message_template_status_update',
      'message_template_quality_update',
      'message_template_components_update',
      'template_category_update',
      'user_preferences',
    ]);
    expect(META_WEBHOOK_FIELDS.join(',')).not.toMatch(/secret|token|access_key|app_id/i);
  });

  it('uses provider event identity when supplied and stable payload identity otherwise', () => {
    expect(providerWebhookEventKey('waba-1', 'account_alerts', { event_id: 'evt-1' }))
      .toBe('account_alerts:evt-1');
    expect(providerWebhookEventKey('waba-1', 'quality', { rating: 'RED' }))
      .toBe(providerWebhookEventKey('waba-1', 'quality', { rating: 'RED' }));
  });

  it('waits for WABA linking before registering the app webhook', async () => {
    const order: string[] = [];
    const previousUrl = config.meta.webhookUrl;
    config.meta.webhookUrl = 'https://example.test/api/whatsapp/webhook';
    const subscribe = vi.spyOn(MetaWhatsAppService, 'ensureWabaSubscribed')
      .mockImplementation(async () => { order.push('subscribe'); });
    const register = vi.spyOn(MetaWhatsAppService, 'registerAppWebhook')
      .mockImplementation(async () => { order.push('register'); });
    try {
      await MetaWhatsAppService.configureWebhooks('waba', 'token', {
        appId: 'app',
        appSecret: 'secret',
      });
      expect(order).toEqual(['subscribe', 'register']);
    } finally {
      config.meta.webhookUrl = previousUrl;
      subscribe.mockRestore();
      register.mockRestore();
    }
  });
});

import { describe, expect, it } from 'vitest';
import { NON_MESSAGE_WEBHOOK_FIELDS } from '../calling/call.processor';
import { HANDLED_FIELDS } from './webhook-dispatcher';

describe('non-message webhook dispatch wiring', () => {
  it('routes every supported account, template, and phone event through the dispatcher', () => {
    for (const field of NON_MESSAGE_WEBHOOK_FIELDS) {
      expect(HANDLED_FIELDS.has(field)).toBe(true);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { pickHydratedTemplateContent } from './template-params';

describe('pickHydratedTemplateContent', () => {
  it('keeps stored filled text instead of raw placeholders', () => {
    expect(
      pickHydratedTemplateContent(
        'Hi Nirbhay, we received a request for your order.',
        'Hi {{1}}, we received a request for your {{2}}.'
      )
    ).toBe('Hi Nirbhay, we received a request for your order.');
  });

  it('uses rendered text when it is filled', () => {
    expect(
      pickHydratedTemplateContent(
        'Hi {{1}}, we received a request for your {{2}}.',
        'Hi Nirbhay, we received a request for your order.'
      )
    ).toBe('Hi Nirbhay, we received a request for your order.');
  });
});

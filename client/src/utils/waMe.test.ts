import { describe, expect, it } from 'vitest';
import { buildWaMeSnippet, buildWaMeUrl, digitsOnlyPhone } from './waMe';

describe('wa.me builder', () => {
  it('strips formatting and encodes prefill', () => {
    expect(digitsOnlyPhone('+91 90097 85315')).toBe('919009785315');
    expect(buildWaMeUrl('+91 90097 85315', 'Hi there')).toBe(
      'https://wa.me/919009785315?text=Hi%20there'
    );
  });

  it('emits a snippet without App ID', () => {
    const snippet = buildWaMeSnippet({
      phone: '919009785315',
      label: 'Chat with us',
      text: 'Hi',
      position: 'br',
    });
    expect(snippet).toContain('https://wa.me/919009785315?text=Hi');
    expect(snippet.toLowerCase()).not.toContain('app id');
    expect(snippet).not.toContain('META_APP_ID');
  });
});

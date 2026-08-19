import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SupportAnswer from './SupportAnswer';

function html(content: string) {
  return renderToStaticMarkup(createElement(SupportAnswer, { content }));
}

describe('SupportAnswer', () => {
  it('renders numbered steps and bold labels without showing markdown stars', () => {
    const markup = html(
      'Templates are approved messages.\n1. **Create:** You write the text.\n2. **Submit:** Meta reviews it.'
    );
    expect(markup).toContain('<ol');
    expect(markup).toContain('<strong');
    expect(markup).toContain('Create:');
    expect(markup).not.toContain('**');
  });

  it('renders inline code without backticks', () => {
    const markup = html('Use a variable like `{{1}}` in the template.');
    expect(markup).toContain('<code');
    expect(markup).toContain('{{1}}');
    expect(markup).not.toContain('`{{1}}`');
  });
});

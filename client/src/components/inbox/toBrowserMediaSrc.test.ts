import { describe, expect, it } from 'vitest';
import { toBrowserMediaSrc } from './AuthenticatedMedia';

describe('toBrowserMediaSrc', () => {
  it('keeps relative signed media paths', () => {
    expect(
      toBrowserMediaSrc('/api/inbox/messages/abc/media?exp=1&sig=x')
    ).toBe('/api/inbox/messages/abc/media?exp=1&sig=x');
  });

  it('strips absolute API origin so Vite proxy can serve media same-origin', () => {
    expect(
      toBrowserMediaSrc('http://localhost:8000/api/inbox/messages/abc/media?exp=1&sig=x')
    ).toBe('/api/inbox/messages/abc/media?exp=1&sig=x');
  });
});

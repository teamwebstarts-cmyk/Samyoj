import { describe, expect, it } from 'vitest';
import { splitBodyParts } from './libraryBody';

describe('splitBodyParts', () => {
  it('returns the whole string as text when there are no variables', () => {
    expect(splitBodyParts('Hello world')).toEqual([{ type: 'text', value: 'Hello world' }]);
  });

  it('splits leading, middle, and trailing variables', () => {
    expect(splitBodyParts('{{1}} OFF using code {{2}}, hurry {{3}}')).toEqual([
      { type: 'var', value: '{{1}}' },
      { type: 'text', value: ' OFF using code ' },
      { type: 'var', value: '{{2}}' },
      { type: 'text', value: ', hurry ' },
      { type: 'var', value: '{{3}}' },
    ]);
  });

  it('keeps consecutive variables as separate chips', () => {
    expect(splitBodyParts('{{1}}{{2}}')).toEqual([
      { type: 'var', value: '{{1}}' },
      { type: 'var', value: '{{2}}' },
    ]);
  });

  it('treats unclosed or non-numeric braces as plain text', () => {
    expect(splitBodyParts('Hi {{name} and {a} x')).toEqual([
      { type: 'text', value: 'Hi {{name} and {a} x' },
    ]);
    expect(splitBodyParts('brace { here')).toEqual([{ type: 'text', value: 'brace { here' }]);
  });

  it('handles empty and variable-only text', () => {
    expect(splitBodyParts('')).toEqual([{ type: 'text', value: '' }]);
    expect(splitBodyParts('{{10}}')).toEqual([{ type: 'var', value: '{{10}}' }]);
  });
});

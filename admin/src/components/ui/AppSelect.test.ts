import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { flattenOptions, nodeText } from './AppSelect';

describe('AppSelect option flattening', () => {
  it('reads value and label from plain option elements', () => {
    const options: { value: string; label: string; disabled?: boolean }[] = [];
    flattenOptions(createElement('option', { value: 'UTILITY' }, 'Utility'), options);
    expect(options).toEqual([{ value: 'UTILITY', label: 'Utility', disabled: undefined }]);
  });

  it('falls back to node text when value prop is absent', () => {
    const options: { value: string; label: string }[] = [];
    flattenOptions(createElement('option', {}, 'All categories'), options);
    expect(options).toEqual([{ value: 'All categories', label: 'All categories', disabled: undefined }]);
  });

  it('flattens fragments and skips non-option children', () => {
    const options: { value: string; label: string }[] = [];
    flattenOptions(
      [
        createElement('option', { value: 'a' }, 'A'),
        null,
        createElement('option', { value: 'b' }, 'B'),
      ],
      options,
    );
    expect(options.map((option) => option.value)).toEqual(['a', 'b']);
  });

  it('nodeText joins nested children', () => {
    expect(nodeText(['Uti', createElement('b', {}, 'li'), 'ty'])).toBe('Utility');
  });
});

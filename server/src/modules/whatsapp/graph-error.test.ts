import { describe, expect, it } from 'vitest';
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

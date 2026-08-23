import { describe, expect, it } from 'vitest';
import {
  bodyVariableExamples,
  localeToMetaLanguage,
  parseAbVariants,
  slugTemplateName,
  toolInstruction,
} from './tools';

describe('localeToMetaLanguage', () => {
  it('maps India locales to Meta language codes', () => {
    expect(localeToMetaLanguage('en-IN')).toBe('en_IN');
    expect(localeToMetaLanguage('hi-IN')).toBe('hi');
    expect(localeToMetaLanguage('ta-IN')).toBe('ta');
    expect(localeToMetaLanguage('gu-IN')).toBe('gu');
  });

  it('passes through Meta-style codes', () => {
    expect(localeToMetaLanguage('en_US')).toBe('en_US');
    expect(localeToMetaLanguage('en')).toBe('en_US');
  });
});

describe('slugTemplateName', () => {
  it('builds a lowercase Meta-safe name', () => {
    expect(slugTemplateName('Acme Retail!', 1_700_000_000_000)).toMatch(/^studio_acme_retail_[a-z0-9]+$/);
  });

  it('falls back when the brand name is empty', () => {
    expect(slugTemplateName('   ', 1)).toMatch(/^studio_studio_/);
  });
});

describe('parseAbVariants', () => {
  it('reads a JSON array', () => {
    expect(parseAbVariants('["a","b","c","d","e"]')).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('reads numbered lines', () => {
    const raw = '1. Hello\n2. Hi there\n3. Namaste';
    expect(parseAbVariants(raw)).toEqual(['Hello', 'Hi there', 'Namaste']);
  });
});

describe('bodyVariableExamples', () => {
  it('returns sample values for {{n}} placeholders', () => {
    expect(bodyVariableExamples('Hi {{1}}, order {{2}} is ready.')).toEqual(['sample1', 'sample2']);
  });

  it('returns undefined when there are no variables', () => {
    expect(bodyVariableExamples('Hello')).toBeUndefined();
  });
});

describe('toolInstruction', () => {
  it('asks shorten to stay under 1024', () => {
    expect(toolInstruction('shorten', 'en-IN')).toMatch(/1024/);
  });
});

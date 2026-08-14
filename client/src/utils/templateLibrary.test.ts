import { describe, expect, it } from 'vitest';
import { libraryButtonUrlError, normalizeWebsiteUrl } from './templateLibrary';

describe('normalizeWebsiteUrl', () => {
  it('upgrades http to https', () => {
    expect(normalizeWebsiteUrl('http://shop.example/verify')).toBe('https://shop.example/verify');
  });

  it('adds https to a bare domain', () => {
    expect(normalizeWebsiteUrl('yourstore.com/verify')).toBe('https://yourstore.com/verify');
  });
});

describe('libraryButtonUrlError', () => {
  it('rejects the local Samyoj page', () => {
    const message = libraryButtonUrlError(
      'http://localhost:3000/templates/library',
      'http://localhost:3000',
    );
    expect(message).toMatch(/live website|computer|Samyoj/i);
  });

  it('rejects http that is not a public site even after upgrade when host is local', () => {
    expect(libraryButtonUrlError('http://127.0.0.1:8000')).toMatch(/computer|live website/i);
  });

  it('accepts a public https store URL', () => {
    expect(libraryButtonUrlError('https://yourstore.com/verify-account')).toBeNull();
  });

  it('accepts http public URLs after https upgrade', () => {
    expect(libraryButtonUrlError('http://yourstore.com/verify')).toBeNull();
  });
});

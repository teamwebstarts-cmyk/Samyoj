import { describe, expect, it } from 'vitest';
import {
  buildLibraryButtonInputs,
  buildLibraryUrlInput,
  libraryButtonUrlError,
  normalizeWebsiteUrl,
} from './templateLibrary';

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

  it('allows a store page on the same public host as the app', () => {
    expect(
      libraryButtonUrlError('https://app.samyoj.test/verify-account', 'https://app.samyoj.test'),
    ).toBeNull();
  });

  it('still rejects a Samyoj path on the same host', () => {
    expect(
      libraryButtonUrlError(
        'https://app.samyoj.test/templates/library',
        'https://app.samyoj.test',
      ),
    ).toMatch(/Samyoj screen/i);
  });
});

describe('buildLibraryUrlInput', () => {
  it('does not force {{1}} onto a static library HTTPS URL', () => {
    expect(buildLibraryUrlInput('https://yourstore.com/verify', 'https://www.example.com/')).toEqual({
      base_url: 'https://yourstore.com/verify',
      url_suffix_example: 'https://yourstore.com/verify',
    });
  });

  it('treats a missing library URL as static', () => {
    expect(buildLibraryUrlInput('https://yourstore.com/account')).toEqual({
      base_url: 'https://yourstore.com/account',
      url_suffix_example: 'https://yourstore.com/account',
    });
  });

  it('keeps a user URL that already contains {{n}} and uses a short suffix sample', () => {
    expect(buildLibraryUrlInput('https://yourstore.com/track/{{1}}', 'https://www.example.com/{{1}}')).toEqual({
      base_url: 'https://yourstore.com/track/{{1}}',
      url_suffix_example: 'demo',
    });
  });

  it('merges a static user URL onto a dynamic library button using the last path segment', () => {
    expect(buildLibraryUrlInput('https://yourstore.com/verify', 'https://www.example.com/{{1}}')).toEqual({
      base_url: 'https://yourstore.com/{{1}}',
      url_suffix_example: 'verify',
    });
  });

  it('keeps nested user path prefixes when the last segment is the suffix sample', () => {
    expect(
      buildLibraryUrlInput('https://yourstore.com/orders/track', 'https://www.example.com/{{1}}'),
    ).toEqual({
      base_url: 'https://yourstore.com/orders/{{1}}',
      url_suffix_example: 'track',
    });
  });

  it('copies the library path onto origin-only user URLs', () => {
    expect(buildLibraryUrlInput('https://yourstore.com', 'https://www.example.com/orders/{{1}}')).toEqual({
      base_url: 'https://yourstore.com/orders/{{1}}',
      url_suffix_example: 'demo',
    });
  });
});

describe('buildLibraryButtonInputs', () => {
  it('sends a static URL payload when the library button is not dynamic', () => {
    const inputs = buildLibraryButtonInputs(
      { buttons: [{ type: 'URL', text: 'Open', url: 'https://www.example.com/' }] },
      'https://yourstore.com/verify',
      '',
    );
    expect(inputs).toEqual([
      {
        type: 'URL',
        url: {
          base_url: 'https://yourstore.com/verify',
          url_suffix_example: 'https://yourstore.com/verify',
        },
      },
    ]);
    expect(JSON.stringify(inputs)).not.toContain('{{1}}');
  });

  it('sends a dynamic URL payload with a suffix sample, not the full user URL as the suffix', () => {
    const inputs = buildLibraryButtonInputs(
      { buttons: [{ type: 'URL', text: 'Track', url: 'https://www.example.com/{{1}}' }] },
      'https://yourstore.com/verify',
      '',
    );
    expect(inputs).toEqual([
      {
        type: 'URL',
        url: {
          base_url: 'https://yourstore.com/{{1}}',
          url_suffix_example: 'verify',
        },
      },
    ]);
  });

  it('includes phone and OTP inputs', () => {
    const inputs = buildLibraryButtonInputs(
      {
        category: 'AUTHENTICATION',
        buttons: [
          { type: 'URL', text: 'Verify', url: 'https://www.example.com/' },
          { type: 'PHONE_NUMBER', text: 'Call', phone_number: '+18005551234' },
        ],
      },
      'https://yourstore.com/verify',
      '+919876543210',
    );
    expect(inputs).toEqual([
      {
        type: 'URL',
        url: {
          base_url: 'https://yourstore.com/verify',
          url_suffix_example: 'https://yourstore.com/verify',
        },
      },
      { type: 'PHONE_NUMBER', phone_number: '+919876543210' },
      { type: 'OTP', otp_type: 'COPY_CODE' },
    ]);
  });
});


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

  it('allows a store page on the same public host as the app', () => {
    expect(
      libraryButtonUrlError('https://app.samyoj.test/verify-account', 'https://app.samyoj.test'),
    ).toBeNull();
  });

  it('still rejects a Samyoj path on the same host', () => {
    expect(
      libraryButtonUrlError(
        'https://app.samyoj.test/templates/library',
        'https://app.samyoj.test',
      ),
    ).toMatch(/Samyoj screen/i);
  });
});

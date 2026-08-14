import { describe, expect, it } from 'vitest';
import { joinSpokenTurns, isLikelyTtsEcho, prepareSpokenText, splitForTts } from './spoken-text';

describe('prepareSpokenText', () => {
  it('strips markdown and urls so Bulbul does not read stars', () => {
    expect(prepareSpokenText('**Sure** — see https://example.com/help')).toBe('Sure — see');
  });
});

describe('joinSpokenTurns', () => {
  it('speaks consent and greeting as one thought', () => {
    expect(
      joinSpokenTurns(
        'Just so you know, this call may be recorded',
        'Hi, thanks for calling. How can I help?'
      )
    ).toBe(
      'Just so you know, this call may be recorded. Hi, thanks for calling. How can I help?'
    );
  });
});

describe('splitForTts', () => {
  it('keeps a normal reply as one clip so the caller does not hear a gap', () => {
    const text =
      'अच्छा, मैं अभी आपकी help कर देता हूँ। आप specifically किस बारे में जानना चाहते हैं?';
    expect(splitForTts(text)).toEqual([text]);
  });
});

describe('isLikelyTtsEcho', () => {
  it('treats the bot hearing its own line as echo', () => {
    expect(
      isLikelyTtsEcho(
        'आप कौन सा brand देखना चाहेंगे',
        'आप कौन सा brand देखना चाहेंगे Nike Adidas Puma या Levi\'s'
      )
    ).toBe(true);
  });

  it('does not treat a new customer sentence as echo', () => {
    expect(
      isLikelyTtsEcho(
        'मुझे real support team से बात करनी है',
        'आप कौन सा brand देखना चाहेंगे'
      )
    ).toBe(false);
  });
});

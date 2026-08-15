import { describe, expect, it } from 'vitest';
import {
  HONEST_NO_DETAILS,
  STILL_NO_DETAILS,
  isBusinessInfoQuestion,
  isRepeatedAssistantTurn,
  isWhoAreYouQuestion,
  lastUserContent,
  recentAssistantContents,
  resolveRepeatedReply,
} from './reply-repeat';

const IDENTITY_EN = 'I help customers of Student. How can I assist you today?';
const IDENTITY_EN_VARIANT = 'I help customers of Student. How may I assist you today?';
const IDENTITY_HI =
  'मैं Student के customers की मदद करने के लिए यहाँ हूँ. मैं समझता हूँ कि आप कुछ पूछना चाह रहे हैं.';
const OTHER_TURN = 'Thank you for calling. Our team will message you on WhatsApp.';
const TOOL = '<tool_call>request_human</tool_call>';

describe('isRepeatedAssistantTurn', () => {
  it('matches an exact previous turn', () => {
    expect(isRepeatedAssistantTurn(IDENTITY_EN, IDENTITY_EN)).toBe(true);
  });

  it('matches similar identity variants', () => {
    expect(isRepeatedAssistantTurn(IDENTITY_EN, IDENTITY_EN_VARIANT)).toBe(true);
  });

  it('does not match an unrelated turn', () => {
    expect(isRepeatedAssistantTurn(IDENTITY_EN, OTHER_TURN)).toBe(false);
  });
});

describe('recentAssistantContents', () => {
  it('walks backward and skips empty / non-assistant turns', () => {
    expect(
      recentAssistantContents(
        [
          { role: 'system', content: 'rules' },
          { role: 'assistant', content: 'first' },
          { role: 'user', content: 'ok' },
          { role: 'assistant', content: '  ' },
          { role: 'assistant', content: 'latest' },
        ],
        2
      )
    ).toEqual(['latest', 'first']);
  });
});

describe('isBusinessInfoQuestion', () => {
  it('matches the live Nirbhay call questions', () => {
    expect(isBusinessInfoQuestion('Um, I want to know about the business.')).toBe(true);
    expect(
      isBusinessInfoQuestion(
        'can you give me some of the details about your business, what you all do?'
      )
    ).toBe(true);
    expect(isBusinessInfoQuestion('can you give me some detail about your business?')).toBe(true);
    expect(isBusinessInfoQuestion('So which type of help you do?')).toBe(true);
  });

  it('does not treat who-are-you as a business-details question', () => {
    expect(isBusinessInfoQuestion('who are you?')).toBe(false);
    expect(isBusinessInfoQuestion('what is your name?')).toBe(false);
  });
});

describe('isWhoAreYouQuestion', () => {
  it('matches identity questions', () => {
    expect(isWhoAreYouQuestion('who are you?')).toBe(true);
    expect(isWhoAreYouQuestion('what is your name?')).toBe(true);
    expect(isWhoAreYouQuestion('आप कौन हो')).toBe(true);
  });

  it('does not match business-detail questions', () => {
    expect(isWhoAreYouQuestion('I want to know about the business.')).toBe(false);
  });
});

describe('lastUserContent', () => {
  it('returns the latest user turn', () => {
    expect(
      lastUserContent([
        { role: 'assistant', content: IDENTITY_EN },
        { role: 'user', content: 'tell me about the business' },
      ])
    ).toBe('tell me about the business');
  });
});

describe('resolveRepeatedReply', () => {
  it('leaves the first identity sentence alone when there is no previous turn', () => {
    expect(resolveRepeatedReply(IDENTITY_EN, [])).toBe(IDENTITY_EN);
    expect(resolveRepeatedReply(IDENTITY_EN, null)).toBe(IDENTITY_EN);
    expect(resolveRepeatedReply(IDENTITY_EN, [], 'who are you?')).toBe(IDENTITY_EN);
  });

  it('keeps the identity sentence when they ask who-are-you again', () => {
    expect(resolveRepeatedReply(IDENTITY_EN, [IDENTITY_EN], 'who are you?')).toBe(IDENTITY_EN);
  });

  it('keeps FAQ facts when the model prefixes the identity sentence', () => {
    const mixed = `${IDENTITY_EN} We are open 9 to 6 every day.`;
    expect(resolveRepeatedReply(mixed, [], 'what are your hours?')).toBe(
      'We are open 9 to 6 every day.'
    );
    expect(
      resolveRepeatedReply(mixed, [IDENTITY_EN], 'I want to know about the business.')
    ).toBe('We are open 9 to 6 every day.');
  });

  it('does not replace a repeated non-identity FAQ answer with the honest fallback', () => {
    const hours = 'We are open 9 to 6 every day.';
    expect(resolveRepeatedReply(hours, [hours])).toBe(hours);
  });

  it('replaces first-turn identity when the caller asked for business details', () => {
    expect(
      resolveRepeatedReply(IDENTITY_EN, [], 'I want to know about the business.')
    ).toBe(HONEST_NO_DETAILS);
    expect(
      resolveRepeatedReply(IDENTITY_EN, [], 'can you give me some detail about your business?')
    ).toBe(HONEST_NO_DETAILS);
  });

  it('replaces identity after a greeting when the caller asked for business details', () => {
    expect(
      resolveRepeatedReply(
        IDENTITY_EN,
        ['Hello! Thank you for calling. How can I help you?'],
        'Um, I want to know about the business.'
      )
    ).toBe(HONEST_NO_DETAILS);
  });

  it('replaces a repeated identity turn with the honest no-details line', () => {
    expect(resolveRepeatedReply(IDENTITY_EN, [IDENTITY_EN])).toBe(HONEST_NO_DETAILS);
    expect(resolveRepeatedReply(IDENTITY_EN_VARIANT, [IDENTITY_EN])).toBe(HONEST_NO_DETAILS);
  });

  it('uses the second fallback after an honest no-details turn', () => {
    expect(resolveRepeatedReply(IDENTITY_EN, [HONEST_NO_DETAILS])).toBe(STILL_NO_DETAILS);
    expect(resolveRepeatedReply(HONEST_NO_DETAILS, [HONEST_NO_DETAILS])).toBe(STILL_NO_DETAILS);
  });

  it('still treats a repeat after a different intervening turn as a loop', () => {
    expect(resolveRepeatedReply(IDENTITY_EN, [OTHER_TURN, IDENTITY_EN])).toBe(HONEST_NO_DETAILS);
  });

  it('treats Hindi identity as a repeat of an earlier English identity', () => {
    expect(resolveRepeatedReply(IDENTITY_HI, [IDENTITY_EN])).toBe(HONEST_NO_DETAILS);
  });

  it('treats identity after the honest line as a loop even if wording differs', () => {
    expect(resolveRepeatedReply(IDENTITY_HI, [HONEST_NO_DETAILS])).toBe(STILL_NO_DETAILS);
  });

  it('preserves <tool_call> tags when replacing spoken text', () => {
    const reply = `${IDENTITY_EN}\n${TOOL}`;
    expect(resolveRepeatedReply(reply, [IDENTITY_EN])).toBe(`${HONEST_NO_DETAILS}\n${TOOL}`);
  });

  it('leaves a tool-call-only reply unchanged', () => {
    expect(resolveRepeatedReply(TOOL, [IDENTITY_EN])).toBe(TOOL);
  });
});

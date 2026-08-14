import { describe, expect, it } from 'vitest';
import { isVoiceBackchannel, wantsCallbackOnCall, wantsEndCall, wantsHumanOnCall } from './voice-intent';

describe('wantsHumanOnCall', () => {
  it('matches a clear ask to speak to someone', () => {
    expect(wantsHumanOnCall('Can I talk to an agent?')).toBe(true);
    expect(wantsHumanOnCall('मुझे किसी से बात करनी है')).toBe(true);
    expect(
      wantsHumanOnCall('तुम तो एक AI हो मुझे like real support team से बात करनी है')
    ).toBe(true);
  });

  it('does not steal ordinary sentences that mention a person', () => {
    expect(wantsHumanOnCall('I am the person who placed the order')).toBe(false);
    expect(wantsHumanOnCall('The manager already called me yesterday')).toBe(false);
  });
});

describe('wantsCallbackOnCall', () => {
  it('matches an explicit call-back request', () => {
    expect(wantsCallbackOnCall('Please call me back tomorrow')).toBe(true);
    expect(wantsCallbackOnCall('कॉल बैक कर दो')).toBe(true);
  });

  it('does not fire on schedule or generic call talk', () => {
    expect(wantsCallbackOnCall('I scheduled a visit yesterday')).toBe(false);
    expect(wantsCallbackOnCall('I wanted to call about my order')).toBe(false);
  });
});

describe('wantsEndCall', () => {
  it('matches hang up in English and Hindi', () => {
    expect(wantsEndCall('please hang up')).toBe(true);
    expect(wantsEndCall('तुमको अभी call रख देनी चाहिए थी')).toBe(true);
    expect(wantsEndCall('bye')).toBe(true);
  });

  it('does not treat a callback request as hang up', () => {
    expect(wantsEndCall('Please call me back tomorrow')).toBe(false);
  });
});

describe('isVoiceBackchannel', () => {
  it('ignores filler like hmm and ok', () => {
    expect(isVoiceBackchannel('हम्म')).toBe(true);
    expect(isVoiceBackchannel('OK.')).toBe(true);
    expect(isVoiceBackchannel('मुझे business की जानकारी चाहिए')).toBe(false);
  });
});

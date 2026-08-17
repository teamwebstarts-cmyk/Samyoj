import { describe, expect, it } from 'vitest';
import { isVoiceBackchannel, wantsCallbackOnCall, wantsEndCall, wantsHumanOnCall } from './voice-intent';

describe('wantsHumanOnCall', () => {
  it('matches a clear ask to speak to someone', () => {
    expect(wantsHumanOnCall('Can I talk to an agent?')).toBe(true);
    expect(wantsHumanOnCall('talk to an agent')).toBe(true);
    expect(wantsHumanOnCall('connect me to a human')).toBe(true);
    expect(wantsHumanOnCall('मुझे किसी से बात करनी है')).toBe(true);
    expect(wantsHumanOnCall('सपोर्ट टीम से बात करनी है')).toBe(true);
    expect(wantsHumanOnCall('किसी को बात करवा दो')).toBe(true);
    expect(
      wantsHumanOnCall('तुम तो एक AI हो मुझे like real support team से बात करनी है')
    ).toBe(true);
    expect(wantsHumanOnCall('team ko bata do mujhe team se baat karni hai')).toBe(true);
    expect(wantsHumanOnCall('mujhe team se baat karni hai please')).toBe(true);
  });

  it('does not steal ordinary sentences that mention a person or support', () => {
    expect(wantsHumanOnCall('I am the person who placed the order')).toBe(false);
    expect(wantsHumanOnCall('The manager already called me yesterday')).toBe(false);
    expect(wantsHumanOnCall('tell me about support')).toBe(false);
    expect(wantsHumanOnCall('tell me about your support hours')).toBe(false);
    expect(wantsHumanOnCall('support के बारे में बताओ')).toBe(false);
    expect(wantsHumanOnCall('मुझे टीम से बात करनी है')).toBe(false);
    expect(wantsHumanOnCall('नहीं मुझे अभी तुमसे बात करनी है।')).toBe(false);
    expect(wantsHumanOnCall('मुझे automation में help चाहिए थी')).toBe(false);
  });
});

describe('wantsCallbackOnCall', () => {
  it('matches an explicit call-back request', () => {
    expect(wantsCallbackOnCall('Please call me back tomorrow')).toBe(true);
    expect(wantsCallbackOnCall('call me back')).toBe(true);
    expect(wantsCallbackOnCall('कॉल बैक कर दो')).toBe(true);
  });

  it('does not fire on schedule or generic call talk', () => {
    expect(wantsCallbackOnCall('I scheduled a visit yesterday')).toBe(false);
    expect(wantsCallbackOnCall('I wanted to call about my order')).toBe(false);
  });
});

describe('wantsEndCall', () => {
  it('matches clear hang up in English and Hindi', () => {
    expect(wantsEndCall('please hang up')).toBe(true);
    expect(wantsEndCall('hang up')).toBe(true);
    expect(wantsEndCall('end the call')).toBe(true);
    expect(wantsEndCall('कॉल काट दो')).toBe(true);
    expect(wantsEndCall('call रख दो')).toBe(true);
    expect(wantsEndCall('कॉल रख दो')).toBe(true);
    expect(wantsEndCall('तुमको अभी call रख देनी चाहिए थी')).toBe(true);
    expect(wantsEndCall('goodbye')).toBe(true);
    expect(wantsEndCall('bye bye')).toBe(true);
  });

  it('does not hang up on greedy fragments or callbacks', () => {
    expect(wantsEndCall('bye')).toBe(false);
    expect(wantsEndCall('Bye.')).toBe(false);
    expect(wantsEndCall('रख दे')).toBe(false);
    expect(wantsEndCall('इसको रख दे')).toBe(false);
    expect(wantsEndCall('Please call me back tomorrow')).toBe(false);
    expect(wantsEndCall('call me back')).toBe(false);
  });
});

describe('isVoiceBackchannel', () => {
  it('ignores filler like hmm and ok', () => {
    expect(isVoiceBackchannel('हम्म')).toBe(true);
    expect(isVoiceBackchannel('OK.')).toBe(true);
    expect(isVoiceBackchannel('मुझे business की जानकारी चाहिए')).toBe(false);
  });
});

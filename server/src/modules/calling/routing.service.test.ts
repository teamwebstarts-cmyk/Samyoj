import { describe, expect, it } from 'vitest';
import {
  pickCallBotId,
  routeWhenClosed,
  shouldAiAnswerAfterAgentTimeout,
  shouldRouteCallToAi,
} from './routing.service';

describe('shouldRouteCallToAi', () => {
  it('is fail-closed when the user turned AI calling off', () => {
    expect(shouldRouteCallToAi({ aiAutoAnswer: false, answeringBotEnabled: true })).toBe(false);
  });

  it('is fail-closed when no calling bot is set to answer all calls', () => {
    expect(shouldRouteCallToAi({ aiAutoAnswer: true, answeringBotEnabled: false })).toBe(false);
  });

  it('allows AI only when calling is on and an answering bot is ready', () => {
    expect(shouldRouteCallToAi({ aiAutoAnswer: true, answeringBotEnabled: true })).toBe(true);
  });

  it('never sends a person-only contact to AI even if org All-calls is on', () => {
    expect(
      shouldRouteCallToAi({
        aiAutoAnswer: true,
        answeringBotEnabled: true,
        contactCallingAiEnabled: false,
      })
    ).toBe(false);
  });

  it('sends a contact flagged for AI when global calling and an answering bot are on', () => {
    expect(
      shouldRouteCallToAi({
        aiAutoAnswer: true,
        answeringBotEnabled: true,
        contactCallingAiEnabled: true,
      })
    ).toBe(true);
  });

  it('never sends AI when the global calling switch is off, even if this person is flagged always-AI', () => {
    expect(
      shouldRouteCallToAi({
        aiAutoAnswer: false,
        answeringBotEnabled: true,
        contactCallingAiEnabled: true,
      })
    ).toBe(false);
  });

  it('does not fight All-calls off: no answering bot means no AI even for an always-AI contact', () => {
    expect(
      shouldRouteCallToAi({
        aiAutoAnswer: true,
        answeringBotEnabled: false,
        contactCallingAiEnabled: true,
      })
    ).toBe(false);
  });
});

describe('shouldAiAnswerAfterAgentTimeout', () => {
  it('does not take a person-only caller with AI after humans miss', () => {
    expect(
      shouldAiAnswerAfterAgentTimeout({
        aiAutoAnswer: true,
        hasBot: true,
        contactCallingAiEnabled: false,
      })
    ).toBe(false);
  });

  it('may fall back to AI when this person allows it and calling is on', () => {
    expect(
      shouldAiAnswerAfterAgentTimeout({
        aiAutoAnswer: true,
        hasBot: true,
        contactCallingAiEnabled: true,
      })
    ).toBe(true);
  });
});

describe('routeWhenClosed', () => {
  const msg = 'We are closed.';

  it('lets the assigned calling bot answer after hours even if in-hours AI calling is off', () => {
    expect(
      routeWhenClosed({
        afterHoursMode: 'ai',
        answeringBotEnabled: true,
        afterHoursMessage: msg,
      })
    ).toEqual({ mode: 'ai', reason: 'after_hours_ai' });
  });

  it('does not send a person-only contact to after-hours AI', () => {
    expect(
      routeWhenClosed({
        afterHoursMode: 'ai',
        answeringBotEnabled: true,
        contactCallingAiEnabled: false,
        afterHoursMessage: msg,
      })
    ).toEqual({ mode: 'missed', reason: 'after_hours_ai_unavailable' });
  });

  it('misses when after-hours AI is selected but no calling bot is assigned', () => {
    expect(
      routeWhenClosed({
        afterHoursMode: 'ai',
        answeringBotEnabled: false,
        afterHoursMessage: msg,
      })
    ).toEqual({ mode: 'missed', reason: 'after_hours_ai_unavailable' });
  });

  it('sends the after-hours chat message when that mode is selected', () => {
    expect(
      routeWhenClosed({
        afterHoursMode: 'message',
        answeringBotEnabled: true,
        afterHoursMessage: msg,
      })
    ).toEqual({ mode: 'missed', reason: 'after_hours', afterHoursMessage: msg });
  });

  it('misses when after-hours mode is missed', () => {
    expect(
      routeWhenClosed({
        afterHoursMode: 'missed',
        answeringBotEnabled: true,
        afterHoursMessage: msg,
      })
    ).toEqual({ mode: 'missed', reason: 'after_hours' });
  });
});

describe('pickCallBotId', () => {
  const empty = { id: 'empty', enabled: true, isDefault: true };
  const trained = { id: 'trained', enabled: true, isDefault: false };
  const calling = { id: 'calling', enabled: true, isDefault: false };

  it('uses the calling bot assigned to answer calls', () => {
    expect(
      pickCallBotId({
        assignedCallBotId: 'calling',
        bots: [empty, trained, calling],
      })
    ).toBe('calling');
  });

  it('does not fall back to another bot when All-calls is off', () => {
    expect(
      pickCallBotId({
        assignedCallBotId: null,
        bots: [empty, trained, calling],
      })
    ).toBeNull();
  });

  it('does not pick a random enabled bot when the assigned one is missing', () => {
    expect(
      pickCallBotId({
        assignedCallBotId: 'gone',
        bots: [trained, calling],
      })
    ).toBeNull();
  });

  it('ignores a disabled assigned bot instead of spawning a fallback', () => {
    expect(
      pickCallBotId({
        assignedCallBotId: 'calling',
        bots: [empty, trained, { ...calling, enabled: false }],
      })
    ).toBeNull();
  });

  it('returns null when no calling bots are enabled', () => {
    expect(
      pickCallBotId({
        assignedCallBotId: 'calling',
        bots: [{ ...calling, enabled: false }],
      })
    ).toBeNull();
  });
});

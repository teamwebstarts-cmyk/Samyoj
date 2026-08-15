import { describe, expect, it } from 'vitest';
import { pickCallBotId } from './routing.service';

describe('pickCallBotId', () => {
  const empty = { id: 'empty', enabled: true, isDefault: true };
  const trained = { id: 'trained', enabled: true, isDefault: false };
  const chatBot = { id: 'chat', enabled: true, isDefault: false };

  it('uses the brain assigned for WhatsApp calls', () => {
    expect(
      pickCallBotId({
        assignedCallBotId: 'chat',
        bots: [empty, trained, chatBot],
      })
    ).toBe('chat');
  });

  it('uses the default support bot when the user has not assigned a call brain', () => {
    expect(
      pickCallBotId({
        assignedCallBotId: null,
        bots: [empty, trained, chatBot],
      })
    ).toBe('empty');
  });

  it('does not pick a trained non-default bot over the org default', () => {
    expect(
      pickCallBotId({
        assignedCallBotId: null,
        bots: [trained, empty, chatBot],
      })
    ).toBe('empty');
  });

  it('falls back to the first enabled bot when nobody is marked default', () => {
    expect(
      pickCallBotId({
        assignedCallBotId: null,
        bots: [trained, chatBot],
      })
    ).toBe('trained');
  });

  it('ignores a disabled assigned bot and uses the default support bot', () => {
    expect(
      pickCallBotId({
        assignedCallBotId: 'chat',
        bots: [empty, trained, { ...chatBot, enabled: false }],
      })
    ).toBe('empty');
  });
});

import { describe, expect, it } from 'vitest';
import { pickCallBotId } from './routing.service';

describe('pickCallBotId', () => {
  const empty = { id: 'empty', enabled: true, isDefault: true, knowledgeCount: 0 };
  const trained = { id: 'trained', enabled: true, isDefault: false, knowledgeCount: 8 };
  const chatBot = { id: 'chat', enabled: true, isDefault: false, knowledgeCount: 1 };

  it('uses the brain assigned for WhatsApp calls', () => {
    expect(
      pickCallBotId({
        assignedCallBotId: 'chat',
        conversationBotId: 'empty',
        bots: [empty, trained, chatBot],
      })
    ).toBe('chat');
  });

  it('prefers the trained brain over an empty default or a chat-sticky bot', () => {
    expect(
      pickCallBotId({
        assignedCallBotId: null,
        conversationBotId: 'chat',
        bots: [empty, trained, chatBot],
      })
    ).toBe('trained');
  });

  it('falls back to the org default when nobody has Train items', () => {
    expect(
      pickCallBotId({
        assignedCallBotId: null,
        conversationBotId: null,
        bots: [empty, { ...chatBot, knowledgeCount: 0 }],
      })
    ).toBe('empty');
  });
});

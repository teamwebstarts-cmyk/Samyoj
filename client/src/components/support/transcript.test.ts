import { describe, expect, it } from 'vitest';
import { formatSupportTranscript, nameInitials, toApiChatMessages } from './transcript';
import type { SupportChatMessage } from './types';

const messages: SupportChatMessage[] = [
  { id: 'welcome', role: 'assistant', content: 'Welcome' },
  { id: '1', role: 'user', content: 'How do I connect WhatsApp?' },
  { id: '2', role: 'assistant', content: 'Click Connect WhatsApp in Settings.' },
];

describe('formatSupportTranscript', () => {
  it('skips the welcome line and labels speakers', () => {
    const text = formatSupportTranscript(messages);
    expect(text).not.toContain('Welcome');
    expect(text).toContain('User: How do I connect WhatsApp?');
    expect(text).toContain('Support AI: Click Connect WhatsApp in Settings.');
  });
});

describe('toApiChatMessages', () => {
  it('drops the local welcome message', () => {
    expect(toApiChatMessages(messages)).toEqual([
      { role: 'user', content: 'How do I connect WhatsApp?' },
      { role: 'assistant', content: 'Click Connect WhatsApp in Settings.' },
    ]);
  });

  it('keeps only the last 16 turns', () => {
    const long: SupportChatMessage[] = [
      { id: 'welcome', role: 'assistant', content: 'Welcome' },
      ...Array.from({ length: 20 }, (_, i) => ({
        id: String(i),
        role: (i % 2 === 0 ? 'user' : 'assistant') as SupportChatMessage['role'],
        content: `turn ${i}`,
      })),
    ];
    const payload = toApiChatMessages(long);
    expect(payload).toHaveLength(16);
    expect(payload[0]?.content).toBe('turn 4');
  });
});

describe('nameInitials', () => {
  it('uses first and last initials', () => {
    expect(nameInitials('Asha Mehta')).toBe('AM');
    expect(nameInitials('Rohit')).toBe('RO');
  });
});

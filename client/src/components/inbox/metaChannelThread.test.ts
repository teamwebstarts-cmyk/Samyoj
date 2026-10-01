import { describe, expect, it } from 'vitest';
import { mergeThreadMessage, replaceOptimisticMessage } from './metaChannelThread';
import type { Message } from '../../types';

function msg(partial: Partial<Message> & { id: string }): Message {
  return {
    conversationId: 'c1',
    direction: 'OUTBOUND',
    type: 'text',
    content: 'hi',
    status: 'SENT',
    createdAt: '2026-10-01T08:06:00.000Z',
    ...partial,
  } as Message;
}

describe('metaChannelThread', () => {
  it('replaces the matching optimistic bubble when the socket echo arrives first', () => {
    const optimistic = msg({ id: 'optimistic-1', status: 'PENDING' });
    const real = msg({ id: 'real-1', status: 'SENT' });
    expect(mergeThreadMessage([optimistic], real)).toEqual([real]);
  });

  it('does not add a second copy when HTTP confirm already replaced optimistic', () => {
    const real = msg({ id: 'real-1' });
    expect(mergeThreadMessage([real], real)).toEqual([real]);
  });

  it('drops leftover optimistic when HTTP confirm lands after the socket copy', () => {
    const optimistic = msg({ id: 'optimistic-1', status: 'PENDING' });
    const real = msg({ id: 'real-1' });
    expect(replaceOptimisticMessage([optimistic, real], 'optimistic-1', real)).toEqual([real]);
  });
});

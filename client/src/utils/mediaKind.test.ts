import { describe, expect, it } from 'vitest';
import { looksLikeGif, resolveVisualMediaKind } from '../components/inbox/mediaKind';
import type { Message } from '../types';

function msg(partial: Partial<Message>): Message {
  return {
    id: 'm1',
    conversationId: 'c1',
    direction: 'INBOUND',
    type: 'TEXT',
    content: '',
    status: 'DELIVERED',
    createdAt: new Date().toISOString(),
    ...partial,
  } as Message;
}

describe('looksLikeGif', () => {
  it('detects gif mime and filename', () => {
    expect(looksLikeGif('image/gif', null)).toBe(true);
    expect(looksLikeGif('video/mp4', 'clip.gif')).toBe(true);
    expect(looksLikeGif('video/mp4', 'giphy-abc.mp4')).toBe(true);
    expect(looksLikeGif('video/mp4', 'holiday.mp4')).toBe(false);
  });
});

describe('resolveVisualMediaKind', () => {
  it('classifies sticker / gif / video / image', () => {
    expect(
      resolveVisualMediaKind(msg({ type: 'IMAGE', metadata: { isSticker: true } }))
    ).toBe('sticker');
    expect(
      resolveVisualMediaKind(msg({ type: 'VIDEO', metadata: { mimeType: 'image/gif' } }))
    ).toBe('gif');
    expect(resolveVisualMediaKind(msg({ type: 'VIDEO', metadata: { mimeType: 'video/mp4' } }))).toBe(
      'video'
    );
    expect(resolveVisualMediaKind(msg({ type: 'IMAGE' }))).toBe('image');
  });
});

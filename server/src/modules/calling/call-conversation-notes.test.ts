import { beforeEach, describe, expect, it, vi } from 'vitest';
import prisma from '../../config/database';
import { AppError } from '../../utils/response';
import {
  addInternalNoteToCall,
  ensureConversationForCall,
  migrateLegacyCallNotes,
} from './call-conversation-notes';

vi.mock('../../config/database', () => ({
  default: {
    conversation: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    call: {
      update: vi.fn(),
    },
    internalNote: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

const conversation = prisma.conversation as unknown as {
  findFirst: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
};
const call = prisma.call as unknown as {
  update: ReturnType<typeof vi.fn>;
};
const internalNote = prisma.internalNote as unknown as {
  findFirst: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ensureConversationForCall', () => {
  it('reuses the linked conversation', async () => {
    conversation.findFirst.mockResolvedValue({ id: 'conv-1' });
    const result = await ensureConversationForCall({
      id: 'call-1',
      organizationId: 'org-1',
      conversationId: 'conv-1',
      contactId: 'c-1',
      whatsappNumberId: 'wa-1',
    });
    expect(result.id).toBe('conv-1');
    expect(conversation.create).not.toHaveBeenCalled();
  });

  it('finds the inbox conversation for the same contact + number', async () => {
    conversation.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'conv-inbox' });
    const result = await ensureConversationForCall({
      id: 'call-1',
      organizationId: 'org-1',
      conversationId: 'missing',
      contactId: 'c-1',
      whatsappNumberId: 'wa-1',
    });
    expect(result.id).toBe('conv-inbox');
    expect(call.update).toHaveBeenCalledWith({
      where: { id: 'call-1' },
      data: { conversationId: 'conv-inbox' },
    });
  });

  it('throws when the call has no contact workspace', async () => {
    await expect(
      ensureConversationForCall({
        id: 'call-1',
        organizationId: 'org-1',
        conversationId: null,
        contactId: null,
        whatsappNumberId: 'wa-1',
      })
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe('migrateLegacyCallNotes', () => {
  it('copies Call.metadata.notes into the conversation and clears the blob', async () => {
    internalNote.findFirst.mockResolvedValue(null);
    internalNote.create.mockResolvedValue({ id: 'n-1' });
    call.update.mockResolvedValue({});

    await migrateLegacyCallNotes({
      callId: 'call-1',
      conversationId: 'conv-1',
      userId: 'user-1',
      metadata: { notes: 'csfdfds', summary: 'kept' },
    });

    expect(internalNote.create).toHaveBeenCalledWith({
      data: {
        conversationId: 'conv-1',
        userId: 'user-1',
        content: 'csfdfds',
      },
    });
    expect(call.update).toHaveBeenCalledWith({
      where: { id: 'call-1' },
      data: { metadata: { summary: 'kept' } },
    });
  });

  it('does not duplicate an already-copied note', async () => {
    internalNote.findFirst.mockResolvedValue({ id: 'existing' });
    await migrateLegacyCallNotes({
      callId: 'call-1',
      conversationId: 'conv-1',
      userId: 'user-1',
      metadata: { notes: 'csfdfds' },
    });
    expect(internalNote.create).not.toHaveBeenCalled();
    expect(call.update).toHaveBeenCalled();
  });
});

describe('addInternalNoteToCall', () => {
  it('writes an InternalNote on the conversation, not Call.metadata', async () => {
    conversation.findFirst.mockResolvedValue({ id: 'conv-1' });
    internalNote.findFirst.mockResolvedValue(null);
    internalNote.create.mockResolvedValue({
      id: 'n-2',
      content: 'hello',
      user: { id: 'user-1', name: 'Ada' },
    });

    const result = await addInternalNoteToCall({
      call: {
        id: 'call-1',
        organizationId: 'org-1',
        conversationId: 'conv-1',
        contactId: 'c-1',
        whatsappNumberId: 'wa-1',
        metadata: {},
      },
      userId: 'user-1',
      content: 'hello',
    });

    expect(result.conversationId).toBe('conv-1');
    expect(result.note.content).toBe('hello');
    expect(internalNote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          conversationId: 'conv-1',
          userId: 'user-1',
          content: 'hello',
        },
      })
    );
  });
});

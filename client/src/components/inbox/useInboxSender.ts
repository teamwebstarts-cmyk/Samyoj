import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { inboxApi } from '../../services/api';
import { toastError, toastSuccess } from '../../utils/toast';
import { useDraft } from './useDraft';
import type { PendingAttachment } from './ChatComposer';
import type { Conversation, Message, SendMessagePayload, ServiceWindowInfo } from '../../types';

interface SenderDeps {
  selected: Conversation | null;
  serviceWindow: ServiceWindowInfo | undefined;
  appendSentMessage: (conversationId: string, sent: Message) => void;
  setMessages: Dispatch<SetStateAction<Message[]>>;
  onWindowClosed?: () => void;
}

function makeOptimisticId() {
  return `optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Composer state + send/upload/retry logic for the open conversation. */
export function useInboxSender({
  selected,
  serviceWindow,
  appendSentMessage,
  setMessages,
  onWindowClosed,
}: SenderDeps) {
  const { draft, setDraft, clearDraft } = useDraft(selected?.id);
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);

  const resetComposer = useCallback(() => {
    setAttachment((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    setReplyTo(null);
  }, []);

  const removeAttachment = useCallback(() => {
    setAttachment((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  }, []);

  const handleAttach = useCallback((file: File) => {
    const type = file.type.startsWith('image/')
      ? 'IMAGE'
      : file.type.startsWith('video/')
        ? 'VIDEO'
        : file.type.startsWith('audio/')
          ? 'AUDIO'
          : 'DOCUMENT';
    const limits = {
      IMAGE: 5 * 1024 * 1024,
      VIDEO: 16 * 1024 * 1024,
      AUDIO: 16 * 1024 * 1024,
      DOCUMENT: 100 * 1024 * 1024,
    } as const;
    const max = limits[type];
    if (file.size > max) {
      const label =
        type === 'IMAGE' ? '5 MB' : type === 'DOCUMENT' ? '100 MB' : '16 MB';
      toastError(`${type === 'IMAGE' ? 'Images' : type === 'DOCUMENT' ? 'Documents' : 'Media'} must be under ${label}`);
      return;
    }
    if (type === 'DOCUMENT' && !/pdf/i.test(file.type) && !/\.pdf$/i.test(file.name)) {
      toastError('Only PDF documents are supported for WhatsApp');
      return;
    }
    const previewUrl = type === 'IMAGE' ? URL.createObjectURL(file) : undefined;
    setAttachment({ file, previewUrl, type });
  }, []);

  const sendPayload = useCallback(
    async (payload: SendMessagePayload, successToast: string, optimisticId?: string) => {
      if (!selected) return false;
      setSending(true);
      try {
        const { data } = await inboxApi.send(selected.id, payload);
        const sent = data.data as Message;
        if (optimisticId) {
          setMessages((prev) => {
            const cleaned = prev.filter(
              (m) => m.id !== optimisticId && m.id !== sent.id
            );
            return [...cleaned, sent];
          });
        } else {
          appendSentMessage(selected.id, sent);
        }
        toastSuccess(successToast);
        return true;
      } catch (err: unknown) {
        if (optimisticId) {
          setMessages((prev) =>
            prev.map((m) => (m.id === optimisticId ? { ...m, status: 'FAILED' } : m))
          );
        }
        const ax = err as {
          response?: {
            status?: number;
            statusText?: string;
            data?: {
              error?: {
                message?: string;
                code?: number;
                details?: string;
              };
              meta?: { code?: number };
            };
          };
          message?: string;
        };
        const apiErr = ax?.response?.data?.error;
        const metaCode = apiErr?.code ?? ax?.response?.data?.meta?.code ?? undefined;
        const msgText =
          apiErr?.message || ax?.response?.statusText || ax?.message || 'Failed to send';
        const haystack = `${msgText} ${apiErr?.details || ''} ${ax?.response?.statusText || ''}`.toLowerCase();
        const isWindowClosed =
          metaCode === 131047 ||
          /131047/.test(haystack) ||
          (ax?.response?.status === 400 &&
            (/24[- ]hour window/.test(haystack) ||
              /window (has )?expired/.test(haystack) ||
              /customer must reply first/.test(haystack) ||
              /use (an )?(approved )?template/.test(haystack) ||
              /re-engagement/.test(haystack)));
        if (isWindowClosed) {
          onWindowClosed?.();
          toastError('24h window closed — switch to a template');
        } else {
          toastError(msgText);
        }
        return false;
      } finally {
        setSending(false);
      }
    },
    [selected, appendSentMessage, onWindowClosed, setMessages]
  );

  const uploadAttachment = async (file: File) => {
    const mimeType = file.type || 'application/octet-stream';
    const filename = file.name;
    try {
      const { data: urlRes } = await inboxApi.uploadUrl({ mimeType, size: file.size, filename });
      const info = urlRes.data as { mode: string; uploadUrl: string; mediaPath: string };
      if (info.mode === 'presigned') {
        const put = await fetch(info.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': mimeType },
        });
        if (!put.ok) throw new Error('Presigned upload failed');
        return { mediaPath: info.mediaPath, mimeType, filename };
      }
    } catch {
      /* fall through to direct upload */
    }
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
    const { data: upRes } = await inboxApi.uploadMedia({ mimeType, data: base64, filename });
    return { mediaPath: (upRes.data as { mediaPath: string }).mediaPath, mimeType, filename };
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !serviceWindow?.open) return;
    if (!draft.trim() && !attachment) return;

    const optimisticId = makeOptimisticId();
    const replyMeta = replyTo
      ? {
          replyToMessageId: replyTo.id,
          replyPreview: (replyTo.content || `[${replyTo.type}]`).slice(0, 120),
        }
      : undefined;

    const optimistic: Message = {
      id: optimisticId,
      conversationId: selected.id,
      direction: 'OUTBOUND',
      type: attachment?.type || 'TEXT',
      content: draft.trim() || attachment?.file.name || '',
      status: 'PENDING',
      metadata: replyMeta || null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    let payload: SendMessagePayload;
    if (attachment) {
      setSending(true);
      try {
        const uploaded = await uploadAttachment(attachment.file);
        payload = {
          type: attachment.type,
          content: draft.trim() || undefined,
          media: {
            mediaPath: uploaded.mediaPath,
            mimeType: uploaded.mimeType,
            filename: uploaded.filename,
            voice: uploaded.filename?.startsWith('voice-note-') || undefined,
          },
          ...(replyTo ? { replyToMessageId: replyTo.id } : {}),
        };
      } catch {
        toastError('Upload failed');
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        setSending(false);
        return;
      }
      setSending(false);
    } else {
      payload = {
        content: draft.trim(),
        ...(replyTo ? { replyToMessageId: replyTo.id } : {}),
      };
    }

    const ok = await sendPayload(payload, attachment ? 'Media sent' : 'Message sent', optimisticId);
    if (ok) {
      clearDraft();
      removeAttachment();
      setReplyTo(null);
    }
  };

  const handleSendTemplate = async (payload: {
    templateName: string;
    templateLanguage: string;
    templateParams?: { body?: string[]; header?: string[]; headerMediaUrl?: string };
  }) =>
    sendPayload(
      {
        type: 'TEMPLATE',
        templateName: payload.templateName,
        templateLanguage: payload.templateLanguage,
        templateParams: payload.templateParams,
      },
      'Template sent'
    );

  const handleReact = async (message: Message, emoji: string) => {
    if (!selected) return;
    // Optimistic chip update first — reaction API returns the *target* message,
    // not a new outbound row, so never call appendSentMessage.
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== message.id) return m;
        const existing = (m.metadata?.reactions || []).filter((r) => r.from !== 'agent');
        return {
          ...m,
          metadata: {
            ...m.metadata,
            reactions: [...existing, { emoji, from: 'agent' }],
          },
        };
      })
    );
    try {
      const { data } = await inboxApi.send(selected.id, {
        type: 'REACTION',
        reaction: { messageId: message.id, emoji },
      });
      const updated = data.data as Message;
      if (updated?.id) {
        setMessages((prev) =>
          prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m))
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== message.id) return m;
          return {
            ...m,
            metadata: {
              ...m.metadata,
              reactions: (m.metadata?.reactions || []).filter(
                (r) => !(r.from === 'agent' && r.emoji === emoji)
              ),
            },
          };
        })
      );
      toastError('Could not send reaction');
    }
  };

  const handleRetryMessage = async (message: Message) => {
    if (retryingId) return;
    if (message.id.startsWith('optimistic-')) {
      toastError('Original send failed — try composing again');
      return;
    }
    setRetryingId(message.id);
    setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, status: 'SENT' } : m)));
    try {
      const { data } = await inboxApi.retryMessage(message.id);
      const updated = (data.data?.message ?? data.data) as Message | undefined;
      if (updated?.id) {
        setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, ...updated } : m)));
      }
      toastSuccess('Message re-queued');
    } catch (err: unknown) {
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, status: 'FAILED' } : m)));
      const status = (err as { response?: { status?: number } })?.response?.status;
      toastError(status === 404 ? 'Retry is not available yet' : 'Retry failed');
    } finally {
      setRetryingId(null);
    }
  };

  return {
    draft,
    setDraft,
    sending,
    setSending,
    attachment,
    retryingId,
    replyTo,
    setReplyTo,
    resetComposer,
    removeAttachment,
    handleAttach,
    handleSend,
    handleSendTemplate,
    handleReact,
    sendPayload,
    handleRetryMessage,
  };
}

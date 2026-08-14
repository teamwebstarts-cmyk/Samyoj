import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { inboxApi } from '../../services/api';
import { toastError } from '../../utils/toast';
import { useDraft } from './useDraft';
import { MEDIA_LIMITS, MEDIA_LIMIT_LABELS } from './mediaLimits';
import { emitChatNotice } from './chatNoticeBus';
import type { PendingAttachment } from './ChatComposer';
import type { Conversation, Message, SendMessagePayload, ServiceWindowInfo, TemplateParams } from '../../types';

export { MEDIA_LIMITS, MEDIA_LIMIT_LABELS, VOICE_MAX_SECONDS } from './mediaLimits';

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

interface SendPayloadOptions {
  /** When true (default for templates/interactive), lock composer with sending spinner. */
  lockComposer?: boolean;
}

function noticeMediaLimit(conversationId: string | undefined, message: string) {
  if (!conversationId) {
    toastError(message);
    return;
  }
  emitChatNotice(conversationId, {
    kind: 'media-limit',
    message,
    tone: 'amber',
    icon: 'star',
  });
}

/** Chat-local error notice (failed send / upload / retry) — not a global dashboard toast. */
function noticeSendError(conversationId: string | undefined, message: string) {
  if (!conversationId) {
    toastError(message);
    return;
  }
  emitChatNotice(conversationId, {
    kind: 'send-error',
    message,
    tone: 'orange',
  });
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

  const handleAttach = useCallback(
    (file: File) => {
      const type = file.type.startsWith('image/')
        ? 'IMAGE'
        : file.type.startsWith('video/')
          ? 'VIDEO'
          : file.type.startsWith('audio/')
            ? 'AUDIO'
            : 'DOCUMENT';
      const max = MEDIA_LIMITS[type];
      if (file.size > max) {
        const label = MEDIA_LIMIT_LABELS[type];
        const noun =
          type === 'IMAGE'
            ? 'Photo'
            : type === 'VIDEO'
              ? 'Video'
              : type === 'AUDIO'
                ? 'Audio'
                : 'PDF';
        noticeMediaLimit(selected?.id, `${noun} must be under ${label}`);
        return;
      }
      if (type === 'DOCUMENT' && !/pdf/i.test(file.type) && !/\.pdf$/i.test(file.name)) {
        noticeMediaLimit(selected?.id, 'Only PDF documents are supported');
        return;
      }
      const previewUrl =
        type === 'IMAGE' || type === 'AUDIO' ? URL.createObjectURL(file) : undefined;
      setAttachment({ file, previewUrl, type });
    },
    [selected?.id]
  );

  const sendPayload = useCallback(
    async (payload: SendMessagePayload, optimisticId?: string, options?: SendPayloadOptions) => {
      if (!selected) return false;
      const lockComposer = options?.lockComposer !== false;
      if (lockComposer) setSending(true);
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
        // No global success toast — the outbound bubble / status is enough.
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
          noticeSendError(selected.id, '24h window closed — switch to a template');
        } else {
          noticeSendError(selected.id, msgText);
        }
        return false;
      } finally {
        if (lockComposer) setSending(false);
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

  /**
   * WhatsApp-like send: optimistic PENDING bubble + clear composer immediately.
   * Status lives on the bubble clock — do not lock the Send button with a spinner.
   */
  const handleSend = async (e?: React.FormEvent): Promise<boolean> => {
    e?.preventDefault();
    if (!selected || !serviceWindow?.open) return false;
    if (!draft.trim() && !attachment) return false;

    const text = draft.trim();
    const pendingAttachment = attachment;
    const pendingReply = replyTo;
    const optimisticId = makeOptimisticId();
    const replyMeta = pendingReply
      ? {
          replyToMessageId: pendingReply.id,
          replyPreview: (pendingReply.content || `[${pendingReply.type}]`).slice(0, 120),
        }
      : undefined;

    const optimistic: Message = {
      id: optimisticId,
      conversationId: selected.id,
      direction: 'OUTBOUND',
      type: pendingAttachment?.type || 'TEXT',
      content:
        text ||
        (pendingAttachment?.type === 'IMAGE'
          ? '[image]'
          : pendingAttachment?.type === 'VIDEO'
            ? '[video]'
            : pendingAttachment?.type === 'AUDIO'
              ? '[audio]'
              : pendingAttachment?.file.name || ''),
      status: 'PENDING',
      metadata: pendingAttachment
        ? {
            ...(replyMeta || {}),
            filename: pendingAttachment.file.name,
            mimeType: pendingAttachment.file.type || undefined,
          }
        : replyMeta || null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    // Clear composer immediately (WhatsApp-style) — before upload/HTTP.
    clearDraft();
    removeAttachment();
    setReplyTo(null);

    let payload: SendMessagePayload;
    if (pendingAttachment) {
      try {
        const uploaded = await uploadAttachment(pendingAttachment.file);
        payload = {
          type: pendingAttachment.type,
          content: text || undefined,
          media: {
            mediaPath: uploaded.mediaPath,
            mimeType: uploaded.mimeType,
            filename: uploaded.filename,
            voice: uploaded.filename?.startsWith('voice-note-') || undefined,
          },
          ...(pendingReply ? { replyToMessageId: pendingReply.id } : {}),
        };
      } catch {
        noticeSendError(selected.id, 'Upload failed');
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticId ? { ...m, status: 'FAILED' } : m))
        );
        // Restore composer so the agent can fix/retry without re-picking the file.
        if (text) setDraft(text);
        if (pendingAttachment) {
          const previewUrl =
            pendingAttachment.type === 'IMAGE' || pendingAttachment.type === 'AUDIO'
              ? URL.createObjectURL(pendingAttachment.file)
              : undefined;
          setAttachment({ ...pendingAttachment, previewUrl });
        }
        return false;
      }
    } else {
      payload = {
        content: text,
        ...(pendingReply ? { replyToMessageId: pendingReply.id } : {}),
      };
    }

    return sendPayload(payload, optimisticId, {
      lockComposer: false,
    });
  };

  const handleSendTemplate = async (payload: {
    templateName: string;
    templateLanguage: string;
    templateParams?: TemplateParams;
  }) =>
    sendPayload({
      type: 'TEMPLATE',
      templateName: payload.templateName,
      templateLanguage: payload.templateLanguage,
      templateParams: payload.templateParams,
    });

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
      noticeSendError(selected.id, 'Could not send reaction');
    }
  };

  const handleRetryMessage = async (message: Message) => {
    if (retryingId) return;
    if (message.id.startsWith('optimistic-')) {
      noticeSendError(selected?.id, 'Original send failed — try composing again');
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
      // Status on the bubble is enough — no success toast.
    } catch (err: unknown) {
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, status: 'FAILED' } : m)));
      const status = (err as { response?: { status?: number } })?.response?.status;
      noticeSendError(
        selected?.id,
        status === 404 ? 'Retry is not available yet' : 'Retry failed'
      );
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

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
}

/** Composer state + send/upload/retry logic for the open conversation. */
export function useInboxSender({ selected, serviceWindow, appendSentMessage, setMessages }: SenderDeps) {
  // Draft text persists per conversation (sessionStorage) via useDraft — chat
  // switches save/restore automatically, so resetComposer only clears media.
  const { draft, setDraft, clearDraft } = useDraft(selected?.id);
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<PendingAttachment | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const resetComposer = useCallback(() => {
    setAttachment((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
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
    const previewUrl = type === 'IMAGE' ? URL.createObjectURL(file) : undefined;
    setAttachment({ file, previewUrl, type });
  }, []);

  const sendPayload = useCallback(
    async (payload: SendMessagePayload, successToast: string) => {
      if (!selected) return false;
      setSending(true);
      try {
        const { data } = await inboxApi.send(selected.id, payload);
        appendSentMessage(selected.id, data.data as Message);
        toastSuccess(successToast);
        return true;
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response
          ?.data?.error?.message;
        toastError(msg || 'Failed to send');
        return false;
      } finally {
        setSending(false);
      }
    },
    [selected, appendSentMessage]
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
          },
        };
      } catch {
        toastError('Upload failed');
        setSending(false);
        return;
      }
      setSending(false);
    } else {
      payload = { content: draft.trim() };
    }
    const ok = await sendPayload(payload, attachment ? 'Media sent' : 'Message sent');
    if (ok) {
      clearDraft();
      removeAttachment();
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

  const handleRetryMessage = async (message: Message) => {
    if (retryingId) return;
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
    resetComposer,
    removeAttachment,
    handleAttach,
    handleSend,
    handleSendTemplate,
    sendPayload,
    handleRetryMessage,
  };
}

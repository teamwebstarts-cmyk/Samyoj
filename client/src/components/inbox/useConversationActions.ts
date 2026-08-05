import { useState, type Dispatch, type SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import { callingApi, inboxApi } from '../../services/api';
import { toastError, toastInbox, toastSuccess } from '../../utils/toast';
import { emitChatNotice } from './chatNoticeBus';
import type { Conversation } from '../../types';

interface ActionsDeps {
  conversations: Conversation[];
  selected: Conversation | null;
  setSelected: Dispatch<SetStateAction<Conversation | null>>;
  upsertConversation: (conv: Conversation, toTop?: boolean) => void;
}

/** Assign / status / bot / call-back / snooze / favorite / bulk actions for conversations. */
export function useConversationActions({
  conversations,
  selected,
  setSelected,
  upsertConversation,
}: ActionsDeps) {
  const navigate = useNavigate();
  const [assigning, setAssigning] = useState(false);
  const [botToggling, setBotToggling] = useState(false);
  const [botAssigning, setBotAssigning] = useState(false);
  const [callingBack, setCallingBack] = useState(false);

  const extractError = (err: unknown, fallback: string) =>
    (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
      ?.message || fallback;

  const findTarget = (targetId?: string) => {
    const id = targetId || selected?.id;
    if (!id) return { id: undefined, conversation: null };
    const conversation =
      conversations.find((c) => c.id === id) || (selected?.id === id ? selected : null);
    return { id, conversation };
  };

  const handleAssignAgent = async (agentId: string | null, conversationId?: string) => {
    const targetId = conversationId || selected?.id;
    if (!targetId) return;
    setAssigning(true);
    try {
      const { data } = await inboxApi.assign(targetId, agentId);
      const updated = data.data as Conversation;
      upsertConversation({ id: targetId, assignedAgent: updated.assignedAgent } as Conversation);
    } catch (err: unknown) {
      toastError(extractError(err, 'Failed to assign agent'));
    } finally {
      setAssigning(false);
    }
  };

  const handleStatusChange = async (status: string, conversationId?: string) => {
    const targetId = conversationId || selected?.id;
    if (!targetId) return;
    try {
      const { data } = await inboxApi.setStatus(targetId, status);
      const updated = data.data as Conversation;
      upsertConversation({ id: targetId, status: updated.status } as Conversation);
    } catch (err: unknown) {
      toastError(extractError(err, 'Failed to update status'));
    }
  };

  const handleToggleBot = async (conversationId?: string) => {
    const { id: targetId, conversation: target } = findTarget(conversationId);
    if (!target || !targetId) return;
    const turningOn = target.botActive === false || Boolean(target.botHandoffAt);
    setBotToggling(true);
    try {
      const { data } = await inboxApi.setBot(
        targetId,
        turningOn ? { active: true, resetHandoff: true } : { active: false }
      );
      const updated = data.data as Conversation;
      upsertConversation({
        id: targetId,
        botActive: updated.botActive,
        botHandoffAt: updated.botHandoffAt,
        activeBot: updated.activeBot,
      } as Conversation);
      const flowId = updated.activeFlow?.flowId || target.activeFlow?.flowId;
      toastInbox(turningOn ? 'AI bot is on' : 'AI bot is off', {
        icon: 'bot',
        ...(turningOn && flowId
          ? {
              actionLabel: 'View flow',
              onAction: () => navigate(`/automations/flows/${flowId}`),
            }
          : {}),
      });
    } catch (err: unknown) {
      toastError(extractError(err, 'Failed to update bot'));
    } finally {
      setBotToggling(false);
    }
  };

  /**
   * Assign which AI bot handles this conversation.
   * If the bot is paused/handed-off, also enable live so pick+on is one gesture.
   */
  const handleSetActiveBot = async (activeBotId: string | null, conversationId?: string) => {
    const { id: targetId, conversation: target } = findTarget(conversationId);
    if (!target || !targetId) return;
    const sameBot = (target.activeBot?.id ?? null) === activeBotId;
    const needsEnable = target.botActive === false || Boolean(target.botHandoffAt);
    if (sameBot && !needsEnable) return;
    setBotAssigning(true);
    try {
      const payload =
        needsEnable
          ? { activeBotId, active: true as const, resetHandoff: true as const }
          : { activeBotId };
      const { data } = await inboxApi.setBot(targetId, payload);
      const updated = data.data as Conversation;
      upsertConversation({
        id: targetId,
        activeBot: updated.activeBot,
        botActive: updated.botActive,
        botHandoffAt: updated.botHandoffAt,
      } as Conversation);
      toastInbox(
        updated.activeBot?.name
          ? needsEnable
            ? `${updated.activeBot.name} enabled`
            : `Chatbot set to ${updated.activeBot.name}`
          : needsEnable
            ? 'Default chatbot enabled'
            : 'Using org default chatbot',
        { icon: 'bot' }
      );
    } catch (err: unknown) {
      toastError(extractError(err, 'Failed to switch chatbot'));
    } finally {
      setBotAssigning(false);
    }
  };

  const handleCallBack = async () => {
    if (!selected) return;
    setCallingBack(true);
    try {
      // Meta requires per-user call permission before outbound (BIC).
      try {
        const { data: permRes } = await callingApi.permission(selected.contact.id);
        const perm = permRes.data as {
          granted?: boolean;
          canRequest?: boolean;
          callingEnabled?: boolean;
        };
        if (perm.callingEnabled === false) {
          toastError('Enable WhatsApp calling in Calls setup before placing outbound calls.');
          return;
        }
        if (!perm.granted) {
          if (perm.canRequest !== false) {
            await callingApi.requestPermission(selected.contact.id);
            toastSuccess('Ask-to-call sent. Call again after the customer allows WhatsApp calls.');
          } else {
            toastError('Cannot request call permission right now (Meta limit). Try again later.');
          }
          return;
        }
      } catch {
        // If permission check fails, still attempt — backend also enforces
      }

      const { data } = await callingApi.callback({
        contactId: selected.contact.id,
        conversationId: selected.id,
        phone: selected.contact.phone,
      });
      const callId = (data.data as { call?: { id: string } })?.call?.id;
      if (callId) navigate(`/calls/${callId}`);
    } catch (err: unknown) {
      const body = (err as { response?: { data?: { error?: { code?: string; message?: string } } } })
        ?.response?.data?.error;
      if (body?.code === 'CALL_PERMISSION_REQUIRED') {
        try {
          await callingApi.requestPermission(selected.contact.id);
          toastSuccess('Ask-to-call sent. Call again after the customer allows WhatsApp calls.');
          return;
        } catch {
          /* fall through */
        }
      }
      toastError(extractError(err, 'Could not start call.'));
    } finally {
      setCallingBack(false);
    }
  };

  const handleSnooze = async (untilIso: string, _label?: string, conversationId?: string) => {
    const targetId = conversationId || selected?.id;
    if (!targetId) return;
    try {
      await inboxApi.snooze(targetId, untilIso);
      upsertConversation({ id: targetId, status: 'SNOOZED', snoozedUntil: untilIso } as Conversation);
      if (selected?.id === targetId) setSelected(null);
    } catch (err: unknown) {
      toastError(extractError(err, 'Could not snooze conversation'));
    }
  };

  const handleUnsnooze = async (conversationId?: string) => {
    const targetId = conversationId || selected?.id;
    if (!targetId) return;
    try {
      await inboxApi.unsnooze(targetId);
      upsertConversation({ id: targetId, status: 'OPEN', snoozedUntil: null } as Conversation);
    } catch (err: unknown) {
      toastError(extractError(err, 'Could not unsnooze conversation'));
    }
  };

  const handleToggleFavorite = async (conversationId?: string) => {
    const { id: targetId, conversation: target } = findTarget(conversationId);
    if (!target || !targetId) return;
    const next = !target.isFavorite;
    upsertConversation({ id: targetId, isFavorite: next } as Conversation);
    emitChatNotice(targetId, {
      kind: next ? 'favorite-on' : 'favorite-off',
      message: next ? 'Added to favourites' : 'Removed from favourites',
      icon: 'star',
      tone: 'amber',
    });
    try {
      await inboxApi.favorite(targetId, next);
    } catch (err: unknown) {
      upsertConversation({ id: targetId, isFavorite: !next } as Conversation);
      toastError(extractError(err, 'Could not update favourite'));
    }
  };

  const handleMarkUnread = async (conversationId?: string) => {
    const { id: targetId } = findTarget(conversationId);
    if (!targetId) return;
    try {
      const { data } = await inboxApi.markUnread(targetId);
      const unreadCount =
        (data.data as { unreadCount?: number } | undefined)?.unreadCount ?? 1;
      upsertConversation({ id: targetId, unreadCount } as Conversation);
      if (selected?.id === targetId) setSelected(null);
      toastInbox('Marked as unread', { icon: 'star' });
    } catch (err: unknown) {
      toastError(extractError(err, 'Could not mark as unread'));
    }
  };

  const handleBulk = async (
    payload: {
      action: 'assign' | 'status' | 'snooze' | 'unsnooze';
      agentId?: string;
      status?: 'OPEN' | 'PENDING' | 'CLOSED';
      snoozedUntil?: string;
    },
    conversationIds: string[],
    agent?: { id: string; name: string }
  ) => {
    try {
      const { data } = await inboxApi.bulk({ conversationIds, ...payload });
      const result = data.data;
      const patchFor = (id: string): Conversation | null => {
        if (payload.action === 'assign') {
          // Skip local patch when the agent record isn't at hand — the
          // conversation:assigned socket event reconciles those rows.
          return agent ? ({ id, assignedAgent: agent } as Conversation) : null;
        }
        if (payload.action === 'status' && payload.status) {
          return { id, status: payload.status } as Conversation;
        }
        if (payload.action === 'snooze' && payload.snoozedUntil) {
          return { id, status: 'SNOOZED', snoozedUntil: payload.snoozedUntil } as Conversation;
        }
        if (payload.action === 'unsnooze') {
          return { id, status: 'OPEN', snoozedUntil: null } as Conversation;
        }
        return null;
      };
      const failedIds = new Set(result.failed.map((f) => f.id));
      for (const id of conversationIds) {
        if (failedIds.has(id)) continue;
        const patch = patchFor(id);
        if (patch) upsertConversation(patch);
      }
      if (result.failed.length > 0) {
        toastError(`${result.updated} updated · ${result.failed.length} failed`);
      }
      return result;
    } catch (err: unknown) {
      toastError(extractError(err, 'Bulk action failed'));
      return null;
    }
  };

  return {
    assigning,
    botToggling,
    botAssigning,
    callingBack,
    handleAssignAgent,
    handleStatusChange,
    handleToggleBot,
    handleSetActiveBot,
    handleCallBack,
    handleSnooze,
    handleUnsnooze,
    handleToggleFavorite,
    handleMarkUnread,
    handleBulk,
  };
}

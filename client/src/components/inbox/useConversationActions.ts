import { useState, type Dispatch, type SetStateAction } from 'react';
import { useNavigate } from 'react-router-dom';
import { callingApi, inboxApi } from '../../services/api';
import { toastError, toastSuccess } from '../../utils/toast';
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
      toastSuccess(agentId ? 'Agent assigned' : 'Agent unassigned');
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
      toastSuccess('Status updated');
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
      toastSuccess(turningOn ? 'AI bot resumed' : 'AI bot paused');
    } catch (err: unknown) {
      toastError(extractError(err, 'Failed to update bot'));
    } finally {
      setBotToggling(false);
    }
  };

  const handleCallBack = async () => {
    if (!selected) return;
    setCallingBack(true);
    try {
      const { data } = await callingApi.callback({
        contactId: selected.contact.id,
        conversationId: selected.id,
        phone: selected.contact.phone,
      });
      toastSuccess('Calling…');
      const callId = (data.data as { call?: { id: string } })?.call?.id;
      if (callId) navigate(`/calls/${callId}`);
    } catch (err: unknown) {
      toastError(extractError(err, 'Could not start call.'));
    } finally {
      setCallingBack(false);
    }
  };

  const handleSnooze = async (untilIso: string, label?: string, conversationId?: string) => {
    const targetId = conversationId || selected?.id;
    if (!targetId) return;
    try {
      await inboxApi.snooze(targetId, untilIso);
      upsertConversation({ id: targetId, status: 'SNOOZED', snoozedUntil: untilIso } as Conversation);
      toastSuccess(label ? `Snoozed — ${label}` : 'Conversation snoozed');
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
      toastSuccess('Conversation unsnoozed');
    } catch (err: unknown) {
      toastError(extractError(err, 'Could not unsnooze conversation'));
    }
  };

  const handleToggleFavorite = async (conversationId?: string) => {
    const { id: targetId, conversation: target } = findTarget(conversationId);
    if (!target || !targetId) return;
    const next = !target.isFavorite;
    upsertConversation({ id: targetId, isFavorite: next } as Conversation);
    try {
      await inboxApi.favorite(targetId, next);
    } catch (err: unknown) {
      upsertConversation({ id: targetId, isFavorite: !next } as Conversation);
      toastError(extractError(err, 'Could not update favourite'));
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
      } else {
        toastSuccess(`${result.updated} conversation${result.updated === 1 ? '' : 's'} updated`);
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
    callingBack,
    handleAssignAgent,
    handleStatusChange,
    handleToggleBot,
    handleCallBack,
    handleSnooze,
    handleUnsnooze,
    handleToggleFavorite,
    handleBulk,
  };
}

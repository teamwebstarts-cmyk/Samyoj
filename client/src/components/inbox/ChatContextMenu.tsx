import { useMemo } from 'react';
import {
  AlarmClock,
  BellOff,
  Bot,
  CheckCircle2,
  CheckSquare,
  Clock,
  Download,
  ListChecks,
  PauseCircle,
  PlayCircle,
  Square,
  Trash2,
  UserMinus,
  UserPlus,
  X,
  XCircle,
} from 'lucide-react';
import ContextMenu, { type ContextMenuItem } from '../ui/ContextMenu';
import ContactAvatar from './ContactAvatar';
import type { Conversation, TeamAgent } from '../../types';

interface ChatContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  conversation: Conversation | null;
  agents: TeamAgent[];
  currentUserId?: string;
  botIsLive: boolean;
  assigning: boolean;
  botToggling: boolean;
  selectionMode: boolean;
  isConversationSelected: boolean;
  onClose: () => void;
  onAssign: (agentId: string | null) => void;
  onToggleBot: () => void;
  onStatusChange: (status: string) => void;
  onSnoozeUntil: (untilIso: string, label: string) => void;
  onUnsnooze: () => void;
  onExport: () => void;
  onDelete: () => void;
  onSelectThis: () => void;
  onDeselectThis: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
}

function snoozePresets(): { id: string; label: string; until: string }[] {
  const in1h = new Date(Date.now() + 60 * 60 * 1000);
  const in4h = new Date(Date.now() + 4 * 60 * 60 * 1000);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return [
    { id: 'snooze-1h', label: 'Snooze 1 hour', until: in1h.toISOString() },
    { id: 'snooze-4h', label: 'Snooze 4 hours', until: in4h.toISOString() },
    { id: 'snooze-tomorrow', label: 'Snooze until tomorrow, 9:00 AM', until: tomorrow.toISOString() },
  ];
}

export default function ChatContextMenu({
  open,
  x,
  y,
  conversation,
  agents,
  currentUserId,
  botIsLive,
  assigning,
  botToggling,
  selectionMode,
  isConversationSelected,
  onClose,
  onAssign,
  onToggleBot,
  onStatusChange,
  onSnoozeUntil,
  onUnsnooze,
  onExport,
  onDelete,
  onSelectThis,
  onDeselectThis,
  onSelectAll,
  onClearSelection,
}: ChatContextMenuProps) {
  const items = useMemo<ContextMenuItem[]>(() => {
    if (!conversation) return [];

    const assignedId = conversation.assignedAgent?.id;
    const assignChildren: ContextMenuItem[] = [
      {
        id: 'unassign',
        label: 'Unassigned',
        description: 'Remove agent assignment',
        icon: UserMinus,
        onClick: () => onAssign(null),
        disabled: assigning || !assignedId,
        checked: !assignedId,
      },
      ...agents
        .filter((agent) => agent.id !== currentUserId)
        .map((agent) => ({
        id: `agent-${agent.id}`,
        label: agent.name,
        description: agent.email,
        icon: UserPlus,
        onClick: () => onAssign(agent.id),
        disabled: assigning,
        checked: assignedId === agent.id,
      })),
    ];

    if (currentUserId && agents.some((agent) => agent.id === currentUserId)) {
      const me = agents.find((agent) => agent.id === currentUserId)!;
      assignChildren.unshift({
        id: 'assign-me',
        label: 'Assign to me',
        description: me.email,
        icon: UserPlus,
        onClick: () => onAssign(currentUserId),
        disabled: assigning,
        checked: assignedId === currentUserId,
      });
    }

    const status = conversation.status;
    const isSnoozed = Boolean(
      conversation.snoozedUntil && new Date(conversation.snoozedUntil).getTime() > Date.now()
    ) || status === 'SNOOZED';

    const snoozeChildren: ContextMenuItem[] = snoozePresets().map((preset) => ({
      id: preset.id,
      label: preset.label,
      icon: AlarmClock,
      onClick: () =>
        onSnoozeUntil(
          preset.until,
          preset.label.replace(/^Snooze /, '').replace(/^until /, 'until ')
        ),
      checked: false,
    }));
    if (isSnoozed) {
      snoozeChildren.push({
        id: 'unsnooze',
        label: 'Unsnooze',
        icon: BellOff,
        onClick: onUnsnooze,
      });
    }

    const selectionItems: ContextMenuItem[] = [
      isConversationSelected
        ? {
            id: 'deselect-this',
            label: 'Deselect this chat',
            description: 'Remove from selection',
            icon: Square,
            onClick: onDeselectThis,
          }
        : {
            id: 'select-this',
            label: selectionMode ? 'Add to selection' : 'Select this chat',
            description: selectionMode
              ? 'Include this chat in the current selection'
              : 'Enter selection mode with this chat',
            icon: CheckSquare,
            onClick: onSelectThis,
          },
      {
        id: 'select-all',
        label: 'Select all in list',
        description: 'Select every chat currently shown',
        icon: ListChecks,
        onClick: onSelectAll,
      },
    ];
    if (selectionMode) {
      selectionItems.push({
        id: 'cancel-selection',
        label: 'Cancel selection',
        description: 'Clear selection and exit',
        icon: X,
        onClick: onClearSelection,
      });
    }

    return [
      ...selectionItems,
      { id: 'sep-selection', label: '', separator: true },
      {
        id: 'assign',
        label: 'Assign to',
        description: conversation.assignedAgent?.name || 'No agent assigned',
        icon: UserPlus,
        children: assignChildren,
      },
      {
        id: 'snooze',
        label: isSnoozed ? 'Snoozed' : 'Snooze',
        description: isSnoozed ? 'Pick a new time or unsnooze' : 'Hide until later',
        icon: AlarmClock,
        children: snoozeChildren,
      },
      {
        id: 'export',
        label: 'Export chat',
        description: 'Download transcript',
        icon: Download,
        onClick: onExport,
      },
      {
        id: 'bot-toggle',
        label: botIsLive ? 'Pause AI bot' : 'Enable AI bot',
        description: botIsLive ? 'Stop auto-replies for this chat' : 'Resume auto-replies',
        icon: botIsLive ? PauseCircle : PlayCircle,
        onClick: onToggleBot,
        disabled: botToggling,
        checked: botIsLive,
      },
      { id: 'sep-1', label: '', separator: true },
      {
        id: 'status-open',
        label: 'Mark as open',
        icon: CheckCircle2,
        onClick: () => onStatusChange('OPEN'),
        disabled: status === 'OPEN',
        checked: status === 'OPEN',
      },
      {
        id: 'status-pending',
        label: 'Mark as pending',
        icon: Clock,
        onClick: () => onStatusChange('PENDING'),
        disabled: status === 'PENDING',
        checked: status === 'PENDING',
      },
      {
        id: 'status-closed',
        label: 'Mark as closed',
        icon: XCircle,
        onClick: () => onStatusChange('CLOSED'),
        disabled: status === 'CLOSED',
        checked: status === 'CLOSED',
        danger: status !== 'CLOSED',
      },
      { id: 'sep-delete', label: '', separator: true },
      {
        id: 'delete-chat',
        label: 'Delete chat',
        description: 'Remove this conversation permanently',
        icon: Trash2,
        onClick: onDelete,
        danger: true,
      },
    ];
  }, [
    agents,
    assigning,
    botIsLive,
    botToggling,
    conversation,
    currentUserId,
    isConversationSelected,
    onAssign,
    onClearSelection,
    onDeselectThis,
    onDelete,
    onExport,
    onSelectAll,
    onSelectThis,
    onSnoozeUntil,
    onStatusChange,
    onToggleBot,
    onUnsnooze,
    selectionMode,
  ]);

  if (!conversation) return null;

  return (
    <ContextMenu
      open={open}
      x={x}
      y={y}
      onClose={onClose}
      header={
        <div className="flex items-center gap-3">
          <ContactAvatar
            name={conversation.contact.name}
            phone={conversation.contact.phone}
            size="sm"
          />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-extrabold text-neutral-900">
              {conversation.contact.name || conversation.contact.phone}
            </p>
            <p className="truncate text-[11px] font-medium text-neutral-500">
              {conversation.contact.phone}
            </p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-neutral-600 ring-1 ring-neutral-200/70">
            <Bot className="h-3 w-3" />
            Chat
          </span>
        </div>
      }
      items={items}
    />
  );
}

import { useMemo } from 'react';
import {
  CheckCircle2,
  CheckSquare,
  Clock,
  Square,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import ContextMenu, { type ContextMenuItem } from '../ui/ContextMenu';
import ContactAvatar from './ContactAvatar';
import type { Conversation } from '../../types';

interface ChatContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  conversation: Conversation | null;
  selectionMode: boolean;
  isConversationSelected: boolean;
  onClose: () => void;
  onStatusChange: (status: string) => void;
  onDelete: () => void;
  onSelectThis: () => void;
  onDeselectThis: () => void;
  onClearSelection: () => void;
}

export default function ChatContextMenu({
  open,
  x,
  y,
  conversation,
  selectionMode,
  isConversationSelected,
  onClose,
  onStatusChange,
  onDelete,
  onSelectThis,
  onDeselectThis,
  onClearSelection,
}: ChatContextMenuProps) {
  const items = useMemo<ContextMenuItem[]>(() => {
    if (!conversation) return [];

    const status = conversation.status;

    const selectionItems: ContextMenuItem[] = [];
    if (isConversationSelected) {
      selectionItems.push({
        id: 'deselect-this',
        label: 'Deselect this chat',
        icon: Square,
        onClick: onDeselectThis,
      });
    } else {
      selectionItems.push({
        id: 'select-this',
        label: selectionMode ? 'Add to selection' : 'Select this chat',
        icon: CheckSquare,
        onClick: onSelectThis,
      });
    }
    if (selectionMode) {
      selectionItems.push({
        id: 'cancel-selection',
        label: 'Cancel selection',
        icon: X,
        onClick: onClearSelection,
      });
    }

    const statusItems: ContextMenuItem[] = [
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
    ];

    return [
      ...selectionItems,
      { id: 'sep-selection', label: '', separator: true },
      ...statusItems,
      { id: 'sep-delete', label: '', separator: true },
      {
        id: 'delete-chat',
        label: 'Delete chat',
        icon: Trash2,
        onClick: onDelete,
        danger: true,
      },
    ];
  }, [
    conversation,
    isConversationSelected,
    onClearSelection,
    onDelete,
    onDeselectThis,
    onSelectThis,
    onStatusChange,
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
        <div className="flex items-center gap-2.5 px-0.5">
          <ContactAvatar
            name={conversation.contact.name}
            phone={conversation.contact.phone}
            size="sm"
          />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold text-theme-fg">
              {conversation.contact.name || conversation.contact.phone}
            </p>
            {conversation.contact.name && (
              <p className="truncate text-[11px] text-theme-muted">{conversation.contact.phone}</p>
            )}
          </div>
        </div>
      }
      items={items}
    />
  );
}

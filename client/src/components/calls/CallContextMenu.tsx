import { useMemo } from 'react';
import { CheckSquare, ListChecks, Square, Trash2, X } from 'lucide-react';
import ContextMenu, { type ContextMenuItem } from '../ui/ContextMenu';
import ContactAvatar from '../inbox/ContactAvatar';
import { callListTitle, formatPhoneDisplay } from './callUtils';

interface CallContextMenuCall {
  id: string;
  fromPhone: string;
  toPhone: string;
  direction?: string;
  contact?: { name?: string | null; phone: string } | null;
}

interface CallContextMenuProps {
  open: boolean;
  x: number;
  y: number;
  call: CallContextMenuCall | null;
  selectionMode: boolean;
  isCallSelected: boolean;
  allVisibleSelected: boolean;
  onClose: () => void;
  onSelectThis: () => void;
  onDeselectThis: () => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onDelete: () => void;
}

export default function CallContextMenu({
  open,
  x,
  y,
  call,
  selectionMode,
  isCallSelected,
  allVisibleSelected,
  onClose,
  onSelectThis,
  onDeselectThis,
  onSelectAll,
  onClearSelection,
  onDelete,
}: CallContextMenuProps) {
  const items = useMemo<ContextMenuItem[]>(() => {
    if (!call) return [];

    const selectionItems: ContextMenuItem[] = [];
    if (isCallSelected) {
      selectionItems.push({
        id: 'deselect-this',
        label: 'Deselect this call',
        icon: Square,
        onClick: onDeselectThis,
      });
    } else {
      selectionItems.push({
        id: 'select-this',
        label: selectionMode ? 'Add to selection' : 'Select this call',
        icon: CheckSquare,
        onClick: onSelectThis,
      });
    }

    selectionItems.push({
      id: 'select-all',
      label: allVisibleSelected ? 'Deselect all on this page' : 'Select all on this page',
      icon: ListChecks,
      onClick: onSelectAll,
    });

    if (selectionMode) {
      selectionItems.push({
        id: 'cancel-selection',
        label: 'Cancel selection',
        icon: X,
        onClick: onClearSelection,
      });
    }

    return [
      ...selectionItems,
      { id: 'sep-delete', label: '', separator: true },
      {
        id: 'delete-call',
        label: 'Delete this call',
        description: 'Remove this call from history',
        icon: Trash2,
        onClick: onDelete,
        danger: true,
      },
    ];
  }, [
    allVisibleSelected,
    call,
    isCallSelected,
    onClearSelection,
    onDelete,
    onDeselectThis,
    onSelectAll,
    onSelectThis,
    selectionMode,
  ]);

  if (!call) return null;

  const outbound = call.direction === 'BUSINESS_INITIATED';
  const phone = call.contact?.phone || (outbound ? call.toPhone : call.fromPhone);
  const title = callListTitle(call.contact?.name, phone);

  return (
    <ContextMenu
      open={open}
      x={x}
      y={y}
      onClose={onClose}
      header={
        <div className="flex items-center gap-2.5 px-0.5">
          <ContactAvatar name={call.contact?.name || undefined} phone={phone} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold text-theme-fg">{title}</p>
            {call.contact?.name ? (
              <p className="truncate text-[11px] text-theme-muted">{formatPhoneDisplay(phone)}</p>
            ) : null}
          </div>
        </div>
      }
      items={items}
    />
  );
}

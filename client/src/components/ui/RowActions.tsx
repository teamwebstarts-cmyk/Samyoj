import { Eye, Pencil, Trash2 } from 'lucide-react';
import { TableIconButton } from './TableActions';

interface RowActionsProps {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  viewLabel?: string;
  editLabel?: string;
  deleteLabel?: string;
  disabled?: boolean;
}

export default function RowActions({
  onView,
  onEdit,
  onDelete,
  viewLabel = 'View',
  editLabel = 'Edit',
  deleteLabel = 'Delete',
  disabled = false,
}: RowActionsProps) {
  if (!onView && !onEdit && !onDelete) return null;

  return (
    <div className="flex items-center justify-end gap-1.5">
      {onView && (
        <TableIconButton onClick={onView} icon={Eye} label={viewLabel} variant="default" disabled={disabled} />
      )}
      {onEdit && (
        <TableIconButton onClick={onEdit} icon={Pencil} label={editLabel} variant="default" disabled={disabled} />
      )}
      {onDelete && (
        <TableIconButton onClick={onDelete} icon={Trash2} label={deleteLabel} variant="danger" disabled={disabled} />
      )}
    </div>
  );
}

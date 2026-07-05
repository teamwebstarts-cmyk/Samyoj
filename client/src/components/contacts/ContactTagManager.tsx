import { useEffect, useMemo, useState } from 'react';
import { Pencil, Tag, Trash2 } from 'lucide-react';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import ConfirmDialog from '../ui/ConfirmDialog';
import SlideOver from '../ui/SlideOver';
import type { ContactTag } from '../../types';
import { ModalEmptyHint, ModalPanel } from '../ui/modalUi';

interface ContactTagManagerProps {
  open: boolean;
  onClose: () => void;
  tags: ContactTag[];
  onRename: (from: string, to: string) => Promise<void>;
  onDelete: (tag: string) => Promise<void>;
}

export default function ContactTagManager({
  open,
  onClose,
  tags,
  onRename,
  onDelete,
}: ContactTagManagerProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteTag, setDeleteTag] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setEditing(null);
      setRenameValue('');
      setDeleteTag(null);
    }
  }, [open]);

  const startRename = (tag: string) => {
    setEditing(tag);
    setRenameValue(tag);
  };

  const handleRename = async () => {
    if (!editing || !renameValue.trim() || renameValue.trim() === editing) return;
    setBusy(true);
    try {
      await onRename(editing, renameValue.trim());
      setEditing(null);
      setRenameValue('');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTag) return;
    setBusy(true);
    try {
      await onDelete(deleteTag);
      if (editing === deleteTag) {
        setEditing(null);
        setRenameValue('');
      }
      setDeleteTag(null);
    } finally {
      setBusy(false);
    }
  };

  const sortedTags = useMemo(() => {
    return [...tags].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [tags]);

  const canSaveRename =
    Boolean(editing) &&
    Boolean(renameValue.trim()) &&
    renameValue.trim() !== (editing ?? '');

  return (
    <>
      <SlideOver
        open={open}
        onClose={onClose}
        title="Manage tags"
        subtitle="Rename or remove tags across your contact list"
        size="md"
        icon={Tag}
        accent="violet"
        footer={
          <div className="flex justify-end">
            <AppButton onClick={onClose} size="sm">
              Done
            </AppButton>
          </div>
        }
      >
        <div className="space-y-4">
          {sortedTags.length === 0 ? (
            <ModalEmptyHint message="No tags yet. Add tags when creating or editing contacts." />
          ) : (
            <ModalPanel title={`Tags (${sortedTags.length})`} accent="violet">
              <div className="space-y-2.5">
                {sortedTags.map((tag) => (
                  <div key={tag.name} className="rounded-xl border border-theme-border bg-theme-surface p-3">
                    {editing === tag.name ? (
                      <div className="space-y-3">
                        <AppInput
                          label="Tag name"
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') void handleRename();
                            if (e.key === 'Escape') {
                              setEditing(null);
                              setRenameValue('');
                            }
                          }}
                        />
                        <div className="flex flex-wrap gap-2">
                          <AppButton size="sm" onClick={handleRename} loading={busy} disabled={!canSaveRename}>
                            Save
                          </AppButton>
                          <AppButton
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setEditing(null);
                              setRenameValue('');
                            }}
                          >
                            Cancel
                          </AppButton>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400">
                          <Tag className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-bold text-theme-fg">{tag.name}</p>
                          <p className="text-[11px] font-medium text-theme-muted">
                            {tag.count} contact{tag.count === 1 ? '' : 's'}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <AppButton
                            size="sm"
                            variant="ghost"
                            icon={<Pencil size={14} />}
                            onClick={() => startRename(tag.name)}
                            aria-label={`Rename ${tag.name}`}
                          />
                          <AppButton
                            size="sm"
                            variant="ghost"
                            icon={<Trash2 size={14} />}
                            onClick={() => setDeleteTag(tag.name)}
                            disabled={busy}
                            aria-label={`Remove ${tag.name}`}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ModalPanel>
          )}
        </div>
      </SlideOver>

      <ConfirmDialog
        open={Boolean(deleteTag)}
        onClose={() => setDeleteTag(null)}
        onConfirm={() => void handleDelete()}
        title="Remove tag?"
        description={`"${deleteTag}" will be removed from all contacts.`}
        confirmLabel="Remove tag"
        variant="danger"
        loading={busy}
      />
    </>
  );
}

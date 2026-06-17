import { useState } from 'react';
import { Pencil, Tag, Trash2 } from 'lucide-react';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import SlideOver from '../ui/SlideOver';
import type { ContactTag } from '../../types';

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

  const handleDelete = async (tag: string) => {
    if (!confirm(`Remove tag "${tag}" from all contacts?`)) return;
    setBusy(true);
    try {
      await onDelete(tag);
      if (editing === tag) {
        setEditing(null);
        setRenameValue('');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
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
          <AppButton onClick={onClose}>Done</AppButton>
        </div>
      }
    >
      <div className="space-y-3">
        {tags.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-theme-border bg-theme-subtle/50 px-4 py-10 text-center">
            <p className="text-[13px] font-semibold text-theme-secondary">No tags yet</p>
            <p className="mt-1 text-[12px] text-theme-muted">
              Add tags when creating or editing contacts.
            </p>
          </div>
        ) : (
          tags.map((tag) => (
            <div
              key={tag.name}
              className="flex items-center gap-3 rounded-2xl border border-violet-200/50 bg-gradient-to-r from-violet-50/60 to-theme-surface p-3 transition hover:border-violet-300/60 dark:border-violet-800/40 dark:from-violet-950/20"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 text-white shadow-[0_4px_12px_rgba(139,92,246,0.28)]">
                <Tag className="h-4 w-4" />
              </div>

              {editing === tag.name ? (
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <AppInput
                    className="flex-1"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    autoFocus
                  />
                  <AppButton size="sm" onClick={handleRename} loading={busy}>
                    Save
                  </AppButton>
                  <AppButton
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditing(null);
                      setRenameValue('');
                    }}
                  >
                    Cancel
                  </AppButton>
                </div>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold text-neutral-900 dark:text-slate-100">
                      {tag.name}
                    </p>
                    <p className="text-[11px] font-medium text-neutral-500 dark:text-slate-400">
                      {tag.count} contact{tag.count === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <AppButton
                      size="sm"
                      variant="ghost"
                      icon={<Pencil size={14} />}
                      onClick={() => startRename(tag.name)}
                    >
                      Rename
                    </AppButton>
                    <AppButton
                      size="sm"
                      variant="ghost"
                      icon={<Trash2 size={14} />}
                      onClick={() => handleDelete(tag.name)}
                      disabled={busy}
                    >
                      Remove
                    </AppButton>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </SlideOver>
  );
}

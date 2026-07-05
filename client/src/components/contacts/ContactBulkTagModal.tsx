import { useEffect, useMemo, useState } from 'react';
import { Tag } from 'lucide-react';
import AppButton from '../ui/AppButton';
import AppInput from '../ui/AppInput';
import SlideOver from '../ui/SlideOver';
import { ModalCallout, ModalPanel } from '../ui/modalUi';

interface ContactBulkTagModalProps {
  open: boolean;
  onClose: () => void;
  selectedCount: number;
  availableTags: string[];
  bulkTags: string;
  onBulkTagsChange: (value: string) => void;
  onAddTags: () => void;
  onRemoveTags: () => void;
  busy?: boolean;
}

function parseTagList(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export default function ContactBulkTagModal({
  open,
  onClose,
  selectedCount,
  availableTags,
  bulkTags,
  onBulkTagsChange,
  onAddTags,
  onRemoveTags,
  busy,
}: ContactBulkTagModalProps) {
  const [mode, setMode] = useState<'add' | 'remove'>('add');

  useEffect(() => {
    if (!open) setMode('add');
  }, [open]);

  const selectedTags = useMemo(() => parseTagList(bulkTags), [bulkTags]);
  const canSubmit = selectedTags.length > 0 && !busy;

  const toggleTag = (tag: string) => {
    const current = new Set(selectedTags);
    if (current.has(tag)) {
      current.delete(tag);
    } else {
      current.add(tag);
    }
    onBulkTagsChange(Array.from(current).join(', '));
  };

  const handleSubmit = () => {
    if (!canSubmit) return;
    if (mode === 'add') onAddTags();
    else onRemoveTags();
  };

  return (
    <SlideOver
      open={open}
      onClose={onClose}
      title={mode === 'add' ? 'Add tags' : 'Remove tags'}
      subtitle={`Apply to ${selectedCount} selected contact${selectedCount === 1 ? '' : 's'}`}
      size="md"
      icon={Tag}
      accent="violet"
      footer={
        <div className="flex w-full flex-wrap items-center gap-2">
          <AppButton
            variant="secondary"
            size="sm"
            onClick={onClose}
            disabled={busy}
            className="flex-1 sm:flex-none"
          >
            Cancel
          </AppButton>
          <AppButton
            size="sm"
            loading={busy}
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="flex-1 sm:flex-none"
          >
            {mode === 'add' ? 'Add tags' : 'Remove tags'}
          </AppButton>
        </div>
      }
    >
      <div className="space-y-5">
        <ModalCallout
          icon={Tag}
          accent="violet"
          title="Bulk tag update"
          description="Choose existing tags or type new ones separated by commas. Changes apply to all selected contacts."
        />

        <div className="flex gap-2 rounded-xl bg-theme-subtle p-1">
          {(['add', 'remove'] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setMode(option)}
              className={`flex-1 rounded-lg px-3 py-2.5 text-[12px] font-bold transition ${
                mode === option
                  ? 'bg-theme-surface text-violet-700 shadow-sm ring-1 ring-violet-500/20 dark:text-violet-300'
                  : 'text-theme-secondary hover:text-theme-fg'
              }`}
            >
              {option === 'add' ? 'Add tags' : 'Remove tags'}
            </button>
          ))}
        </div>

        <AppInput
          label="Tags"
          hint="Comma separated"
          placeholder="vip, lead, follow-up"
          value={bulkTags}
          onChange={(e) => onBulkTagsChange(e.target.value)}
          icon={<Tag className="h-4 w-4" />}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleSubmit();
            }
          }}
        />

        {availableTags.length > 0 && (
          <ModalPanel title="Existing tags" accent="violet">
            <div className="flex flex-wrap gap-2">
              {availableTags.map((tag) => {
                const active = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold transition ring-1 ${
                      active
                        ? 'bg-violet-100 text-violet-800 ring-violet-200/70 dark:bg-violet-900/40 dark:text-violet-300 dark:ring-violet-800/50'
                        : 'bg-theme-surface text-theme-secondary ring-theme-border hover:bg-theme-subtle hover:text-theme-fg'
                    }`}
                  >
                    <Tag className="h-3 w-3" />
                    {tag}
                  </button>
                );
              })}
            </div>
          </ModalPanel>
        )}

        {selectedTags.length > 0 && (
          <p className="text-[12px] font-medium text-theme-secondary">
            {selectedTags.length} tag{selectedTags.length === 1 ? '' : 's'} selected:{' '}
            <span className="font-semibold text-theme-fg">{selectedTags.join(', ')}</span>
          </p>
        )}
      </div>
    </SlideOver>
  );
}

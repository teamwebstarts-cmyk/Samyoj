import { useEffect } from 'react';
import { Eye, FileText, Link2, Phone, X } from 'lucide-react';
import type { CatalogListItem } from '../../../utils/templateLibrary';
import { ModalEmptyHint } from '../../ui/modalUi';
import { splitBodyParts } from './libraryBody';

const VARIABLE_CHIP =
  'mx-px inline-flex translate-y-px items-center rounded-md bg-emerald-50 px-1 py-0.5 font-mono text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200/70 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-800/60';

function ButtonRow({ button }: { button: NonNullable<CatalogListItem['buttons']>[number] }) {
  const type = (button.type || 'QUICK_REPLY').toUpperCase();
  const Icon = type === 'URL' ? Link2 : type === 'PHONE_NUMBER' ? Phone : FileText;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-theme-subtle px-3 py-1.5 text-[11px] font-semibold text-theme-secondary ring-1 ring-theme-border">
      <Icon className="h-3 w-3" strokeWidth={2.25} aria-hidden />
      {button.text || type}
{type === 'URL' && button.url ? <span className="text-[10px] font-medium text-theme-muted">· link</span> : null}
{type === 'PHONE_NUMBER' && button.phone_number ? <span className="text-[10px] font-medium text-theme-muted">· call</span> : null}
    </span>
  );
}

interface LibraryPreviewModalProps {
  item: CatalogListItem;
  bodyText: string;
  onClose: () => void;
}

/** Lightweight overlay preview of one library skeleton (variables stay {{N}} chips). */
export default function LibraryPreviewModal({ item, bodyText, onClose }: LibraryPreviewModalProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const parts = splitBodyParts(bodyText);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={`Preview ${item.title}`}>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-neutral-900">
        <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3 dark:border-neutral-800">
          <p className="text-[13px] font-bold text-neutral-900 dark:text-white">{item.title}</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close preview"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto px-4 py-4">
          {item.header ? (
            <p className="text-[12px] font-bold text-neutral-800 dark:text-neutral-200">{item.header}</p>
          ) : null}
          <p className="text-[13px] leading-relaxed text-neutral-600 dark:text-neutral-300">
            {parts.map((part, index) =>
              part.type === 'var' ? (
                <span key={index} className={VARIABLE_CHIP}>
                  {part.value}
                </span>
              ) : (
                <span key={index}>{part.value}</span>
              ),
            )}
          </p>
          {item.footer ? (
            <p className="text-[11px] font-medium text-neutral-400">{item.footer}</p>
          ) : null}

          <div className="flex flex-wrap items-center justify-center gap-2 border-t border-neutral-100 pt-3 dark:border-neutral-800">
            {(item.buttons || []).length ? (
              (item.buttons || []).map((button, index) => <ButtonRow key={index} button={button} />)
            ) : (
              <ModalEmptyHint message="This skeleton has no buttons." />
            )}
          </div>

          <p className="text-[11px] font-medium leading-relaxed text-neutral-500 dark:text-neutral-400">
            Meta reviews every clone on this number — even library skeletons. Samyoj cannot pre-approve templates.
          </p>
        </div>

        <div className="border-t border-neutral-100 px-4 py-3 dark:border-neutral-800">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-neutral-400">
            <Eye className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden /> Preview only — pick “Select” to use it
          </span>
        </div>
      </div>
    </div>
  );
}

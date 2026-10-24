import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode, SelectHTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

type Option = { value: string; label: string; disabled?: boolean };

/** option text = node text (same rule the native control uses for display). */
export function nodeText(node: ReactNode): string {
  if (node === null || node === undefined || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(nodeText).join('');
  const el = node as { props?: { children?: ReactNode } };
  return el.props?.children !== undefined ? nodeText(el.props.children) : '';
}

export function flattenOptions(children: ReactNode, out: Option[]): void {
  (Array.isArray(children) ? children : [children]).forEach((child) => {
    if (!child) return;
    const el = child as { type?: unknown; props?: { value?: string; disabled?: boolean; children?: ReactNode } };
    const tag = typeof el.type === 'string' ? el.type : '';
    if (tag === 'option') {
      out.push({
        value: el.props?.value ?? nodeText(el.props?.children),
        label: nodeText(el.props?.children) || el.props?.value || '',
        disabled: el.props?.disabled,
      });
    } else if (tag === 'optgroup') {
      flattenOptions(el.props?.children, out);
    } else if (el.props?.children !== undefined) {
      // ponytail: optgroup labels are not rendered — flat list (admin selects use none)
      flattenOptions(el.props?.children, out);
    }
  });
}

/**
 * Admin AppSelect — native-select replacement whose open menu mirrors the
 * client's AppSelect menu (client/src/utils/selectStyles.ts): portal card,
 * 12px radius, 6px padded list, 8px rounded option pills, indigo selected
 * state. Control keeps the admin field look (h-9, rounded-lg, indigo focus).
 *
 * A real <select> stays in the DOM (visually hidden). Option clicks drive it
 * through the native value setter + a bubbling `change` event, so existing
 * controlled onChange contracts receive a genuine event.
 *
 * ponytail: no type-ahead search and no optgroup labels — arrows/Enter/Escape
 * cover keyboard; upgrade path is porting client AppSelect's full key handling.
 */
export function AppSelect({
  label,
  error,
  className = '',
  children,
  ...props
}: Omit<SelectHTMLAttributes<HTMLSelectElement>, 'children' | 'multiple' | 'size'> & {
  label?: string;
  error?: string;
  children: ReactNode;
}) {
  const autoId = useId();
  const selectId = props.id || autoId;
  const ariaLabel = (props as { 'aria-label'?: string })['aria-label'] ?? label;
  // Controlled value; uncontrolled `defaultValue` call sites (role/plan/status
  // selects) fall back to committed state after the first programmatic pick.
  const [committed, setCommitted] = useState<string | number | readonly string[] | undefined>(
    props.value ?? (props as { defaultValue?: string | number | readonly string[] }).defaultValue,
  );
  const value = props.value !== undefined ? props.value : committed;
  const isDisabled = Boolean(props.disabled);

  const options: Option[] = [];
  flattenOptions(children, options);

  const commit = (option: Option) => {
    if (option.disabled) return;
    if (String(option.value) !== String(value ?? '')) {
      const select = selectRef.current;
      const setter = select ? Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set : undefined;
      setter?.call(select, option.value);
      const event = new Event('change', { bubbles: true });
      select?.dispatchEvent(event);
      setCommitted(option.value);
      // Controlled call sites (value={x} onChange={setX}) don't listen to the
      // hidden select — its own onChange is a deliberate no-op — so hand them
      // the event directly, like every other button handler here.
      props.onChange?.(event as unknown as React.ChangeEvent<HTMLSelectElement>);
    }
    setOpen(false);
  };

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<number>(-1);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const [activeIndex, setActiveIndex] = useState(-1);

  // Position the fixed portal menu below (or above when tight).
  useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const menuHeight = Math.min(options.length * 34 + 12, 240);
      const below = window.innerHeight - rect.bottom;
      const placeAbove = below < menuHeight + 8 && rect.top > below;
      setMenuStyle({
        position: 'fixed',
        left: rect.left,
        width: rect.width,
        top: placeAbove ? undefined : rect.bottom + 6,
        bottom: placeAbove ? window.innerHeight - rect.top + 6 : undefined,
        zIndex: 10050,
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, options.length]);

  // Outside click + keyboard support while open.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const selected = options.findIndex((option) => option.value === String(value ?? ''));
    activeRef.current = selected;
    setActiveIndex(selected);
    requestAnimationFrame(() => {
      listRef.current?.querySelector<HTMLButtonElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        setActiveIndex((prev) => {
          const start = prev < 0 ? Math.max(0, options.findIndex((option) => option.value === String(value ?? ''))) : prev;
          let next = start;
          for (let step = 0; step < options.length; step += 1) {
            next = (next + delta + options.length) % options.length;
            if (!options[next].disabled) break;
          }
          activeRef.current = next;
          return next;
        });
      } else if (event.key === 'Enter') {
        event.preventDefault();
        const target = options[activeRef.current >= 0 ? activeRef.current : options.findIndex((option) => option.value === String(value ?? ''))];
        if (target) commit(target);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value, options.length]);

  return (
    <label className={`block space-y-1 text-[13px] ${className}`} htmlFor={selectId}>
      {label && <span className="font-semibold text-slate-700">{label}</span>}
      <div className="relative" ref={rootRef}>
        <button
          type="button"
          id={selectId}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={`${selectId}-menu`}
          aria-label={ariaLabel || undefined}
          disabled={isDisabled}
          onClick={() => setOpen((v) => !v)}
          className={`flex h-9 w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 text-left text-[13px] text-slate-900 shadow-sm transition-all focus:outline-none ${
            open ? 'border-indigo-600 ring-2 ring-indigo-500/20' : 'border-slate-200 hover:border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20'
          } ${isDisabled ? 'cursor-not-allowed opacity-50' : ''}`}
        >
          <span className="min-w-0 truncate">
            {options.find((option) => option.value === String(value ?? ''))?.label || '\u00a0'}
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>

        {/* Native select kept for form semantics; value driven via commit() above.
            Deliberately does NOT spread props: `value`/`id` are controlled here and
            the button carries the accessible name. */}
        <select
          ref={selectRef}
          value={value}
          onChange={() => { /* value is driven by commit(); React needs the handler to stay quiet */ }}
          name={props.name}
          disabled={props.disabled}
          tabIndex={-1}
          aria-hidden
          className="pointer-events-none absolute h-px w-px opacity-0"
        >
          {children}
        </select>

        {open &&
          createPortal(
            <div
              ref={menuRef}
              data-app-select-menu
              style={menuStyle}
              role="listbox"
              aria-labelledby={selectId}
              className="overflow-hidden rounded-xl border border-slate-200/85 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.12)]"
            >
              <div ref={listRef} className="max-h-[240px] overflow-y-auto p-1.5">
                {options.map((option) => {
                  const selected = option.value === String(value ?? '');
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      data-active={activeIndex === options.indexOf(option) || undefined}
                      disabled={option.disabled}
                      onMouseEnter={() => setActiveIndex(options.indexOf(option))}
                      onClick={() => commit(option)}
                      className={`flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-[13px] font-medium transition-colors ${
                        selected
                          ? 'bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200'
                          : option.disabled
                            ? 'cursor-not-allowed opacity-40 text-slate-400'
                            : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>,
            document.body,
          )}
      </div>
      {error && <span className="block text-[11px] font-medium text-rose-600">{error}</span>}
    </label>
  );
}

import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  ChevronRight,
  GitBranch,
  MapPinOff,
  Split,
} from 'lucide-react';
import SlideOver from '../ui/SlideOver';
import type { FlowNode } from '../../types';
import { nodeMeta } from './flowMeta';

interface ParsedWarning {
  id: string;
  title: string;
  stepLabel?: string;
  nodeId?: string;
  icon: LucideIcon;
}

interface FlowValidationWarningsProps {
  warnings: string[];
  errors?: string[];
  nodes: FlowNode[];
  onGoToStep?: (nodeId: string) => void;
  className?: string;
}

function getStepLabel(nodes: FlowNode[], nodeId: string): string {
  const index = nodes.findIndex((node) => node.id === nodeId);
  if (index < 0) return 'Unknown step';

  const node = nodes[index];
  const meta = nodeMeta[node.type];
  return `Step ${index + 1} · ${meta?.label || node.type}`;
}

function parseWarning(raw: string, nodes: FlowNode[]): ParsedWarning {
  const buttonMatch = raw.match(/^Button "(.+)" in step "(.+)" has no branch target$/);
  if (buttonMatch) {
    const [, buttonTitle, nodeId] = buttonMatch;
    return {
      id: raw,
      title: `"${buttonTitle}" needs a connected step`,
      stepLabel: getStepLabel(nodes, nodeId),
      nodeId,
      icon: GitBranch,
    };
  }

  const conditionMatch = raw.match(/^Condition step "(.+)" has no (true|false) branch$/);
  if (conditionMatch) {
    const [, nodeId, branch] = conditionMatch;
    return {
      id: raw,
      title: `Missing ${branch === 'true' ? 'Yes' : 'No'} next step`,
      stepLabel: getStepLabel(nodes, nodeId),
      nodeId,
      icon: Split,
    };
  }

  const unreachableMatch = raw.match(/^Step "(.+)" \((.+)\) is unreachable from start$/);
  if (unreachableMatch) {
    const [, nodeId, type] = unreachableMatch;
    const meta = nodeMeta[type as FlowNode['type']];
    return {
      id: raw,
      title: `${meta?.label || type} step is unreachable`,
      stepLabel: getStepLabel(nodes, nodeId),
      nodeId,
      icon: MapPinOff,
    };
  }

  return {
    id: raw,
    title: raw,
    icon: AlertTriangle,
  };
}

export default function FlowValidationWarnings({
  warnings,
  errors = [],
  nodes,
  onGoToStep,
  className = '',
}: FlowValidationWarningsProps) {
  const [open, setOpen] = useState(false);
  const hasBlocking = errors.length > 0;
  const items = hasBlocking ? errors : warnings;

  useEffect(() => {
    setOpen(false);
  }, [errors.length, warnings.length]);

  if (errors.length === 0 && warnings.length === 0) return null;

  const parsed = items.map((warning) => parseWarning(warning, nodes));
  const issueLabel = items.length === 1 ? (hasBlocking ? 'error' : 'warning') : hasBlocking ? 'errors' : 'warnings';
  const preview = parsed[0]?.title;
  const extraCount = (hasBlocking ? warnings.length : 0) + Math.max(0, items.length - 1);
  const fixableCount = parsed.filter((item) => item.nodeId && onGoToStep).length;

  const handleGoToStep = (nodeId: string) => {
    onGoToStep?.(nodeId);
    setOpen(false);
  };

  const bannerClass = hasBlocking
    ? 'group flex w-full items-center gap-3 rounded-2xl border border-red-200/80 bg-gradient-to-r from-red-50/95 via-white to-orange-50/40 px-4 py-3 text-left shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_4px_16px_rgba(239,68,68,0.08)] transition hover:border-red-300/80 dark:border-red-500/25 dark:from-red-950/40 dark:via-neutral-900 dark:to-orange-950/20'
    : 'group flex w-full items-center gap-3 rounded-2xl border border-amber-200/70 bg-gradient-to-r from-amber-50/95 via-white to-orange-50/40 px-4 py-3 text-left shadow-[0_1px_0_rgba(255,255,255,0.9)_inset,0_4px_16px_rgba(245,158,11,0.08)] transition hover:border-amber-300/80 hover:shadow-[0_4px_20px_rgba(245,158,11,0.12)] dark:border-amber-500/25 dark:from-amber-950/40 dark:via-neutral-900 dark:to-orange-950/20';
  const iconClass = hasBlocking
    ? 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-orange-500 text-white shadow-[0_4px_12px_rgba(239,68,68,0.35)] transition group-hover:scale-[1.02]'
    : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 text-white shadow-[0_4px_12px_rgba(245,158,11,0.35)] transition group-hover:scale-[1.02]';

  return (
    <>
      <div className={`relative z-20 mx-4 mt-3 lg:mx-5 lg:mt-4 ${className}`}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className={bannerClass}
        >
          <span className={iconClass}>
            <AlertTriangle className="h-4 w-4" strokeWidth={2.5} />
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2">
              <span className={`text-[13px] font-extrabold tracking-tight ${hasBlocking ? 'text-red-950 dark:text-red-100' : 'text-amber-950 dark:text-amber-100'}`}>
                {items.length} flow {issueLabel} found
              </span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
                hasBlocking
                  ? 'bg-red-100 text-red-800 ring-red-200/70 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/20'
                  : 'bg-amber-100 text-amber-800 ring-amber-200/70 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/20'
              }`}>
                {hasBlocking ? 'Fix before save' : 'Review'}
              </span>
            </span>
            <span className={`mt-0.5 block truncate text-[12px] font-medium ${hasBlocking ? 'text-red-800/75 dark:text-red-200/70' : 'text-amber-800/75 dark:text-amber-200/70'}`}>
              {preview}
              {extraCount > 0 && ` · +${extraCount} more`}
            </span>
          </span>

          <span className={`flex shrink-0 items-center gap-1 text-[11px] font-bold transition group-hover:translate-x-0.5 ${hasBlocking ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
            View
            <ChevronRight className="h-4 w-4" strokeWidth={2.5} />
          </span>
        </button>
      </div>

      <SlideOver
        open={open}
        onClose={() => setOpen(false)}
        title="Flow issues"
        subtitle={
          hasBlocking
            ? `${errors.length} ${errors.length === 1 ? 'error' : 'errors'} to fix before you save or publish`
            : `${warnings.length} ${warnings.length === 1 ? 'warning' : 'warnings'} to review before you publish`
        }
        size="md"
        footer={
          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-theme-border bg-theme-surface px-4 text-[13px] font-semibold text-theme-fg transition hover:bg-theme-subtle"
            >
              Dismiss
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <section className={`rounded-2xl border p-4 ${
            hasBlocking
              ? 'border-red-200/70 bg-gradient-to-r from-red-500/10 via-orange-500/5 to-red-500/5 dark:border-red-500/25'
              : 'border-amber-200/70 bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-amber-500/5 dark:border-amber-500/25'
          }`}>
            <div className="flex items-start gap-3">
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-[0_4px_12px_rgba(245,158,11,0.3)] ${
                hasBlocking ? 'bg-gradient-to-br from-red-500 to-orange-500' : 'bg-gradient-to-br from-amber-500 to-orange-500'
              }`}>
                <AlertTriangle className="h-4 w-4" strokeWidth={2.5} />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-extrabold text-neutral-900">
                  {hasBlocking ? 'Fix errors before saving' : 'Review flow connections'}
                </p>
                <p className="mt-1 text-[12px] font-medium leading-relaxed text-neutral-600">
                  {hasBlocking
                    ? 'These issues block save and publish. Tap an item below to jump to that step.'
                    : 'Warnings do not block save. Unreachable steps and loops are worth a look before you go live.'}
                </p>
                {fixableCount > 0 && (
                  <p className={`mt-2 text-[11px] font-semibold ${hasBlocking ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'}`}>
                    {fixableCount} {fixableCount === 1 ? 'issue' : 'issues'} can be opened in one click
                  </p>
                )}
              </div>
            </div>
          </section>

          {hasBlocking && warnings.length > 0 && (
            <p className="text-[12px] font-medium text-neutral-500">
              Also {warnings.length} {warnings.length === 1 ? 'warning' : 'warnings'} to review after errors are fixed.
            </p>
          )}

          <ul className="space-y-2">
            {parsed.map((item, index) => {
              const Icon = item.icon;
              const clickable = Boolean(item.nodeId && onGoToStep);

              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => item.nodeId && handleGoToStep(item.nodeId)}
                    disabled={!clickable}
                    title={item.stepLabel}
                    className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition ${
                      clickable
                        ? 'border-neutral-200/80 bg-white shadow-[0_1px_0_rgba(0,0,0,0.04)] hover:border-amber-200/80 hover:bg-amber-50/40 active:scale-[0.995] dark:border-neutral-700 dark:bg-neutral-900 dark:hover:border-amber-500/30 dark:hover:bg-amber-950/20'
                        : 'cursor-default border-neutral-200/60 bg-neutral-50/80 dark:border-neutral-800 dark:bg-neutral-900/50'
                    }`}
                  >
                    <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold tabular-nums ${
                      hasBlocking ? 'bg-red-100 text-red-800 dark:bg-red-500/15 dark:text-red-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
                    }`}>
                      {index + 1}
                    </span>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
                      <Icon className="h-4 w-4" strokeWidth={2.25} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-semibold leading-snug text-neutral-900">
                        {item.title}
                      </span>
                      {item.stepLabel && (
                        <span className="mt-0.5 block text-[11px] font-medium text-neutral-500">
                          {item.stepLabel}
                        </span>
                      )}
                    </span>
                    {clickable && (
                      <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                        Go
                        <ChevronRight className="h-3.5 w-3.5" strokeWidth={2.5} />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </SlideOver>
    </>
  );
}

import { Check, FileText, Gift, Search, ShoppingCart, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AppInput from '../../ui/AppInput';
import AppSelect from '../../ui/AppSelect';
import type { MessageTemplate } from '../../../types';

interface CampaignTemplatePickerProps {
  templates: MessageTemplate[];
  value: string;
  onChange: (template: MessageTemplate) => void;
}

function templateIcon(category: string) {
  const normalized = category.toUpperCase();
  if (normalized.includes('MARKET')) return Gift;
  if (normalized.includes('UTILITY') || normalized.includes('TRANSACTION')) return ShoppingCart;
  if (normalized.includes('AUTH')) return Sparkles;
  return FileText;
}

function categoryLabel(category: string) {
  return category.charAt(0) + category.slice(1).toLowerCase();
}

function templateDisplayName(name: string) {
  const readable = name.replace(/_v\d+$/i, '').replace(/[_-]+/g, ' ').trim();
  return readable.replace(/\b\w/g, (character) => character.toUpperCase());
}

const templateIconTones = [
  'bg-violet-100 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300',
  'bg-sky-100 text-sky-600 dark:bg-sky-950/50 dark:text-sky-300',
  'bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-300',
  'bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-300',
  'bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300',
] as const;

export default function CampaignTemplatePicker({
  templates,
  value,
  onChange,
}: CampaignTemplatePickerProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [language, setLanguage] = useState('');

  const categories = useMemo(
    () =>
      [...new Set(templates.map((template) => template.category).filter(Boolean))].sort().map((item) => ({
        value: item,
        label: categoryLabel(item),
      })),
    [templates],
  );
  const languages = useMemo(
    () =>
      [...new Set(templates.map((template) => template.language).filter(Boolean))].sort().map((item) => ({
        value: item,
        label: item,
      })),
    [templates],
  );
  const filteredTemplates = useMemo(() => {
    const query = search.trim().toLowerCase();
    return templates.filter((template) => {
      const matchesSearch =
        !query ||
        template.name.toLowerCase().includes(query) ||
        template.body?.toLowerCase().includes(query);
      const matchesCategory = !category || template.category === category;
      const matchesLanguage = !language || template.language === language;
      return matchesSearch && matchesCategory && matchesLanguage;
    });
  }, [category, language, search, templates]);

  return (
    <section className="campaign-template-picker campaign-wizard-card flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="border-b border-slate-100 px-3.5 py-3 dark:border-slate-800 sm:px-4">
        <h2 className="text-[13px] font-extrabold tracking-tight text-slate-900 dark:text-white">
          Choose an approved template
        </h2>
        <p className="mt-0.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
          Select a template to use in your campaign
        </p>
      </div>

      <div className="space-y-2 border-b border-slate-100 px-3.5 py-3 dark:border-slate-800 sm:px-4">
        <AppInput
          id="campaign-template-search"
          aria-label="Search templates"
          placeholder="Search templates..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          icon={<Search className="h-3.5 w-3.5" />}
          className="!h-9 rounded-lg !pl-9 text-[12px]"
        />
        <div className="grid grid-cols-2 gap-2">
          <AppSelect
            ariaLabel="Filter by category"
            size="compact"
            value={category}
            placeholder="All categories"
            isSearchable={false}
            options={[{ value: '', label: 'All categories' }, ...categories]}
            onChange={(event) => setCategory(event.target.value)}
          />
          <AppSelect
            ariaLabel="Filter by language"
            size="compact"
            value={language}
            placeholder="Language"
            isSearchable={false}
            options={[{ value: '', label: 'Language' }, ...languages]}
            onChange={(event) => setLanguage(event.target.value)}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3 sm:p-3.5">
        {filteredTemplates.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 px-3 py-8 text-center dark:border-slate-800">
            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {templates.length ? 'No templates match these filters.' : 'No approved templates yet.'}
            </p>
            {!templates.length && (
              <p className="mt-1 text-[10px] text-slate-400">
                Create a template and wait for approval before sending.
              </p>
            )}
          </div>
        ) : (
          filteredTemplates.map((template) => {
            const active = template.name === value;
            const Icon = templateIcon(template.category);
            const iconTone = templateIconTones[Math.max(0, templates.indexOf(template)) % templateIconTones.length];
            return (
              <button
                key={`${template.name}-${template.language}`}
                type="button"
                onClick={() => onChange(template)}
                aria-pressed={active}
                className={`flex min-h-[58px] w-full items-center gap-2 rounded-lg border px-2.5 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 ${
                  active
                    ? 'border-emerald-400 bg-emerald-50/60 dark:border-emerald-700 dark:bg-emerald-950/25'
                    : 'border-slate-100 bg-white hover:border-emerald-200 hover:bg-emerald-50/25 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-emerald-800'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border ${
                    active ? 'border-emerald-600' : 'border-slate-300 dark:border-slate-600'
                  }`}
                >
                  {active && <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />}
                </span>
                <span
                  className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg ${iconTone} ${
                    active ? 'ring-2 ring-emerald-200/80 dark:ring-emerald-800/70' : ''
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={2.1} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-[11.5px] font-extrabold text-slate-800 dark:text-slate-200">
                      {templateDisplayName(template.name)}
                    </span>
                    <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[8px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                      {categoryLabel(template.category)}
                    </span>
                  </span>
                  <span className="mt-0.5 block truncate text-[9.5px] font-medium text-slate-400">
                    {template.name} · {template.language}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="hidden rounded-md border border-emerald-200 px-1.5 py-1 text-[9px] font-bold text-emerald-700 sm:inline dark:border-emerald-800 dark:text-emerald-300">
                    Preview
                  </span>
                  {active && <Check className="h-4 w-4 text-emerald-600" strokeWidth={2.75} />}
                </span>
              </button>
            );
          })
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5 border-t border-slate-100 px-3.5 py-2.5 text-[9px] font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <span>Can&apos;t find the template you need?</span>
        <Link
          to="/content-studio"
          className="font-extrabold text-emerald-700 transition hover:text-emerald-800 hover:underline dark:text-emerald-300"
        >
          Go to Content Studio <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  );
}

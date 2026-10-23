import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Plus, Smartphone, Trash2 } from 'lucide-react';
import { Button, Input, Notice, Select } from '../components/ui';
import { WhatsAppPreview } from '../components/WhatsAppPreview';
import { useOperator } from '../context/OperatorContext';
import { platformRequest, ApiError } from '../api';
import {
  EMPTY_DRAFT,
  HONESTY,
  LANGUAGES,
  USE_MOCK_CATALOG,
  deleteMockRow,
  draftPayload,
  findMockRow,
  rowToDraft,
  templateVariableCount,
  upsertMockRow,
  type Draft,
  type LibraryRow,
} from '../lib/library-catalog';

export function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { allowed } = useOperator();
  const canWrite = allowed('organization.write');
  const isNew = !id || id === 'new';
  const [row, setRow] = useState<LibraryRow | null>(() => (isNew ? null : USE_MOCK_CATALOG ? findMockRow(id) ?? null : null));
  const [missing, setMissing] = useState(false);
  const [draft, setDraft] = useState<Draft>(row ? rowToDraft(row) : EMPTY_DRAFT);
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!USE_MOCK_CATALOG || isNew || row) return;
    setMissing(true);
  }, [id, isNew, row]);

  // Real API mode: there is no GET-by-id endpoint in this first cut, so reuse the list.
  useEffect(() => {
    if (isNew || USE_MOCK_CATALOG || row) return;
    let alive = true;
    platformRequest<{ templates: LibraryRow[] }>('/library-templates')
      .then((data) => {
        if (!alive) return;
        const found = (data.templates || []).find((candidate) => candidate.id === id) || null;
        if (found) {
          setRow(found);
          setDraft(rowToDraft(found));
        } else {
          setMissing(true);
        }
      })
      .catch(() => setMissing(true));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per id; key={id} on the route remounts
  }, [id]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const activeBody = draft.language === 'hi_IN' ? draft.bodyHi : draft.body;
  const setActiveBody = (value: string) => set(draft.language === 'hi_IN' ? 'bodyHi' : 'body', value);

  const variableCount = useMemo(() => templateVariableCount(draft.body, draft.bodyHi), [draft.body, draft.bodyHi]);

  const addVariable = () => {
    const next = variableCount + 1;
    setActiveBody(`${activeBody}${activeBody && !activeBody.endsWith(' ') ? ' ' : ''}{{${next}}}`);
  };

  const handleSave = async () => {
    setSaveError('');
    setSaving(true);
    try {
      if (USE_MOCK_CATALOG) {
        if (row) {
          upsertMockRow({ ...row, ...draftPayload(draft) });
        } else {
          upsertMockRow({
            ...draftPayload(draft),
            id: `mock-${Date.now()}`,
            language: draft.language,
          } as LibraryRow);
        }
      navigate('/library');
      return;
    }
    // Server audit log requires a ≥8-char reason; the editor no longer asks for one.
    const reason = `${row ? 'Updated' : 'Created'} library template "${draftPayload(draft).slug || draft.title || 'untitled'}" from platform editor`;
    const payload = { reason, ...draftPayload(draft) };
      if (row) {
        await platformRequest(`/library-templates/${row.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        await platformRequest('/library-templates', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      navigate('/library');
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!row) return;
    setSaveError('');
    setSaving(true);
    try {
      if (USE_MOCK_CATALOG) {
        deleteMockRow(row.id);
      } else {
        await platformRequest(`/library-templates/${row.id}`, {
          method: 'DELETE',
          body: JSON.stringify({
            reason: `Deleted library template "${row.slug}" from platform editor`,
          }),
        });
      }
      navigate('/library');
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setSaving(false);
    }
  };

  if (missing) {
    return (
      <div className="space-y-4 pb-12">
        <Notice tone="error">Template not found. It may have been deleted.</Notice>
        <Button variant="secondary" onClick={() => navigate('/library')}>Back to templates</Button>
      </div>
    );
  }

  const actions = (
    <>
      {row ? (
        <Button variant="danger" onClick={() => void handleDelete()} disabled={saving}>
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
      ) : null}
      <Button onClick={() => void handleSave()} loading={saving} disabled={saving}>
        {row ? 'Save changes' : 'Publish to library'}
      </Button>
    </>
  );

  return (
    <div className="space-y-6 pb-32"> {/* pb-32: keep clear of the floating action bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm" aria-hidden>
              <Smartphone className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {row ? 'Edit Template' : 'Create Template (Manual)'}
              </h1>
              <p className="text-[13px] text-slate-600">Write your template content and configure details.</p>
            </div>
          </div>
        </div>
      </div>

      {saveError ? <Notice tone="error">{saveError}</Notice> : null}
      {!canWrite ? (
        <Notice>ANALYST can view this catalog. SUPPORT and SUPER_ADMIN can publish changes.</Notice>
      ) : null}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Left: form column — order: details → content → variables → buttons */}
        <div className="min-w-0 space-y-4">
          <section className="dashboard-card p-4 sm:p-5">
            <h2 className="text-sm font-bold tracking-tight text-slate-900">Template details</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <Input
                label="Template name"
                hint="Shown to tenants in the library."
                value={draft.title}
                disabled={!canWrite}
                onChange={(event) => set('title', event.target.value)}
              />
              <Input
                label="Slug"
                hint="Tenants submit this draft by slug."
                value={draft.slug}
                disabled={!canWrite || Boolean(row)}
                onChange={(event) => set('slug', event.target.value.toLowerCase().replace(/\s/g, '_'))}
              />
              <Select label="Category" value={draft.category} disabled={!canWrite} onChange={(event) => set('category', event.target.value as Draft['category'])}>
                <option value="UTILITY">Utility</option>
                <option value="MARKETING">Marketing</option>
                <option value="AUTHENTICATION">Authentication</option>
              </Select>
              <Select label="Language" value={draft.language} disabled={!canWrite || Boolean(row)} onChange={(event) => set('language', event.target.value)}>
                {LANGUAGES.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
              <Input label="Tags" hint="Comma-separated" value={draft.tags} disabled={!canWrite} onChange={(event) => set('tags', event.target.value)} />
              <Input label="Short help text" hint="Shown under the template in the tenant library." value={draft.copy} disabled={!canWrite} onChange={(event) => set('copy', event.target.value)} />
              <Input label="Sort order" value={draft.sortOrder} disabled={!canWrite} onChange={(event) => set('sortOrder', event.target.value)} />
            </div>
          </section>

          <section className="dashboard-card p-4 sm:p-5">
            <h2 className="text-sm font-bold tracking-tight text-slate-900">Template content</h2>
            <label className="mt-3 block space-y-1 text-[13px]">
              <span className="font-semibold text-slate-700">
                {draft.language === 'hi_IN' ? 'Message body (Hindi)' : 'Message body (English)'} <span className="text-rose-600">*</span>
              </span>
              <textarea
                className="min-h-32 w-full rounded-lg border bg-white px-3 py-2.5 text-[13px] text-slate-900 shadow-sm focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                placeholder="Write your message here... Use {{1}}, {{2}} for variables."
                value={activeBody}
                maxLength={1024}
                disabled={!canWrite}
                onChange={(event) => setActiveBody(event.target.value)}
              />
            </label>
            <div className="mt-2 flex items-center justify-between gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={addVariable} disabled={!canWrite}>
                <Plus className="h-3.5 w-3.5" /> Add Variable
              </Button>
              <span className="text-[11px] text-slate-400">{activeBody.length}/1024</span>
            </div>
            <label className="mt-4 block space-y-1 text-[13px]">
              <span className="font-semibold text-slate-700">
                {draft.language === 'hi_IN' ? 'English body (fallback)' : 'Hindi body (optional)'}
              </span>
              <textarea
                className="min-h-20 w-full rounded-lg border bg-white px-3 py-2 text-[13px] text-slate-900 shadow-sm focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
                value={draft.language === 'hi_IN' ? draft.body : draft.bodyHi}
                maxLength={1024}
                disabled={!canWrite}
                onChange={(event) => set(draft.language === 'hi_IN' ? 'body' : 'bodyHi', event.target.value)}
              />
            </label>
          </section>

          <section className="dashboard-card p-4 sm:p-5">
            <h2 className="text-sm font-bold tracking-tight text-slate-900">Variables <span className="font-normal text-slate-400">(optional)</span></h2>
            <div className="mt-3 space-y-2">
              {Array.from({ length: variableCount }, (_, index) => index + 1).map((index) => (
                <Input
                  key={index}
                  label={`Sample value for {{${index}}}`}
                  value={draft.bodyExamples[index - 1] || ''}
                  disabled={!canWrite}
                  onChange={(event) =>
                    setDraft((prev) => {
                      const next = [...prev.bodyExamples];
                      next[index - 1] = event.target.value;
                      return { ...prev, bodyExamples: next };
                    })
                  }
                />
              ))}
              {variableCount === 0 ? (
                <p className="text-[13px] text-slate-500">
                  No variables yet. Add {'{{1}}'} to the body above — a sample input appears here for Meta review.
                </p>
              ) : null}
            </div>
          </section>

          <section className="dashboard-card p-4 sm:p-5">
            <h2 className="text-sm font-bold tracking-tight text-slate-900">
              Buttons, header &amp; footer <span className="font-normal text-slate-400">(optional)</span>
            </h2>
            {draft.mediaFormat ? (
              <div className="mt-3">
                <Notice tone="warning">
                  Tenants must upload a sample {draft.mediaFormat.toLowerCase()} file before submitting this template to Meta.
                </Notice>
              </div>
            ) : null}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Input label="URL button label" value={draft.buttonText} disabled={!canWrite} onChange={(event) => set('buttonText', event.target.value)} />
              <Input label="URL button https link" value={draft.buttonUrl} disabled={!canWrite} onChange={(event) => set('buttonUrl', event.target.value)} />
              <Input label="Header" value={draft.header} disabled={!canWrite} onChange={(event) => set('header', event.target.value)} />
              <Select
                label="Header media"
                value={draft.mediaFormat}
                disabled={!canWrite}
                onChange={(event) => set('mediaFormat', event.target.value as Draft['mediaFormat'])}
              >
                <option value="">Text header / none</option>
                <option value="IMAGE">Image header</option>
                <option value="VIDEO">Video header</option>
                <option value="DOCUMENT">PDF document header</option>
              </Select>
              <Input label="English footer" value={draft.footer} disabled={!canWrite} onChange={(event) => set('footer', event.target.value)} />
              <Input label="Hindi footer" value={draft.footerHi} disabled={!canWrite} onChange={(event) => set('footerHi', event.target.value)} />
            </div>
          </section>

          <label className="flex items-center gap-2 px-1 text-[13px] font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={draft.published}
              disabled={!canWrite}
              onChange={(event) => set('published', event.target.checked)}
            />
            Published in customer library
          </label>
        </div>

        {/* Right: live WhatsApp preview */}
        <aside className="dashboard-card overflow-hidden lg:sticky lg:top-20">
          <div className="border-b border-slate-200/80 px-4 py-3">
            <h2 className="text-sm font-bold tracking-tight text-slate-900">Whatsapp preview</h2>
          </div>
          <div className="p-4">
            <WhatsAppPreview draft={draft} />
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">{HONESTY}</p>
          </div>
        </aside>
      </div>

      {/* Floating action bar — fixed to viewport bottom, content-aligned */}
      {canWrite ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/80 bg-white/90 backdrop-blur-md">
          <div className="content-shell flex items-center justify-between gap-3 px-4 py-3 md:px-8">
            <Button variant="ghost" size="sm" onClick={() => navigate('/library')}>
              <ArrowLeft className="h-3.5 w-3.5" /> Back to templates
            </Button>
            <div className="flex shrink-0 items-center gap-2">{actions}</div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

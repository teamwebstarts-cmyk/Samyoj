import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Copy,
  Download,
  LayoutTemplate,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Send,
  Square,
  TestTube2,
} from 'lucide-react';
import CampaignAnalyticsPanel from '../components/campaigns/CampaignAnalyticsPanel';
import CampaignAudienceSection from '../components/campaigns/CampaignAudienceSection';
import CampaignTable from '../components/campaigns/CampaignTable';
import CampaignCard from '../components/campaigns/CampaignCard';
import CampaignDetailHeader from '../components/campaigns/CampaignDetailHeader';
import CampaignQuotaBanner from '../components/campaigns/CampaignQuotaBanner';
import CampaignRecipientTable from '../components/campaigns/CampaignRecipientTable';
import {
  getFilledTemplatePreview,
  getTemplateHeaderFormat,
  headerMediaLabel,
  templateNeedsHeaderMedia,
} from '../components/campaigns/campaignPreviewUtils';
import {
  ModalCallout,
  ModalPanel,
  ModalPreviewCard,
  ModalSection,
} from '../components/ui/modalUi';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import AppSelect from '../components/ui/AppSelect';
import EmptyState from '../components/ui/EmptyState';
import ListToolbar from '../components/ui/ListToolbar';
import LoadingState from '../components/ui/LoadingState';
import PageHero from '../components/ui/PageHero';
import PageShell from '../components/ui/PageShell';
import ResponsiveDataView from '../components/ui/ResponsiveDataView';
import SlideOver, { SlideOverFooter } from '../components/ui/SlideOver';
import { WhatsAppTemplatePreview } from '../components/inbox/WhatsAppPreview';
import { DEFAULT_PAGE_SIZE } from '../constants/pagination';
import { useAuth } from '../contexts/AuthContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useSocket } from '../hooks/useSocket';
import { billingApi, campaignApi, contactApi, templateApi, whatsappApi } from '../services/api';
import { toastError, toastSuccess } from '../utils/toast';
import { PHONE_PLACEHOLDER, validatePhoneLines } from '../utils/phone';
import type {
  Campaign,
  CampaignAnalytics,
  CampaignRecipient,
  MessageTemplate,
} from '../types';

type AudienceType = 'MANUAL' | 'TAGS' | 'CONTACTS' | 'ALL_OPTED_IN';

const emptyForm = {
  name: '',
  templateName: '',
  templateLanguage: '',
  bodyParams: [] as string[],
  headerParams: [] as string[],
  headerMediaUrl: '',
  audienceType: 'MANUAL' as AudienceType,
  audienceTags: '',
  selectedContactIds: [] as string[],
  phones: '',
  whatsappNumberId: '',
  scheduleEnabled: false,
  scheduledAt: '',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  testPhone: '',
};

type CampaignDetail = Campaign & { recipients?: CampaignRecipient[] };

const statusFilterOptions = [
  { value: '', label: 'All statuses' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'RUNNING', label: 'Running' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

function canEditCampaign(status: string) {
  return status === 'DRAFT' || status === 'SCHEDULED';
}

function countVars(text?: string) {
  if (!text) return 0;
  return (text.match(/\{\{\d+\}\}/g) || []).length;
}

function campaignToForm(campaign: CampaignDetail, templates: MessageTemplate[]) {
  const tpl = templates.find((t) => t.name === campaign.templateName);
  const bodyCount = countVars(tpl?.body || tpl?.components?.find((c) => c.type === 'BODY')?.text);
  const headerCount = countVars(tpl?.header || tpl?.components?.find((c) => c.type === 'HEADER')?.text);

  return {
    name: campaign.name,
    templateName: campaign.templateName,
    templateLanguage: campaign.templateLanguage || tpl?.language || '',
    bodyParams: campaign.templateParams?.body || Array(bodyCount).fill(''),
    headerParams: campaign.templateParams?.header || Array(headerCount).fill(''),
    headerMediaUrl: campaign.templateParams?.headerMediaUrl || '',
    audienceType: (campaign.audienceType || 'MANUAL') as AudienceType,
    audienceTags: (campaign.audienceConfig?.tags || []).join(', '),
    selectedContactIds: campaign.audienceConfig?.contactIds || [],
    phones: (campaign.recipients || []).map((r) => r.phone).join('\n'),
    whatsappNumberId: campaign.whatsappNumberId || '',
    scheduleEnabled: Boolean(campaign.scheduledAt),
    scheduledAt: campaign.scheduledAt ? campaign.scheduledAt.slice(0, 16) : '',
    timezone: campaign.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    testPhone: '',
  };
}

function buildPayload(form: typeof emptyForm, options?: { clearSchedule?: boolean }) {
  const payload: Record<string, unknown> = {
    name: form.name,
    templateName: form.templateName,
    templateLanguage: form.templateLanguage || undefined,
    audienceType: form.audienceType,
    whatsappNumberId: form.whatsappNumberId || undefined,
    timezone: form.timezone || undefined,
    templateParams: {
      body: form.bodyParams.filter(Boolean),
      header: form.headerParams.filter(Boolean),
      headerMediaUrl: form.headerMediaUrl || undefined,
    },
  };

  if (form.audienceType === 'MANUAL') {
    const lines = form.phones.split('\n');
    const phoneResult = validatePhoneLines(lines);
    if (!phoneResult.ok) throw new Error(phoneResult.errors.join('\n'));
    payload.recipients = phoneResult.phones.map((phone) => ({ phone }));
  } else if (form.audienceType === 'TAGS') {
    payload.audienceConfig = {
      tags: form.audienceTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      requireOptIn: true,
    };
  } else if (form.audienceType === 'CONTACTS') {
    if (!form.selectedContactIds.length) throw new Error('Select at least one contact');
    payload.audienceConfig = {
      contactIds: form.selectedContactIds,
      requireOptIn: true,
    };
  } else if (form.audienceType === 'ALL_OPTED_IN') {
    payload.audienceConfig = { requireOptIn: true };
  }

  if (form.scheduleEnabled && form.scheduledAt) {
    payload.scheduledAt = new Date(form.scheduledAt).toISOString();
  } else if (options?.clearSchedule) {
    payload.scheduledAt = null;
  }

  return payload;
}

export default function CampaignsPage() {
  const { canManageTeam } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [whatsappNumbers, setWhatsappNumbers] = useState<Array<{ id: string; phoneNumber: string }>>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [slideOpen, setSlideOpen] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [editing, setEditing] = useState<CampaignDetail | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ total: 0, running: 0, completed: 0, sent: 0 });
  const [analytics, setAnalytics] = useState<CampaignAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  const [recipientTotal, setRecipientTotal] = useState(0);
  const [recipientPage, setRecipientPage] = useState(1);
  const [recipientStatusFilter, setRecipientStatusFilter] = useState('');

  const debouncedSearch = useDebouncedValue(search);
  const hasFilters = Boolean(search || statusFilter);
  const selectedTemplate = useMemo(
    () => templates.find((t) => t.name === form.templateName),
    [templates, form.templateName]
  );

  const filledPreview = useMemo(
    () => (selectedTemplate ? getFilledTemplatePreview(selectedTemplate, form) : null),
    [selectedTemplate, form.bodyParams, form.headerParams]
  );

  const showHeaderMedia = selectedTemplate ? templateNeedsHeaderMedia(selectedTemplate) : false;

  const [searchParams, setSearchParams] = useSearchParams();

  const loadTemplates = useCallback(() => {
    templateApi
      .list({ status: 'APPROVED', all: 'true' })
      .then(({ data }) => {
        const payload = data.data;
        const list = Array.isArray(payload) ? payload : payload?.templates || [];
        setTemplates(list as MessageTemplate[]);
      })
      .catch(() => setTemplates([]));
  }, []);

  const loadCampaigns = useCallback((showLoading = false) => {
    if (showLoading) setLoading(true);

    const params: Record<string, string> = {
      page: String(page),
      limit: String(DEFAULT_PAGE_SIZE),
    };
    if (debouncedSearch) params.search = debouncedSearch;
    if (statusFilter) params.status = statusFilter;

    campaignApi
      .list(params)
      .then(({ data }) => {
        setCampaigns(data.data.campaigns);
        setTotal(data.data.total);
        setSummary(data.data.summary);
      })
      .catch((err: unknown) => {
        toastError(getErrMsg(err, 'Failed to load campaigns'));
      })
      .finally(() => setLoading(false));
  }, [page, debouncedSearch, statusFilter]);

  const loadDetailExtras = useCallback(async (campaignId: string) => {
    setAnalyticsLoading(true);
    try {
      const [analyticsRes, recipientsRes] = await Promise.all([
        campaignApi.analytics(campaignId),
        campaignApi.recipients(campaignId, {
          page: String(recipientPage),
          limit: '50',
          ...(recipientStatusFilter ? { status: recipientStatusFilter } : {}),
        }),
      ]);
      setAnalytics(analyticsRes.data.data as CampaignAnalytics);
      setRecipients(recipientsRes.data.data.recipients);
      setRecipientTotal(recipientsRes.data.data.total);
    } catch {
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [recipientPage, recipientStatusFilter]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    loadTemplates();
    whatsappApi.numbers().then(({ data }) => setWhatsappNumbers(data.data.numbers || [])).catch(() => {});
    contactApi
      .tags()
      .then(({ data }) => {
        const tags = data.data.tags || [];
        setAvailableTags(tags.map((t: string | { name: string }) => (typeof t === 'string' ? t : t.name)));
      })
      .catch(() => {});
  }, [loadTemplates]);

  useEffect(() => {
    const templateName = searchParams.get('template');
    if (!templateName || !canManageTeam) return;

    setEditing(null);
    setViewOnly(false);
    setSlideOpen(true);
    setForm({
      ...emptyForm,
      templateName,
      templateLanguage: searchParams.get('language') || '',
    });
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, canManageTeam]);

  useEffect(() => {
    const contactsParam = searchParams.get('contacts');
    if (!contactsParam || !canManageTeam) return;

    const contactIds = contactsParam.split(',').filter(Boolean);
    if (!contactIds.length) return;

    setEditing(null);
    setViewOnly(false);
    setSlideOpen(true);
    setForm({
      ...emptyForm,
      audienceType: 'CONTACTS',
      selectedContactIds: contactIds,
      name: `Campaign — ${contactIds.length} contact${contactIds.length === 1 ? '' : 's'}`,
    });
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams, canManageTeam]);

  useEffect(() => {
    loadCampaigns(true);
  }, [loadCampaigns]);

  useEffect(() => {
    const interval = setInterval(() => loadCampaigns(false), 8000);
    return () => clearInterval(interval);
  }, [loadCampaigns]);

  useEffect(() => {
    if (viewOnly && editing?.id) {
      void loadDetailExtras(editing.id);
    }
  }, [viewOnly, editing?.id, loadDetailExtras]);

  useEffect(() => {
    if (!selectedTemplate || viewOnly) return;
    const bodyText = selectedTemplate.body || selectedTemplate.components?.find((c) => c.type === 'BODY')?.text;
    const headerText = selectedTemplate.header || selectedTemplate.components?.find((c) => c.type === 'HEADER')?.text;
    const bodyCount = countVars(bodyText);
    const headerCount = countVars(headerText);
    setForm((prev) => ({
      ...prev,
      templateLanguage: selectedTemplate.language,
      bodyParams: Array.from({ length: bodyCount }, (_, i) => prev.bodyParams[i] || ''),
      headerParams: Array.from({ length: headerCount }, (_, i) => prev.headerParams[i] || ''),
    }));
  }, [selectedTemplate, viewOnly]);

  const handleSocketEvent = useCallback(
    (event: string) => {
      if (event === 'campaign:status' || event === 'campaign:progress') {
        loadCampaigns(false);
        if (viewOnly && editing?.id) void loadDetailExtras(editing.id);
      }
    },
    [loadCampaigns, viewOnly, editing?.id, loadDetailExtras]
  );

  useSocket(handleSocketEvent);

  const openCreate = () => {
    if (!canManageTeam) return;
    setEditing(null);
    setViewOnly(false);
    setForm(emptyForm);
    setSlideOpen(true);
    setAnalytics(null);
    setAnalyticsError(null);
    loadTemplates();
  };

  const loadCampaignDetail = async (campaign: Campaign) => {
    const { data } = await campaignApi.get(campaign.id);
    return data.data as CampaignDetail;
  };

  const openView = async (campaign: Campaign) => {
    try {
      const full = await loadCampaignDetail(campaign);
      setEditing(full);
      setViewOnly(true);
      setForm(campaignToForm(full, templates));
      setRecipientPage(1);
      setSlideOpen(true);
    } catch {
      toastError('Failed to load campaign details');
    }
  };

  const openEdit = async (campaign: Campaign) => {
    if (!canEditCampaign(campaign.status)) return;
    try {
      const full = await loadCampaignDetail(campaign);
      setEditing(full);
      setViewOnly(false);
      setForm(campaignToForm(full, templates));
      setSlideOpen(true);
      loadTemplates();
    } catch {
      toastError('Failed to load campaign details');
    }
  };

  const closeSlide = () => {
    setSlideOpen(false);
    setViewOnly(false);
    setEditing(null);
    setForm(emptyForm);
    setAnalytics(null);
    setAnalyticsError(null);
    setRecipients([]);
  };

  const saveCampaign = async (andSend = false) => {
    if (selectedTemplate && templateNeedsHeaderMedia(selectedTemplate) && !form.headerMediaUrl.trim()) {
      toastError('Header media URL is required for this template');
      return null;
    }

    const payload = buildPayload(form, { clearSchedule: Boolean(editing && !form.scheduleEnabled) });
    setSaving(true);
    try {
      let campaignId = editing?.id;
      if (editing) {
        await campaignApi.update(editing.id, payload);
        toastSuccess(andSend ? 'Campaign updated' : 'Campaign saved');
      } else {
        const { data } = await campaignApi.create(payload);
        campaignId = (data.data as Campaign).id;
        toastSuccess(andSend ? 'Campaign created' : 'Campaign saved as draft');
      }

      if (andSend && campaignId) {
        if (!confirm('Start sending this campaign now?')) {
          loadCampaigns(false);
          return campaignId;
        }
        await campaignApi.send(campaignId);
        toastSuccess('Campaign started');
        loadCampaigns(false);
        const full = await loadCampaignDetail({ id: campaignId } as Campaign);
        setEditing(full);
        setViewOnly(true);
        setForm(campaignToForm(full, templates));
        setRecipientPage(1);
        return campaignId;
      }

      closeSlide();
      loadCampaigns(false);
      return campaignId;
    } catch (err: unknown) {
      toastError(getErrMsg(err, 'Failed to save campaign'));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (viewOnly) return;
    await saveCampaign(false);
  };

  const handleSaveAndSend = async () => {
    if (viewOnly || form.scheduleEnabled) return;
    await saveCampaign(true);
  };

  const handleDelete = async () => {
    if (!editing || !confirm(`Delete campaign "${editing.name}"?`)) return;
    setSaving(true);
    try {
      await campaignApi.delete(editing.id);
      closeSlide();
      loadCampaigns(false);
      toastSuccess('Campaign deleted');
    } catch (err: unknown) {
      toastError(getErrMsg(err, 'Failed to delete campaign'));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (campaign: Campaign) => {
    if (!canEditCampaign(campaign.status)) return;
    if (!confirm(`Delete campaign "${campaign.name}"?`)) return;
    try {
      await campaignApi.delete(campaign.id);
      loadCampaigns(false);
      toastSuccess('Campaign deleted');
    } catch (err: unknown) {
      toastError(getErrMsg(err, 'Failed to delete campaign'));
    }
  };

  const handleDuplicate = async () => {
    if (!editing?.id) return;
    try {
      const { data } = await campaignApi.duplicate(editing.id);
      const copy = data.data as CampaignDetail;
      loadCampaigns(false);
      setEditing(copy);
      setViewOnly(false);
      setForm(campaignToForm(copy, templates));
      loadTemplates();
      toastSuccess('Campaign duplicated — review and send when ready');
    } catch (err: unknown) {
      toastError(getErrMsg(err, 'Failed to duplicate campaign'));
    }
  };

  const handleSend = async (id: string) => {
    if (!canManageTeam) return;
    const campaign = campaigns.find((c) => c.id === id) || (editing?.id === id ? editing : null);
    const count = campaign?.totalContacts ?? 0;
    let costLine = '';
    if (count > 0) {
      try {
        const { data } = await billingApi.estimateCost(count);
        costLine = `\n\nEstimated Meta cost: ₹${data.data.estimatedCostInr.toLocaleString('en-IN')}`;
      } catch {
        /* estimate optional */
      }
    }
    const recipientLine = count > 0 ? ` (${count.toLocaleString()} people)` : '';
    if (!confirm(`Start sending this campaign?${recipientLine}${costLine}`)) return;
    try {
      await campaignApi.send(id);
      loadCampaigns(false);
      toastSuccess('Campaign started');
    } catch (err: unknown) {
      toastError(getErrMsg(err, 'Failed to start campaign'));
    }
  };

  const handleAction = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      loadCampaigns(false);
      if (editing?.id) void loadDetailExtras(editing.id);
      toastSuccess(success);
    } catch (err: unknown) {
      toastError(getErrMsg(err, 'Action failed'));
    }
  };

  const handleTestSend = async () => {
    if (!editing?.id) return;
    const lines = validatePhoneLines([form.testPhone]);
    if (!lines.ok) {
      toastError(lines.errors.join('\n'));
      return;
    }
    await handleAction(
      () => campaignApi.test(editing.id, lines.phones[0]),
      'Test message sent'
    );
  };

  const handleExport = async (id: string, name: string) => {
    try {
      const { data } = await campaignApi.export(id);
      const url = URL.createObjectURL(data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name.replace(/[^a-z0-9-_]/gi, '_')}-results.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toastError('Failed to export results');
    }
  };

  return (
    <PageShell>
      <div className="space-y-4 sm:space-y-5">
        <PageHero
          badge="Broadcast"
          badgeIcon={Send}
          title="Send messages to many contacts"
          description="Use approved templates, pick your audience, and track delivery."
          accent="violet"
          stats={[
            { label: 'Total', value: summary.total },
            { label: 'Active', value: summary.running, tone: 'text-violet-700' },
            { label: 'Completed', value: summary.completed, tone: 'text-whatsapp-700' },
            { label: 'Sent', value: summary.sent, tone: 'text-sky-700' },
          ]}
        />

        <CampaignQuotaBanner />

        {!canManageTeam && (
          <div className="rounded-xl border border-amber-200/70 bg-amber-50/80 px-3.5 py-2.5 text-[12px] font-medium text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            You have read-only access to campaigns. Ask an admin to create or send broadcasts.
          </div>
        )}

        <div className="inbox-shell overflow-hidden">
          <ListToolbar
            embedded
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search campaigns or templates..."
            filters={
              <AppSelect
                className="w-full sm:w-[148px]"
                value={statusFilter}
                placeholder="All statuses"
                isSearchable={false}
                options={statusFilterOptions}
                onChange={(e) => setStatusFilter(e.target.value)}
              />
            }
            actions={
              canManageTeam ? (
                <div className="flex flex-wrap items-center gap-2">
                  <Link to="/content-studio">
                    <AppButton variant="secondary" size="sm">
                      Content Studio
                    </AppButton>
                  </Link>
                  <AppButton icon={<Plus size={16} />} onClick={openCreate}>
                    New campaign
                  </AppButton>
                </div>
              ) : undefined
            }
          />

          {loading ? (
            <div className="p-6">
              <LoadingState label="Loading campaigns..." />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="p-4 sm:p-6">
              <EmptyState
                icon={Send}
                variant={hasFilters ? 'filter' : 'default'}
                title={hasFilters ? 'No campaigns match your filters' : 'No campaigns yet'}
                description={
                  hasFilters
                    ? 'Try a different search word or status.'
                    : 'Send approved WhatsApp messages to many contacts at once.'
                }
                steps={
                  hasFilters
                    ? undefined
                    : ['Create a message template first', 'Pick contacts to send to', 'Launch your campaign']
                }
                action={
                  !hasFilters && canManageTeam ? (
                    <AppButton icon={<Plus size={16} />} onClick={openCreate}>
                      Create campaign
                    </AppButton>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <ResponsiveDataView
              items={campaigns}
              cardClassName="divide-y divide-neutral-200 dark:divide-neutral-800 lg:hidden"
              tableClassName="px-4 sm:px-5 pt-4 sm:pb-5"
              renderCard={(c) => (
                <CampaignCard
                  key={c.id}
                  campaign={c}
                  onView={() => openView(c)}
                  onEdit={canManageTeam ? () => openEdit(c) : undefined}
                  onSend={canManageTeam ? () => handleSend(c.id) : undefined}
                  onDelete={canManageTeam ? () => handleDeleteItem(c) : undefined}
                />
              )}
              renderTable={() => (
                <CampaignTable
                  campaigns={campaigns}
                  page={page}
                  pageSize={DEFAULT_PAGE_SIZE}
                  total={total}
                  onPageChange={setPage}
                  canManageTeam={canManageTeam}
                  onView={openView}
                  onEdit={canManageTeam ? openEdit : undefined}
                  onSend={canManageTeam ? (c) => handleSend(c.id) : undefined}
                  onDelete={canManageTeam ? handleDeleteItem : undefined}
                />
              )}
            />
          )}
        </div>
      </div>

      <SlideOver
        open={slideOpen}
        onClose={closeSlide}
        title={viewOnly ? editing?.name || 'Campaign details' : editing ? 'Edit campaign' : 'New campaign'}
        subtitle={
          viewOnly
            ? 'Delivery stats, who received it, and campaign actions'
            : 'Template, audience, schedule, and preview'
        }
        size="xl"
        icon={Send}
        accent="violet"
        footer={
          viewOnly ? (
            <div className="flex w-full flex-col gap-2.5">
              <div className="flex flex-wrap items-center justify-end gap-2">
                {canManageTeam && editing && canEditCampaign(editing.status) && (
                  <>
                    <AppButton size="sm" icon={<Play size={14} />} onClick={() => handleSend(editing.id)}>
                      Send now
                    </AppButton>
                    <AppButton
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setViewOnly(false);
                        loadTemplates();
                      }}
                    >
                      Edit campaign
                    </AppButton>
                  </>
                )}
                {canManageTeam && editing?.status === 'RUNNING' && (
                  <AppButton
                    size="sm"
                    variant="secondary"
                    icon={<Pause size={14} />}
                    onClick={() => editing && handleAction(() => campaignApi.pause(editing.id), 'Campaign paused')}
                  >
                    Pause
                  </AppButton>
                )}
                {canManageTeam && editing?.status === 'PAUSED' && (
                  <AppButton
                    size="sm"
                    variant="secondary"
                    icon={<Play size={14} />}
                    onClick={() => editing && handleAction(() => campaignApi.resume(editing.id), 'Campaign resumed')}
                  >
                    Resume
                  </AppButton>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-theme-border pt-2.5">
                {canManageTeam && editing && ['RUNNING', 'PAUSED', 'SCHEDULED'].includes(editing.status) && (
                  <AppButton
                    size="sm"
                    variant="secondary"
                    icon={<Square size={14} />}
                    onClick={() => editing && handleAction(() => campaignApi.cancel(editing.id), 'Campaign cancelled')}
                  >
                    Cancel
                  </AppButton>
                )}
                {canManageTeam && editing && editing.failedCount > 0 && (
                  <AppButton
                    size="sm"
                    variant="secondary"
                    icon={<RefreshCw size={14} />}
                    onClick={() => editing && handleAction(() => campaignApi.retryFailed(editing.id), 'Retrying failed sends')}
                  >
                    Retry failed
                  </AppButton>
                )}
                {canManageTeam && editing && (
                  <AppButton size="sm" variant="secondary" icon={<Copy size={14} />} onClick={handleDuplicate}>
                    Duplicate
                  </AppButton>
                )}
                {editing && (
                  <AppButton
                    size="sm"
                    variant="secondary"
                    icon={<Download size={14} />}
                    onClick={() => editing && handleExport(editing.id, editing.name)}
                  >
                    Export
                  </AppButton>
                )}
                <AppButton size="sm" variant="secondary" onClick={closeSlide}>
                  Close
                </AppButton>
              </div>
            </div>
          ) : (
            <SlideOverFooter
              onCancel={closeSlide}
              submitLabel="Save draft"
              submitVariant="secondary"
              loading={saving}
              onDelete={editing ? handleDelete : undefined}
              deleteLabel="Delete campaign"
              primaryAction={
                !form.scheduleEnabled
                  ? {
                      label: editing ? 'Save & send' : 'Create & send',
                      onClick: handleSaveAndSend,
                    }
                  : undefined
              }
            />
          )
        }
      >
        {viewOnly && editing ? (
          <div className="space-y-5">
            <CampaignDetailHeader campaign={editing} />

            <CampaignAnalyticsPanel
              analytics={analytics}
              loading={analyticsLoading}
              error={analyticsError}
            />

            <CampaignRecipientTable
              recipients={recipients}
              total={recipientTotal}
              page={recipientPage}
              pageSize={50}
              onPageChange={setRecipientPage}
              statusFilter={recipientStatusFilter}
              onStatusFilterChange={(s) => {
                setRecipientStatusFilter(s);
                setRecipientPage(1);
              }}
            />

            <ModalPanel title="Test send" icon={TestTube2} accent="emerald">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <AppInput
                  id="test-phone"
                  label="Phone number"
                  placeholder={PHONE_PLACEHOLDER}
                  value={form.testPhone}
                  onChange={(e) => setForm({ ...form, testPhone: e.target.value })}
                  className="flex-1"
                />
                <AppButton type="button" variant="secondary" icon={<TestTube2 size={14} />} onClick={handleTestSend}>
                  Send test
                </AppButton>
              </div>
            </ModalPanel>
          </div>
        ) : (
          <form id="slideover-form" onSubmit={handleSubmit} className="space-y-6">
            {!editing && (
              <ModalCallout
                icon={LayoutTemplate}
                title="Approved templates only"
                description="Bulk campaigns need an approved template. Create one under Templates if needed."
                accent="violet"
              />
            )}

            <ModalSection step={1} title="Campaign details" subtitle="Name, template, and sending number">
              <AppInput
                id="campaign-name"
                label="Campaign name"
                placeholder="Summer promo blast"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />

              <div className="grid gap-4 lg:grid-cols-2">
                <AppSelect
                  id="campaign-template"
                  label="Approved template"
                  value={form.templateName}
                  placeholder="Select approved template"
                  options={templates.map((t) => ({
                    value: t.name,
                    label: `${t.name} (${t.language})`,
                  }))}
                  onChange={(e) => setForm({ ...form, templateName: e.target.value })}
                  required
                />
                {whatsappNumbers.length > 1 && (
                  <AppSelect
                    id="campaign-wa-number"
                    label="WhatsApp number"
                    value={form.whatsappNumberId}
                    placeholder="Default number"
                    options={[
                      { value: '', label: 'Default number' },
                      ...whatsappNumbers.map((n) => ({ value: n.id, label: n.phoneNumber })),
                    ]}
                    onChange={(e) => setForm({ ...form, whatsappNumberId: e.target.value })}
                  />
                )}
              </div>
            </ModalSection>

            {(form.bodyParams.length > 0 || form.headerParams.length > 0 || selectedTemplate) && (
              <ModalSection step={2} title="Message details" subtitle="Fill in the blanks and preview your message">
                <div className="space-y-4">
                  {form.bodyParams.map((_, i) => (
                    <AppInput
                      key={`body-${i}`}
                      id={`body-param-${i}`}
                      label={`Message line {{${i + 1}}}`}
                      placeholder={i === 0 ? '{{name}} or static text' : 'Value'}
                      value={form.bodyParams[i]}
                      onChange={(e) => {
                        const bodyParams = [...form.bodyParams];
                        bodyParams[i] = e.target.value;
                        setForm({ ...form, bodyParams });
                      }}
                    />
                  ))}

                  {form.headerParams.map((_, i) => (
                    <AppInput
                      key={`header-${i}`}
                      id={`header-param-${i}`}
                      label={`Header line {{${i + 1}}}`}
                      value={form.headerParams[i]}
                      onChange={(e) => {
                        const headerParams = [...form.headerParams];
                        headerParams[i] = e.target.value;
                        setForm({ ...form, headerParams });
                      }}
                    />
                  ))}

                  {showHeaderMedia && (
                    <AppInput
                      id="header-media-url"
                      label={headerMediaLabel(selectedTemplate ? getTemplateHeaderFormat(selectedTemplate) : undefined)}
                      hint="Link to your image or video for the header"
                      placeholder="https://example.com/image.jpg"
                      value={form.headerMediaUrl}
                      onChange={(e) => setForm({ ...form, headerMediaUrl: e.target.value })}
                      required
                    />
                  )}

                  {filledPreview && (
                    <ModalPreviewCard title="WhatsApp preview">
                      <WhatsAppTemplatePreview {...filledPreview} variant="compact" />
                    </ModalPreviewCard>
                  )}
                </div>
              </ModalSection>
            )}

            <ModalSection step={selectedTemplate ? 3 : 2} title="Audience" subtitle="Who should receive this campaign?">
              <CampaignAudienceSection
                audienceType={form.audienceType}
                onAudienceTypeChange={(audienceType) => setForm({ ...form, audienceType })}
                phones={form.phones}
                onPhonesChange={(phones) => setForm({ ...form, phones })}
                audienceTags={form.audienceTags}
                onAudienceTagsChange={(audienceTags) => setForm({ ...form, audienceTags })}
                selectedContactIds={form.selectedContactIds}
                onSelectedContactIdsChange={(selectedContactIds) =>
                  setForm({ ...form, selectedContactIds })
                }
                availableTags={availableTags}
                editingTotalContacts={editing?.totalContacts}
                showSavedCount={Boolean(editing)}
              />
            </ModalSection>

            <ModalSection
              step={selectedTemplate ? 4 : 3}
              title="Scheduling"
              subtitle="Send immediately or pick a date and time"
            >
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${
                  form.scheduleEnabled
                    ? 'border-amber-500/30 bg-amber-500/[0.04]'
                    : 'border-theme-border/70 bg-theme-surface hover:bg-theme-subtle/40'
                }`}
              >
                <input
                  type="checkbox"
                  checked={form.scheduleEnabled}
                  onChange={(e) => setForm({ ...form, scheduleEnabled: e.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-theme-border text-amber-600 focus:ring-amber-500/25"
                />
                <div>
                  <p className="text-[13px] font-bold text-theme-fg">Schedule for later</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-theme-secondary">
                    Leave unchecked to send manually after saving
                  </p>
                </div>
              </label>
              {form.scheduleEnabled && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <AppInput
                    id="scheduled-at"
                    label="Send at"
                    type="datetime-local"
                    value={form.scheduledAt}
                    onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                    required={form.scheduleEnabled}
                  />
                  <AppInput
                    id="timezone"
                    label="Timezone"
                    value={form.timezone}
                    onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  />
                </div>
              )}
            </ModalSection>

            {templates.length === 0 && (
              <ModalCallout
                icon={LayoutTemplate}
                title="No approved templates"
                description="Create a template under Templates and wait for approval before sending."
                accent="amber"
              />
            )}
          </form>
        )}
      </SlideOver>
    </PageShell>
  );
}

function getErrMsg(err: unknown, fallback: string) {
  return (
    (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
    fallback
  );
}

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
import CampaignActionsMenu from '../components/campaigns/CampaignActionsMenu';
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
import ConfirmDialog from '../components/ui/ConfirmDialog';
import ListToolbar from '../components/ui/ListToolbar';
import LoadingState from '../components/ui/LoadingState';
import PageHero from '../components/ui/PageHero';
import PageShell from '../components/ui/PageShell';
import Pagination from '../components/ui/Pagination';
import ResponsiveDataView from '../components/ui/ResponsiveDataView';
import SlideOver, { SlideOverFooter } from '../components/ui/SlideOver';
import { WhatsAppTemplatePreview } from '../components/inbox/WhatsAppPreview';
import { DEFAULT_PAGE_SIZE } from '../constants/pagination';
import { useAuth } from '../contexts/AuthContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useSocket } from '../hooks/useSocket';
import { campaignApi, contactApi, templateApi, whatsappApi } from '../services/api';
import { toastError, toastSuccess } from '../utils/toast';
import { PHONE_PLACEHOLDER, validatePhoneLines } from '../utils/phone';
import { messagingConsent } from '../utils/plainLanguage';
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

function toDateTimeLocalValue(iso?: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

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
    scheduledAt: toDateTimeLocalValue(campaign.scheduledAt),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    testPhone: '',
  };
}

function buildPayload(form: typeof emptyForm, options?: { clearSchedule?: boolean; draft?: boolean }) {
  const payload: Record<string, unknown> = {
    name: form.name,
    templateName: form.templateName,
    templateLanguage: form.templateLanguage || undefined,
    audienceType: form.audienceType,
    whatsappNumberId: form.whatsappNumberId || undefined,
    timezone: form.timezone || undefined,
    templateParams: {
      body: form.bodyParams,
      header: form.headerParams,
      headerMediaUrl: form.headerMediaUrl || undefined,
    },
  };

  if (form.audienceType === 'MANUAL') {
    const lines = form.phones.split('\n');
    const invalid = lines
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !validatePhoneLines([line]).ok);
    if (invalid.length) {
      throw new Error(`Remove or fix ${invalid.length} invalid phone line${invalid.length === 1 ? '' : 's'} before saving`);
    }
    const phones = [...new Set(lines.flatMap((line) => {
      const result = validatePhoneLines([line]);
      return result.ok ? result.phones : [];
    }))];
    if (!phones.length) throw new Error('Add at least one valid phone number');
    payload.recipients = phones.map((phone) => ({ phone }));
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

  if (options?.draft) {
    if (options.clearSchedule) payload.scheduledAt = null;
  } else if (form.scheduleEnabled && form.scheduledAt) {
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
  const [lifecycleSummary, setLifecycleSummary] = useState({
    drafts: 0,
    scheduled: 0,
    running: 0,
    completed: 0,
  });
  const [analytics, setAnalytics] = useState<CampaignAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [recipients, setRecipients] = useState<CampaignRecipient[]>([]);
  const [recipientTotal, setRecipientTotal] = useState(0);
  const [recipientPage, setRecipientPage] = useState(1);
  const [recipientStatusFilter, setRecipientStatusFilter] = useState('');
  const [activeStep, setActiveStep] = useState(0);
  const [stageError, setStageError] = useState<string | null>(null);
  const [detailSection, setDetailSection] = useState<'overview' | 'recipients' | 'errors'>('overview');
  const [audiencePreviewCount, setAudiencePreviewCount] = useState<number | null>(null);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    variant: 'danger' | 'default';
    onConfirm: () => void | Promise<void>;
  } | null>(null);

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
  const manualLines = form.phones.split('\n').map((line) => line.trim()).filter(Boolean);
  const invalidAudienceCount = form.audienceType === 'MANUAL'
    ? manualLines.filter((line) => !validatePhoneLines([line]).ok).length
    : 0;
  // The preview is authoritative for send/schedule eligibility. Local counts are
  // useful while editing, but they must never authorize a final action.
  const latestAudienceCount = audiencePreviewCount ?? 0;
  const excludedSelectedContacts = form.audienceType === 'CONTACTS' && audiencePreviewCount !== null
    ? Math.max(0, form.selectedContactIds.length - audiencePreviewCount)
    : 0;
  const finalActionBlocked =
    audiencePreviewCount === null ||
    invalidAudienceCount > 0 ||
    excludedSelectedContacts > 0 ||
    latestAudienceCount === 0;
  const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const stageLabels = ['Message', 'Audience', 'Review and send'];

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

  const loadLifecycleSummary = useCallback(() => {
    const statuses = [
      ['drafts', 'DRAFT'],
      ['scheduled', 'SCHEDULED'],
      ['running', 'RUNNING'],
      ['completed', 'COMPLETED'],
    ] as const;

    Promise.all(
      statuses.map(async ([key, status]) => {
        const { data } = await campaignApi.list({ page: '1', limit: '1', status });
        return [key, data.data.total] as const;
      })
    )
      .then((counts) => {
        setLifecycleSummary((previous) => ({
          ...previous,
          ...Object.fromEntries(counts),
        }));
      })
      .catch(() => {});
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
        loadLifecycleSummary();
      })
      .catch((err: unknown) => {
        toastError(getErrMsg(err, 'Failed to load campaigns'));
      })
      .finally(() => setLoading(false));
  }, [page, debouncedSearch, statusFilter, loadLifecycleSummary]);

  const loadDetailExtras = useCallback(async (campaignId: string) => {
    setAnalyticsLoading(true);
    setAnalyticsError(null);
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
    } catch (err: unknown) {
      setAnalyticsError(getErrMsg(err, 'Failed to load campaign analytics'));
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
    whatsappApi.numbers().then(({ data }) => setWhatsappNumbers(Array.isArray(data.data) ? data.data : [])).catch(() => {});
    contactApi
      .tags()
      .then(({ data }) => {
        const tags = data.data.tags || [];
        setAvailableTags(tags.map((t: string | { name: string }) => (typeof t === 'string' ? t : t.name)));
      })
      .catch(() => {});
  }, [loadTemplates]);

  useEffect(() => {
    if (!canManageTeam) return;

    const templateName = searchParams.get('template') || '';
    const templateLanguage = searchParams.get('language') || '';
    const contactIds = (searchParams.get('contacts') || '').split(',').filter(Boolean);
    const tags = (searchParams.get('tags') || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (!templateName && !contactIds.length && !tags.length) return;

    const audienceType = contactIds.length ? 'CONTACTS' : tags.length ? 'TAGS' : 'MANUAL';
    const name = contactIds.length
      ? `Campaign — ${contactIds.length} contact${contactIds.length === 1 ? '' : 's'}`
      : tags.length
        ? `Campaign — ${tags.join(', ')}`
        : '';
    setEditing(null);
    setViewOnly(false);
    setSlideOpen(true);
    setForm({
      ...emptyForm,
      templateName,
      templateLanguage,
      audienceType,
      audienceTags: tags.join(', '),
      selectedContactIds: contactIds,
      name,
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
    setAudiencePreviewCount(null);
    setActiveStep(0);
    setDetailSection('overview');
    setStageError(null);
    setSlideOpen(true);
    setAnalytics(null);
    setAnalyticsError(null);
    loadTemplates();
  };

  const loadCampaignDetail = async (campaign: Campaign) => {
    const { data } = await campaignApi.get(campaign.id);
    return data.data as CampaignDetail;
  };

  const refreshOpenCampaign = async (campaignId: string) => {
    const full = await loadCampaignDetail({ id: campaignId } as Campaign);
    setEditing((current) => (current?.id === campaignId ? full : current));
  };

  const openView = async (campaign: Campaign) => {
    try {
      const full = await loadCampaignDetail(campaign);
      setEditing(full);
      setViewOnly(true);
      setForm(campaignToForm(full, templates));
      setAudiencePreviewCount(null);
      setActiveStep(0);
      setDetailSection('overview');
      setStageError(null);
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
      setAudiencePreviewCount(null);
      setActiveStep(0);
      setStageError(null);
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
    setAudiencePreviewCount(null);
    setStageError(null);
    setAnalytics(null);
    setAnalyticsError(null);
    setRecipients([]);
  };

  const saveCampaign = async (action: 'draft' | 'schedule' | 'send' = 'draft') => {
    const andSend = action === 'send';
    if (selectedTemplate && templateNeedsHeaderMedia(selectedTemplate) && !form.headerMediaUrl.trim()) {
      toastError('Header media URL is required for this template');
      return null;
    }

    const payload = buildPayload(form, {
      clearSchedule: Boolean(editing && (action === 'draft' || !form.scheduleEnabled)),
      draft: action === 'draft',
    });
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
        const full = await loadCampaignDetail({ id: campaignId } as Campaign);
        setEditing(full);
        setForm(campaignToForm(full, templates));
        setViewOnly(true);
        setConfirmState({
          title: `Send to ${full.totalContacts.toLocaleString()} people?`,
          description: 'This will start sending the approved template to the selected audience.',
          confirmLabel: `Send to ${full.totalContacts.toLocaleString()}`,
          variant: 'default',
          onConfirm: async () => {
            try {
              await campaignApi.send(campaignId as string);
              toastSuccess('Campaign started');
              setSlideOpen(false);
              loadCampaigns(false);
            } catch (err: unknown) {
              toastError(getErrMsg(err, 'Failed to start campaign'));
            } finally {
              setConfirmState(null);
            }
          },
        });
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
      setConfirmState(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (viewOnly) return;
    await saveCampaign('draft');
  };

  const validateStage = (stage: number) => {
    if (stage === 0) {
      if (!form.name.trim()) return 'Add a campaign name.';
      if (!form.templateName) return 'Choose an approved template.';
      if (form.bodyParams.some((value) => !value.trim()) || form.headerParams.some((value) => !value.trim())) {
        return 'Fill in every template variable before continuing.';
      }
      if (selectedTemplate && templateNeedsHeaderMedia(selectedTemplate) && !form.headerMediaUrl.trim()) {
        return 'Add the required header media URL before continuing.';
      }
    }

    if (stage === 1) {
      if (invalidAudienceCount > 0) {
        return `Fix ${invalidAudienceCount} invalid phone number${invalidAudienceCount === 1 ? '' : 's'} before continuing.`;
      }
      if (excludedSelectedContacts > 0) {
        return `${excludedSelectedContacts} selected contact${excludedSelectedContacts === 1 ? '' : 's'} can’t receive messages. Remove them before continuing.`;
      }
      if (latestAudienceCount === 0) {
        return form.audienceType === 'TAGS'
          ? 'Add at least one contact tag.'
          : form.audienceType === 'CONTACTS'
            ? 'Select at least one contact.'
            : 'Add at least one eligible recipient.';
      }
    }

    if (stage === 2 && form.scheduleEnabled) {
      if (!form.scheduledAt) return 'Choose when this campaign should be sent.';
      if (new Date(form.scheduledAt).getTime() <= Date.now()) return 'Choose a future time for the campaign.';
    }

    return null;
  };

  const continueToNextStage = () => {
    const error = validateStage(activeStep);
    if (error) {
      setStageError(error);
      return;
    }
    setStageError(null);
    setActiveStep((step) => Math.min(stageLabels.length - 1, step + 1));
  };

  const handleFinalAction = async () => {
    if (audiencePreviewCount === null) {
      setStageError('Preview audience to continue. Final send and schedule require a successful audience preview.');
      return;
    }
    const error = validateStage(2) || validateStage(1) || validateStage(0);
    if (error) {
      setStageError(error);
      return;
    }
    setStageError(null);
    if (form.scheduleEnabled) {
      await saveCampaign('schedule');
    } else {
      await saveCampaign('send');
    }
  };

  const handleDelete = async () => {
    if (!editing) return;
    setConfirmState({
      title: 'Delete this campaign?',
      description: `“${editing.name}” will be permanently removed.`,
      confirmLabel: 'Delete campaign',
      variant: 'danger',
      onConfirm: async () => {
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
      },
    });
  };

  const handleDeleteItem = async (campaign: Campaign) => {
    if (!canEditCampaign(campaign.status)) return;
    setConfirmState({
      title: 'Delete this campaign?',
      description: `“${campaign.name}” will be permanently removed.`,
      confirmLabel: 'Delete campaign',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await campaignApi.delete(campaign.id);
          loadCampaigns(false);
          toastSuccess('Campaign deleted');
        } catch (err: unknown) {
          toastError(getErrMsg(err, 'Failed to delete campaign'));
        } finally {
          setConfirmState(null);
        }
      },
    });
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
    setConfirmState({
      title: `Send to ${count.toLocaleString()} people?`,
      description: 'This will start sending the approved template to the selected audience.',
      confirmLabel: `Send to ${count.toLocaleString()}`,
      variant: 'default',
      onConfirm: async () => {
        try {
          await campaignApi.send(id);
          loadCampaigns(false);
          toastSuccess('Campaign started');
        } catch (err: unknown) {
          toastError(getErrMsg(err, 'Failed to start campaign'));
        } finally {
          setConfirmState(null);
        }
      },
    });
  };

  const handlePause = async (id: string) => {
    if (!canManageTeam) return;
    await handleAction(() => campaignApi.pause(id), 'Campaign paused');
  };

  const handleResume = async (id: string) => {
    if (!canManageTeam) return;
    await handleAction(() => campaignApi.resume(id), 'Campaign resumed');
  };

  const handleAction = async (action: () => Promise<unknown>, success: string) => {
    try {
      await action();
      loadCampaigns(false);
      if (editing?.id) {
        const campaignId = editing.id;
        await refreshOpenCampaign(campaignId);
        void loadDetailExtras(campaignId);
      }
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
          badge="Campaigns"
          badgeIcon={Send}
          title="Plan, send, and monitor campaigns"
          description="Create a campaign, schedule it for later, and follow delivery from one place."
          accent="violet"
          stats={[
            { label: 'Drafts', value: lifecycleSummary.drafts },
            { label: 'Scheduled', value: lifecycleSummary.scheduled, tone: 'text-amber-700' },
            { label: 'Running', value: lifecycleSummary.running, tone: 'text-violet-700' },
            { label: 'Completed', value: lifecycleSummary.completed, tone: 'text-whatsapp-700' },
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
                  <AppButton icon={<Plus size={16} />} onClick={openCreate}>
                    New campaign
                  </AppButton>
                  <Link to="/content-studio">
                    <AppButton variant="secondary" size="sm">
                      Content Studio
                    </AppButton>
                  </Link>
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
            <>
              <div className="sr-only" aria-live="polite" role="status">
                Campaign progress updated: {lifecycleSummary.running} running and {lifecycleSummary.completed} completed.
              </div>
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
                    onPause={canManageTeam ? () => handlePause(c.id) : undefined}
                    onResume={canManageTeam ? () => handleResume(c.id) : undefined}
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
                    onPause={canManageTeam ? (c) => handlePause(c.id) : undefined}
                    onResume={canManageTeam ? (c) => handleResume(c.id) : undefined}
                    onDelete={canManageTeam ? handleDeleteItem : undefined}
                  />
                )}
              />
              <Pagination
                className="lg:hidden"
                page={page}
                pageSize={DEFAULT_PAGE_SIZE}
                total={total}
                onPageChange={setPage}
                itemLabel="campaigns"
              />
            </>
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
                {editing && (
                  <CampaignActionsMenu>
                    {canManageTeam && ['RUNNING', 'PAUSED', 'SCHEDULED'].includes(editing.status) && (
                      <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-theme-secondary hover:bg-theme-subtle hover:text-theme-fg" onClick={() => handleAction(() => campaignApi.cancel(editing.id), 'Campaign cancelled')}>
                        <Square size={14} /> Cancel
                      </button>
                    )}
                    {canManageTeam && editing.failedCount > 0 && (
                      <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-theme-secondary hover:bg-theme-subtle hover:text-theme-fg" onClick={() => handleAction(() => campaignApi.retryFailed(editing.id), 'Retrying failed sends')}>
                        <RefreshCw size={14} /> Retry failed
                      </button>
                    )}
                    {canManageTeam && (
                      <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-theme-secondary hover:bg-theme-subtle hover:text-theme-fg" onClick={handleDuplicate}>
                        <Copy size={14} /> Duplicate
                      </button>
                    )}
                    <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-theme-secondary hover:bg-theme-subtle hover:text-theme-fg" onClick={() => handleExport(editing.id, editing.name)}>
                      <Download size={14} /> Export
                    </button>
                  </CampaignActionsMenu>
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
                activeStep === stageLabels.length - 1
                  ? {
                      label: form.scheduleEnabled
                        ? `Schedule campaign · ${latestAudienceCount.toLocaleString()} eligible`
                        : `Send now · ${latestAudienceCount.toLocaleString()} eligible`,
                      onClick: handleFinalAction,
                    }
                  : undefined
              }
              submitDisabled={saving}
              primaryDisabled={activeStep === stageLabels.length - 1 && finalActionBlocked}
            />
          )
        }
      >
        {viewOnly && editing ? (
          <div className="space-y-5">
            <CampaignDetailHeader campaign={editing} />
            <div className="sr-only" aria-live="polite" aria-atomic="true">
              {editing.name} is {editing.status.toLowerCase()}: {editing.sentCount.toLocaleString()} of {editing.totalContacts.toLocaleString()} recipients sent.
            </div>

            <nav aria-label="Campaign detail sections" role="tablist" className="grid grid-cols-3 gap-1 rounded-xl border border-theme-border bg-theme-subtle/70 p-1">
              {[
                ['overview', 'Overview'],
                ['recipients', `Recipients (${editing.totalContacts.toLocaleString()})`],
                ['errors', `Errors (${editing.failedCount.toLocaleString()})`],
              ].map(([value, label]) => (
                <button key={value} type="button" role="tab" aria-selected={detailSection === value} onClick={() => setDetailSection(value as typeof detailSection)} className={`min-h-11 rounded-lg px-2 py-2 text-[11px] font-bold transition focus:outline-none focus:ring-2 focus:ring-violet-500/40 ${detailSection === value ? 'bg-theme-surface text-theme-fg shadow-sm' : 'text-theme-muted hover:text-theme-secondary'}`}>
                  {label}
                </button>
              ))}
            </nav>

            {detailSection === 'overview' && (
              <>
                <CampaignAnalyticsPanel
                  analytics={analytics}
                  loading={analyticsLoading}
                  error={analyticsError}
                  onViewFailures={() => setDetailSection('errors')}
                />
                <ModalPanel title="Message preview & test send" icon={TestTube2} accent="emerald">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <AppInput id="test-phone" label="Phone number" placeholder={PHONE_PLACEHOLDER} value={form.testPhone} onChange={(e) => setForm({ ...form, testPhone: e.target.value })} className="flex-1" />
                    <AppButton type="button" variant="secondary" icon={<TestTube2 size={14} />} onClick={handleTestSend}>Send test</AppButton>
                  </div>
                </ModalPanel>
              </>
            )}
            {detailSection === 'recipients' && (
              <CampaignRecipientTable recipients={recipients} total={recipientTotal} page={recipientPage} pageSize={50} onPageChange={setRecipientPage} statusFilter={recipientStatusFilter} onStatusFilterChange={(s) => { setRecipientStatusFilter(s); setRecipientPage(1); }} />
            )}
            {detailSection === 'errors' && (
              <CampaignAnalyticsPanel analytics={analytics} loading={analyticsLoading} error={analyticsError} section="errors" onViewFailures={() => setDetailSection('recipients')} onRetryFailed={() => editing && handleAction(() => campaignApi.retryFailed(editing.id), 'Retrying failed sends')} />
            )}
          </div>
        ) : (
          <form id="slideover-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="sticky top-0 z-10 -mx-1 space-y-2 bg-theme-surface/95 pb-2 backdrop-blur-sm">
            <nav aria-label="Campaign creation steps" role="tablist" className="rounded-xl border border-theme-border bg-theme-surface/95 p-2">
              <ol className="grid grid-cols-3 gap-1">
                {stageLabels.map((label, index) => (
                  <li key={label}>
                    <button
                      type="button"
                      onClick={() => index <= activeStep && setActiveStep(index)}
                      disabled={index > activeStep}
                      role="tab"
                      aria-selected={activeStep === index}
                      aria-current={activeStep === index ? 'step' : undefined}
                      className={`w-full rounded-lg px-1 py-2 text-[10px] font-bold transition focus:outline-none focus:ring-2 focus:ring-violet-500/40 ${
                        activeStep === index
                          ? 'bg-violet-600 text-white'
                          : index < activeStep
                            ? 'bg-violet-50 text-violet-700 hover:bg-violet-100 dark:bg-violet-950/30 dark:text-violet-300'
                            : 'bg-theme-subtle text-theme-muted'
                      }`}
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ol>
              <div className="sr-only" aria-live="polite">Currently editing {stageLabels[activeStep]} stage</div>
            </nav>
            </div>
            {stageError && (
              <div className="rounded-xl border border-red-200/80 bg-red-50/70 px-3.5 py-2.5 text-[12px] font-semibold text-red-800 dark:border-red-900/50 dark:bg-red-950/25 dark:text-red-300" role="alert">
                {stageError}
              </div>
            )}
            {!editing && (
              <ModalCallout
                icon={LayoutTemplate}
                title="Approved templates only"
                description="Bulk campaigns need an approved template. Create one under Templates if needed."
                accent="violet"
              />
            )}

            {activeStep === 0 && <ModalSection title="Message" subtitle="Choose an approved template and personalize the message">
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
            </ModalSection>}

            {activeStep === 0 && (form.bodyParams.length > 0 || form.headerParams.length > 0 || selectedTemplate) && (
              <ModalSection title="Message preview" subtitle="Fill in the blanks and preview your message">
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

            {activeStep === 1 && <ModalSection title="Audience" subtitle="Who should receive this campaign?">
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
                onPreviewCountChange={setAudiencePreviewCount}
              />
            </ModalSection>}

            {activeStep === 2 && <ModalSection title="Review and send" subtitle="Choose when to send, then confirm the campaign details">
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { value: false, title: 'Send now', description: 'Start after the final confirmation.' },
                  { value: true, title: 'Schedule', description: 'Choose a future date and time.' },
                ].map((option) => (
                  <label key={option.title} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition ${
                    form.scheduleEnabled === option.value
                      ? 'border-amber-500/30 bg-amber-500/[0.04]'
                      : 'border-theme-border/70 bg-theme-surface hover:bg-theme-subtle/40'
                  }`}>
                    <input
                      type="radio"
                      name="send-timing"
                      checked={form.scheduleEnabled === option.value}
                      onChange={() => setForm({ ...form, scheduleEnabled: option.value })}
                      className="mt-1 h-4 w-4 border-theme-border text-amber-600 focus:ring-amber-500/25"
                    />
                    <div>
                      <p className="text-[13px] font-bold text-theme-fg">{option.title}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-theme-secondary">{option.description}</p>
                    </div>
                  </label>
                ))}
              </div>
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
                  <div className="rounded-xl border border-theme-border bg-theme-subtle/35 px-3.5 py-3">
                    <p className="text-[11px] font-bold text-theme-fg">Browser timezone</p>
                    <p className="mt-1 text-[12px] font-semibold text-theme-secondary">{browserTimezone}</p>
                    <p className="mt-1 text-[10px] leading-relaxed text-theme-muted">The scheduled time uses your browser’s resolved timezone.</p>
                  </div>
                </div>
              )}
              {audiencePreviewCount === null && (
                <div className="rounded-xl border border-amber-200/70 bg-amber-50/70 p-3 text-[12px] text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-200" role="alert">
                  <p className="font-bold">Preview audience to continue</p>
                  <p className="mt-1">
                    Final send and schedule stay disabled until the authoritative audience preview succeeds.
                  </p>
                </div>
              )}
              <div className="rounded-xl border border-violet-200/70 bg-violet-50/60 p-3 text-[12px] dark:border-violet-800/40 dark:bg-violet-950/20">
                <p className="font-bold text-violet-900 dark:text-violet-200">Ready to review</p>
                <p className="mt-1 text-violet-800 dark:text-violet-300">Check the compact summary above, then save the draft or complete the final action below.</p>
              </div>
              <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/70 p-3 text-[12px] dark:border-emerald-800/40 dark:bg-emerald-950/20">
                <p className="font-bold text-emerald-900 dark:text-emerald-200">Send only to people who agreed to get messages</p>
                <p className="mt-1 text-emerald-800 dark:text-emerald-300">{messagingConsent.campaignNotice}. Invalid numbers and people who can’t receive messages are blocked from the final action.</p>
              </div>
                {filledPreview && (
                  <ModalPreviewCard title="Message preview">
                    <WhatsAppTemplatePreview {...filledPreview} variant="compact" />
                  </ModalPreviewCard>
                )}
            </ModalSection>}

            {templates.length === 0 && (
              <ModalCallout
                icon={LayoutTemplate}
                title="No approved templates"
                description="Create a template under Templates and wait for approval before sending."
                accent="amber"
              />
            )}
            <div className="flex items-center justify-between gap-2 border-t border-theme-border pt-4">
                  <button
                type="button"
                onClick={() => {
                  setStageError(null);
                  setActiveStep((step) => Math.max(0, step - 1));
                }}
                disabled={activeStep === 0}
                className="min-h-11 rounded-xl border border-theme-border px-3 py-2 text-[12px] font-bold text-theme-secondary transition hover:bg-theme-subtle disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
              >
                Back
              </button>
              {activeStep < stageLabels.length - 1 && (
                <button
                  type="button"
                  onClick={continueToNextStage}
                  className="min-h-11 rounded-xl bg-violet-600 px-4 py-2 text-[12px] font-bold text-white transition hover:bg-violet-700 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                >
                  Continue to {stageLabels[activeStep + 1]}
                </button>
              )}
            </div>
          </form>
        )}
      </SlideOver>
      <ConfirmDialog
        open={Boolean(confirmState)}
        onClose={() => setConfirmState(null)}
        onConfirm={() => void confirmState?.onConfirm()}
        title={confirmState?.title || ''}
        description={confirmState?.description}
        confirmLabel={confirmState?.confirmLabel}
        variant={confirmState?.variant}
        loading={saving}
      />
    </PageShell>
  );
}

function getErrMsg(err: unknown, fallback: string) {
  return (
    (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
    fallback
  );
}

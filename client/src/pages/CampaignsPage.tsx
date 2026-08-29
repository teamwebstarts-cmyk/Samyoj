import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  CalendarClock,
  Copy,
  Download,
  LayoutTemplate,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Send,
  Square,
  Users,
} from 'lucide-react';
import CampaignHero from '../components/campaigns/CampaignHero';
import CampaignRetargetPanel from '../components/campaigns/CampaignRetargetPanel';
import CampaignAudienceSection from '../components/campaigns/CampaignAudienceSection';
import { recipientsFromPhones, type CampaignRecipientDetail } from '../components/campaigns/wizard/campaignWizardModel';
import CampaignTable, { CampaignListPagination, type CampaignSortKey } from '../components/campaigns/CampaignTable';
import CampaignCard from '../components/campaigns/CampaignCard';
import CampaignDetailHeader from '../components/campaigns/CampaignDetailHeader';
import CampaignRescheduleDialog from '../components/campaigns/CampaignRescheduleDialog';
import type { CampaignReschedulePayload } from '../components/campaigns/CampaignRescheduleDialog';
import CampaignActionsMenu from '../components/campaigns/CampaignActionsMenu';
import CampaignStatusFilter from '../components/campaigns/CampaignStatusFilter';
import {
  getFilledTemplatePreview,
  getTemplateHeaderFormat,
  headerMediaLabel,
  templateNeedsHeaderMedia,
} from '../components/campaigns/campaignPreviewUtils';
import {
  ModalCallout,
  ModalPreviewCard,
  ModalSection,
} from '../components/ui/modalUi';
import AppButton from '../components/ui/AppButton';
import AppInput from '../components/ui/AppInput';
import AppSelect from '../components/ui/AppSelect';
import EmptyState from '../components/ui/EmptyState';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import {
  buildCampaignSendConfirm,
  getCampaignSendErrorMessage,
} from '../components/campaigns/campaignSendConfirm';
import ListToolbar from '../components/ui/ListToolbar';
import ListLayoutSkeleton from '../components/ui/ListLayoutSkeleton';
import PageShell from '../components/ui/PageShell';
import Pagination from '../components/ui/Pagination';
import ResponsiveDataView from '../components/ui/ResponsiveDataView';
import SlideOver, { SlideOverFooter } from '../components/ui/SlideOver';
import { WhatsAppTemplatePreview } from '../components/inbox/WhatsAppPreview';
import { InboxGlassTipProvider } from '../components/inbox/ComposerGlassTip';
import { DEFAULT_PAGE_SIZE } from '../constants/pagination';
import { useAuth } from '../contexts/AuthContext';
import { useWhatsAppNumber } from '../contexts/WhatsAppNumberContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useOnActiveNumberChange } from '../hooks/useOnActiveNumberChange';
import { useEntitlements } from '../hooks/useEntitlements';
import EntitlementNotice from '../components/billing/EntitlementNotice';
import { useSocket } from '../hooks/useSocket';
import { campaignApi, contactApi, templateApi, whatsappApi } from '../services/api';
import { toastError, toastSuccess } from '../utils/toast';
import { validatePhoneLines } from '../utils/phone';
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
  couponCode: '',
  buttonUrlSuffixes: [] as string[],
  audienceType: 'MANUAL' as AudienceType,
  audienceTags: '',
  selectedContactIds: [] as string[],
  phones: '',
  recipientDetails: {} as Record<string, CampaignRecipientDetail>,
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

const periodFilterOptions = [
  { value: '', label: 'All time' },
  { value: 'this_month', label: 'This month' },
];

function canEditCampaign(status: string) {
  return status === 'DRAFT' || status === 'SCHEDULED';
}

function canRescheduleCampaign(status: string) {
  return status === 'DRAFT' || status === 'SCHEDULED' || status === 'COMPLETED';
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
    couponCode: campaign.templateParams?.couponCode || '',
    buttonUrlSuffixes: campaign.templateParams?.buttonUrlSuffixes || [],
    audienceType: (campaign.audienceType || 'MANUAL') as AudienceType,
    audienceTags: (campaign.audienceConfig?.tags || []).join(', '),
    selectedContactIds: campaign.audienceConfig?.contactIds || [],
    phones: (campaign.recipients || []).map((r) => r.phone).join('\n'),
    recipientDetails: Object.fromEntries(
      (campaign.recipients || [])
        .filter((r) => r.name || r.variables)
        .map((r) => [
          r.phone,
          {
            ...(r.name ? { name: r.name } : {}),
            ...(r.variables ? { variables: r.variables } : {}),
          },
        ]),
    ),
    whatsappNumberId: campaign.whatsappNumberId || '',
    scheduleEnabled: Boolean(campaign.scheduledAt),
    scheduledAt: toDateTimeLocalValue(campaign.scheduledAt),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    testPhone: '',
  };
}

function buildPayload(
  form: typeof emptyForm,
  options?: { clearSchedule?: boolean; draft?: boolean; isUpdate?: boolean },
) {
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
      couponCode: form.couponCode.trim() || undefined,
      buttonUrlSuffixes: form.buttonUrlSuffixes.some((value) => value.trim())
        ? form.buttonUrlSuffixes
        : undefined,
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
    payload.recipients = recipientsFromPhones(phones, form.recipientDetails);
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
  } else if (options?.clearSchedule && options?.isUpdate) {
    payload.scheduledAt = null;
  }

  return payload;
}

export default function CampaignsPage() {
  const { canManageTeam } = useAuth();
  const { entitlements, loading: entitlementsLoading } = useEntitlements();
  const { activeNumber, resolved } = useWhatsAppNumber();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [templatesLoadError, setTemplatesLoadError] = useState<string | null>(null);
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
  const [period, setPeriod] = useState<'' | 'this_month'>('');
  const [sortBy, setSortBy] = useState<CampaignSortKey>('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
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
  const activeNumberIdRef = useRef<string | null>(null);
  activeNumberIdRef.current = activeNumber?.id ?? null;
  const [activeStep, setActiveStep] = useState(0);
  const [stageError, setStageError] = useState<string | null>(null);
  const [audiencePreviewCount, setAudiencePreviewCount] = useState<number | null>(null);
  const [confirmState, setConfirmState] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    variant: 'danger' | 'default' | 'send';
    highlight?: string;
    highlightLabel?: string;
    details?: string[];
    onConfirm: () => void | Promise<void>;
  } | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<Campaign | null>(null);
  const [rescheduleSaving, setRescheduleSaving] = useState(false);
  const canUseCampaigns =
    entitlementsLoading || !entitlements || entitlements.canUseFeature('campaigns');
  const canManageCampaigns = canManageTeam && canUseCampaigns;
  const campaignGateMessage =
    !entitlementsLoading && entitlements && !entitlements.canUseFeature('campaigns')
      ? 'Campaigns are not included on your current plan.'
      : null;

  const debouncedSearch = useDebouncedValue(search);
  const hasFilters = Boolean(search || statusFilter || period);
  const selectedTemplate = useMemo(
    () => templates.find((t) => t.name === form.templateName),
    [templates, form.templateName]
  );

  const filledPreview = useMemo(
    () => (selectedTemplate ? getFilledTemplatePreview(selectedTemplate, form) : null),
    [selectedTemplate, form.bodyParams, form.headerParams, form.headerMediaUrl]
  );

  const showHeaderMedia = selectedTemplate ? templateNeedsHeaderMedia(selectedTemplate) : false;
  const manualLines = form.phones.split('\n').map((line) => line.trim()).filter(Boolean);
  const invalidAudienceCount = form.audienceType === 'MANUAL'
    ? manualLines.filter((line) => !validatePhoneLines([line]).ok).length
    : 0;
  // The preview is the final check for send/schedule eligibility. Local counts
  // are useful while editing, but they must never authorize a final action.
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

  const [searchParams] = useSearchParams();

  const loadTemplates = useCallback(() => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    templateApi
      .list({ status: 'APPROVED', all: 'true' })
      .then(({ data }) => {
        if (requestNumberId !== activeNumberIdRef.current) return;
        const payload = data.data;
        const list = Array.isArray(payload) ? payload : payload?.templates || [];
        setTemplates(list as MessageTemplate[]);
        setTemplatesLoadError(null);
      })
      .catch(() => {
        if (requestNumberId !== activeNumberIdRef.current) return;
        setTemplatesLoadError('Couldn’t load approved templates. Try again.');
      });
  }, [activeNumber, resolved]);

  const loadWorkspaceOptions = useCallback(() => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    Promise.all([whatsappApi.numbers(), contactApi.tags()])
      .then(([numbersRes, tagsRes]) => {
        if (requestNumberId !== activeNumberIdRef.current) return;
        setWhatsappNumbers(Array.isArray(numbersRes.data.data) ? numbersRes.data.data : []);
        const tags = tagsRes.data.data.tags || [];
        setAvailableTags(tags.map((t: string | { name: string }) => (typeof t === 'string' ? t : t.name)));
      })
      .catch(() => {
        if (requestNumberId !== activeNumberIdRef.current) return;
        setWhatsappNumbers([]);
        setAvailableTags([]);
      });
  }, [activeNumber, resolved]);

  const loadLifecycleSummary = useCallback(() => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
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
        if (requestNumberId !== activeNumberIdRef.current) return;
        setLifecycleSummary((previous) => ({
          ...previous,
          ...Object.fromEntries(counts),
        }));
      })
      .catch(() => {});
  }, [activeNumber, resolved]);

  const loadCampaigns = useCallback((showLoading = false) => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    if (showLoading) setLoading(true);

    const params: Record<string, string> = {
      page: String(page),
      limit: String(pageSize),
      sortBy,
      sortDir,
    };
    if (debouncedSearch) params.search = debouncedSearch;
    if (statusFilter) params.status = statusFilter;
    if (period) params.period = period;

    campaignApi
      .list(params)
      .then(({ data }) => {
        if (requestNumberId !== activeNumberIdRef.current) return;
        setCampaigns(data.data.campaigns);
        setTotal(data.data.total);
        loadLifecycleSummary();
      })
      .catch((err: unknown) => {
        toastError(getErrMsg(err, 'Campaigns could not load. Refresh the page and try again.'));
      })
      .finally(() => {
        if (requestNumberId === activeNumberIdRef.current) setLoading(false);
      });
  }, [activeNumber, debouncedSearch, loadLifecycleSummary, page, pageSize, period, resolved, sortBy, sortDir, statusFilter]);

  const loadDetailExtras = useCallback(async (campaignId: string) => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    setAnalyticsLoading(true);
    setAnalyticsError(null);
    try {
      const analyticsRes = await campaignApi.analytics(campaignId);
      if (requestNumberId !== activeNumberIdRef.current) return;
      setAnalytics(analyticsRes.data.data as CampaignAnalytics);
    } catch {
      if (requestNumberId === activeNumberIdRef.current) {
        setAnalyticsError('Details unavailable. Refresh the campaign and try again.');
        setAnalytics(null);
      }
    } finally {
      if (requestNumberId === activeNumberIdRef.current) setAnalyticsLoading(false);
    }
  }, [activeNumber, resolved]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, period, sortBy, sortDir, pageSize]);

  useEffect(() => {
    loadTemplates();
    loadWorkspaceOptions();
  }, [activeNumber?.id, loadTemplates, loadWorkspaceOptions, resolved]);

  useOnActiveNumberChange(({ isInitial }) => {
    if (isInitial) return;
    setCampaigns([]);
    setTemplates([]);
    setTemplatesLoadError(null);
    setWhatsappNumbers([]);
    setAvailableTags([]);
    setEditing(null);
    setViewOnly(false);
    setSlideOpen(false);
    setForm(emptyForm);
    setAnalytics(null);
    setAnalyticsError(null);
    setAudiencePreviewCount(null);
    setConfirmState(null);
    setRescheduleTarget(null);
    setActiveStep(0);
    setPage(1);
    loadTemplates();
    loadWorkspaceOptions();
    loadCampaigns(true);
  });

  useEffect(() => {
    if (!canManageCampaigns) return;

    const templateName = searchParams.get('template') || '';
    const templateLanguage = searchParams.get('language') || '';
    const contactIds = (searchParams.get('contacts') || '').split(',').filter(Boolean);
    const tags = (searchParams.get('tags') || '')
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
    if (!templateName && !contactIds.length && !tags.length) return;

    const params = new URLSearchParams();
    if (templateName) params.set('template', templateName);
    if (templateLanguage) params.set('language', templateLanguage);
    if (contactIds.length) params.set('contacts', contactIds.join(','));
    if (tags.length) params.set('tags', tags.join(','));
    navigate(`/campaigns/new?${params.toString()}`);
  }, [searchParams, navigate, canManageCampaigns]);

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
    if (!canManageCampaigns) return;
    navigate('/campaigns/new');
  };

  const loadCampaignDetail = async (campaign: Campaign) => {
    if (!resolved || !activeNumber) return null;
    const requestNumberId = activeNumber.id;
    const { data } = await campaignApi.get(campaign.id);
    if (requestNumberId !== activeNumberIdRef.current) return null;
    return data.data as CampaignDetail;
  };

  const refreshOpenCampaign = async (campaignId: string) => {
    const full = await loadCampaignDetail({ id: campaignId } as Campaign);
    if (!full) return;
    setEditing((current) => (current?.id === campaignId ? full : current));
  };

  const openView = async (campaign: Campaign) => {
    if (!resolved || !activeNumber) return;
    const requestNumberId = activeNumber.id;
    try {
      const full = await loadCampaignDetail(campaign);
      if (!full || requestNumberId !== activeNumberIdRef.current) return;
      setEditing(full);
      setViewOnly(true);
      setForm(campaignToForm(full, templates));
      setAudiencePreviewCount(null);
      setActiveStep(0);
      setStageError(null);
      setSlideOpen(true);
    } catch {
      toastError('Campaign details could not load. Refresh the page and try again.');
    }
  };

  const openEdit = (campaign: Campaign) => {
    if (!canEditCampaign(campaign.status)) return;
    navigate(`/campaigns/${campaign.id}/edit?status=${campaign.status.toLowerCase()}`);
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
  };

  const saveCampaign = async (action: 'draft' | 'schedule' | 'send' = 'draft') => {
    if (!canManageCampaigns) {
      toastError(campaignGateMessage || 'Campaigns are not included on your current plan.');
      return null;
    }
    const andSend = action === 'send';
    if (selectedTemplate && templateNeedsHeaderMedia(selectedTemplate) && !form.headerMediaUrl.trim()) {
      toastError('Header media URL is required for this template');
      return null;
    }

    const payload = buildPayload(form, {
      clearSchedule: Boolean(editing && (action === 'draft' || !form.scheduleEnabled)),
      draft: action === 'draft',
      isUpdate: Boolean(editing),
    });
    setSaving(true);
    try {
      let campaignId = editing?.id;
      if (editing) {
        await campaignApi.update(editing.id, payload);
        toastSuccess(andSend ? 'Campaign saved' : action === 'schedule' ? 'Campaign scheduled' : 'Campaign saved');
      } else {
        const { data } = await campaignApi.create(payload);
        campaignId = (data.data as Campaign).id;
        toastSuccess(andSend ? 'Campaign saved' : action === 'schedule' ? 'Campaign scheduled' : 'Campaign saved as draft');
      }

      if (andSend && campaignId) {
        const full = await loadCampaignDetail({ id: campaignId } as Campaign);
        if (!full) return null;
        setEditing(full);
        setForm(campaignToForm(full, templates));
        setViewOnly(true);
        const sendConfirm = buildCampaignSendConfirm({
          campaignName: full.name,
          templateName: full.templateName,
          recipientCount: full.totalContacts ?? 0,
          excludedCount: excludedSelectedContacts > 0 ? excludedSelectedContacts : undefined,
        });
        setConfirmState({
          ...sendConfirm,
          onConfirm: async () => {
            setConfirmLoading(true);
            try {
              await campaignApi.send(campaignId as string);
              toastSuccess('Campaign queued — track delivery on the Campaigns page');
              setSlideOpen(false);
              loadCampaigns(false);
              setConfirmState(null);
            } catch (err: unknown) {
              toastError(getCampaignSendErrorMessage(err, 'Campaign could not be sent. Check the campaign and try again.'));
            } finally {
              setConfirmLoading(false);
            }
          },
        });
        return campaignId;
      }

      closeSlide();
      loadCampaigns(false);
      return campaignId;
    } catch (err: unknown) {
      toastError(getErrMsg(err, 'Campaign could not be saved. Check the required fields and try again.'));
      return null;
    } finally {
      setSaving(false);
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
        return 'Fill in every message variable.';
      }
      if (selectedTemplate && templateNeedsHeaderMedia(selectedTemplate) && !form.headerMediaUrl.trim()) {
        return 'Add a photo, video, or file for the header.';
      }
    }

    if (stage === 1) {
      // Audience eligibility is shown in the preview and enforced on the
      // final Send/Schedule action, so users can continue to Review and fix
      // their selection without being trapped on this step.
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
      title: 'Delete campaign?',
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
      toastError(getErrMsg(err, 'Campaign could not be deleted. Try again.'));
    } finally {
      setSaving(false);
    }
      },
    });
  };

  const handleDeleteItem = async (campaign: Campaign) => {
    if (!canEditCampaign(campaign.status)) return;
    setConfirmState({
      title: 'Delete campaign?',
      description: `“${campaign.name}” will be permanently removed.`,
      confirmLabel: 'Delete campaign',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await campaignApi.delete(campaign.id);
          loadCampaigns(false);
          toastSuccess('Campaign deleted');
        } catch (err: unknown) {
          toastError(getErrMsg(err, 'Campaign could not be deleted. Try again.'));
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
      toastSuccess('Campaign duplicated — review and send when ready');
      navigate(`/campaigns/${copy.id}/edit`);
    } catch (err: unknown) {
      toastError(getErrMsg(err, 'Campaign could not be duplicated. Try again.'));
    }
  };

  const handleSend = async (id: string) => {
    if (!canManageCampaigns) return;
    const campaign = campaigns.find((c) => c.id === id) || (editing?.id === id ? editing : null);
    if (!campaign) return;
    const sendConfirm = buildCampaignSendConfirm({
      campaignName: campaign.name,
      templateName: campaign.templateName,
      recipientCount: campaign.totalContacts ?? 0,
    });
    setConfirmState({
      ...sendConfirm,
      onConfirm: async () => {
        setConfirmLoading(true);
        try {
          await campaignApi.send(id);
          loadCampaigns(false);
          toastSuccess('Campaign queued — track delivery on the Campaigns page');
          setConfirmState(null);
        } catch (err: unknown) {
          toastError(getCampaignSendErrorMessage(err, 'Campaign could not be sent. Check the campaign and try again.'));
        } finally {
          setConfirmLoading(false);
        }
      },
    });
  };

  const handlePause = async (id: string) => {
    if (!canManageCampaigns) return;
    await handleAction(() => campaignApi.pause(id), 'Campaign paused', 'Could not pause this campaign. Refresh and try again.');
  };

  const handleResume = async (id: string) => {
    if (!canManageCampaigns) return;
    await handleAction(() => campaignApi.resume(id), 'Campaign resumed', 'Could not resume this campaign. Refresh and try again.');
  };

  const handleAction = async (action: () => Promise<unknown>, success: string, fallback = 'Could not update this campaign. Refresh and try again.') => {
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
      toastError(getErrMsg(err, fallback));
    }
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
      toastError('Campaign results could not be exported. Try again.');
    }
  };

  const handleRetry = async (id: string) => {
    await handleAction(
      () => campaignApi.retryFailed(id),
      'Failed campaign messages queued for retry',
      'Could not retry failed messages. Refresh and try again.'
    );
  };

  const handleRescheduleSave = async (payload: CampaignReschedulePayload) => {
    if (!rescheduleTarget) return;
    setRescheduleSaving(true);
    try {
      await campaignApi.reschedule(rescheduleTarget.id, payload);
      toastSuccess('Campaign rescheduled');
      const campaignId = rescheduleTarget.id;
      setRescheduleTarget(null);
      loadCampaigns(false);
      if (editing?.id === campaignId) {
        await refreshOpenCampaign(campaignId);
      }
    } catch (err: unknown) {
      toastError(getErrMsg(err, 'Could not reschedule this campaign. Refresh and try again.'));
    } finally {
      setRescheduleSaving(false);
    }
  };

  const handleSort = (key: CampaignSortKey) => {
    if (sortBy === key) {
      setSortDir((dir) => (dir === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortBy(key);
    setSortDir(key === 'name' || key === 'status' ? 'asc' : 'desc');
  };

  return (
    <InboxGlassTipProvider>
    <PageShell list>
      <div className="list-page-stack">
        <div className="shrink-0 space-y-2 sm:space-y-[var(--density-stack-gap)]">
        <CampaignHero
          stats={[
            { label: 'Drafts', value: lifecycleSummary.drafts, tone: 'drafts' },
            { label: 'Scheduled', value: lifecycleSummary.scheduled, tone: 'scheduled' },
          ]}
        />

        {!canManageTeam && !campaignGateMessage && (
          <div className="rounded-xl border border-amber-200/70 bg-amber-50/80 px-3.5 py-2.5 text-[12px] font-medium text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            {campaignGateMessage || 'You have read-only access to campaigns. Ask an admin to create or send campaigns.'}
          </div>
        )}
        {campaignGateMessage && (
          <EntitlementNotice
            message={campaignGateMessage}
            upgradePlan={entitlements?.isLocked ? 'growth' : entitlements?.getUpgradePlan('campaigns')}
          />
        )}
        </div>

        <div className="inbox-shell campaigns-list-shell list-shell-body overflow-hidden">
          <ListToolbar
            embedded
            compactMobile
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search campaigns or templates"
            filters={
              <>
                <CampaignStatusFilter value={statusFilter} onChange={setStatusFilter} />
                <AppSelect
                  className="w-full min-w-0 shrink-0 sm:w-[10.25rem] sm:max-w-[10.25rem] [&_.app-select__control]:!w-full [&_.app-select__single-value]:!max-w-none"
                  size="compact"
                  value={period}
                  placeholder="All time"
                  isSearchable={false}
                  options={periodFilterOptions}
                  onChange={(e) => setPeriod((e.target.value as '' | 'this_month') || '')}
                />
              </>
            }
            actions={
              canManageCampaigns ? (
                <div className="flex w-full items-stretch gap-1.5 sm:w-auto sm:gap-2">
                  <AppButton
                    size="sm"
                    className="max-sm:!min-h-9 max-sm:flex-1"
                    icon={<Plus size={15} />}
                    onClick={openCreate}
                  >
                    New campaign
                  </AppButton>
                  <Link to="/content-studio" className="max-sm:flex-1">
                    <AppButton
                      variant="secondary"
                      size="sm"
                      className="w-full max-sm:!min-h-9"
                      icon={<LayoutTemplate size={14} />}
                    >
                      Content Studio
                    </AppButton>
                  </Link>
                </div>
              ) : undefined
            }
          />

          {loading && campaigns.length === 0 ? (
            <ListLayoutSkeleton
              label="Loading campaigns"
              withProgress
              tableHeaders={['Campaign', 'Status', 'Audience', 'Progress', 'Created', 'Actions']}
            />
          ) : campaigns.length === 0 ? (
            <div className="list-shell-scroll p-4 sm:p-6">
              {hasFilters ? (
                <EmptyState
                  icon={Send}
                  variant="filter"
                  compact
                  title="No campaigns match your filters"
                  description="Try a different search word or status."
                />
              ) : (
                <div className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-br from-white via-emerald-50/35 to-violet-50/45 px-4 py-5 shadow-sm dark:border-emerald-900/50 dark:from-slate-950 dark:via-emerald-950/15 dark:to-violet-950/15 sm:px-6 sm:py-6">
                  <div
                    className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-emerald-300/20 blur-3xl dark:bg-emerald-500/10"
                    aria-hidden="true"
                  />
                  <div
                    className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-violet-300/15 blur-3xl dark:bg-violet-500/10"
                    aria-hidden="true"
                  />

                  <div className="relative grid items-center gap-6 lg:grid-cols-[210px_minmax(0,1fr)]">
                    <div className="hidden rounded-2xl border border-emerald-100 bg-white/75 p-4 shadow-sm dark:border-emerald-900/50 dark:bg-slate-950/60 lg:block">
                      <div className="flex items-center gap-2">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-[0_8px_20px_rgba(16,185,129,0.22)]">
                          <Send className="h-5 w-5" strokeWidth={2.1} />
                        </span>
                        <div>
                          <p className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">
                            Campaigns
                          </p>
                          <p className="mt-0.5 text-[11px] font-bold text-slate-700 dark:text-slate-200">
                            Ready to reach people
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center gap-2 rounded-lg bg-violet-50 px-2.5 py-2 text-[10px] font-bold text-violet-700 dark:bg-violet-950/30 dark:text-violet-300">
                          <LayoutTemplate className="h-3.5 w-3.5" />
                          Approved templates
                        </div>
                        <div className="flex items-center gap-2 rounded-lg bg-sky-50 px-2.5 py-2 text-[10px] font-bold text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">
                          <Users className="h-3.5 w-3.5" />
                          Audience targeting
                        </div>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <h3 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
                        Launch your first campaign
                      </h3>
                      <p className="mt-1.5 max-w-xl text-[11px] font-medium leading-relaxed text-slate-500 dark:text-slate-400 sm:text-[12px]">
                        Turn an approved template into a thoughtful, measurable message for the right audience.
                      </p>

                      <div className="mt-4 grid gap-2 sm:grid-cols-3">
                        {[
                          { icon: LayoutTemplate, label: 'Choose a template', tone: 'bg-violet-50 text-violet-600 dark:bg-violet-950/35 dark:text-violet-300' },
                          { icon: Users, label: 'Select your audience', tone: 'bg-sky-50 text-sky-600 dark:bg-sky-950/35 dark:text-sky-300' },
                          { icon: Send, label: 'Review and send', tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/35 dark:text-emerald-300' },
                        ].map(({ icon: StepIcon, label, tone }, index) => (
                          <div
                            key={label}
                            className="group flex min-h-[62px] items-center gap-2.5 rounded-xl border border-slate-200/70 bg-white/80 px-3 py-2.5 shadow-[0_4px_14px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_8px_20px_rgba(16,185,129,0.10)] dark:border-slate-800/80 dark:bg-slate-950/55 dark:hover:border-emerald-800"
                          >
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${tone}`}>
                              <StepIcon className="h-4 w-4" strokeWidth={2.1} />
                            </span>
                            <span className="min-w-0">
                              <span className="flex items-center gap-1.5">
                                <span className="text-[9px] font-extrabold tabular-nums text-emerald-600 dark:text-emerald-300">
                                  0{index + 1}
                                </span>
                                <span className="truncate text-[10.5px] font-bold text-slate-700 dark:text-slate-200">
                                  {label}
                                </span>
                              </span>
                            </span>
                            {index < 2 && (
                              <ArrowRight className="ml-auto hidden h-3.5 w-3.5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-500 sm:block" />
                            )}
                          </div>
                        ))}
                      </div>

                      {canManageCampaigns && (
                        <AppButton
                          className="mt-4 !min-h-9"
                          size="sm"
                          icon={<Plus className="h-3.5 w-3.5" />}
                          onClick={openCreate}
                        >
                          Create your first campaign
                          <ArrowRight className="h-3.5 w-3.5" />
                        </AppButton>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="list-shell-scroll">
                <div className="sr-only" aria-live="polite" role="status">
                  Campaign progress updated: {lifecycleSummary.running} running and {lifecycleSummary.completed} completed.
                </div>
                <ResponsiveDataView
                  items={campaigns}
                  cardClassName="divide-y divide-neutral-200 dark:divide-neutral-800 lg:hidden"
                  tableClassName="px-4 sm:px-5 pt-4"
                  renderCard={(c) => (
                    <CampaignCard
                      key={c.id}
                      campaign={c}
                      onView={() => openView(c)}
                      onEdit={canManageCampaigns ? () => openEdit(c) : undefined}
                      onSend={canManageCampaigns ? () => handleSend(c.id) : undefined}
                      onPause={canManageCampaigns ? () => handlePause(c.id) : undefined}
                      onResume={canManageCampaigns ? () => handleResume(c.id) : undefined}
                      onDelete={canManageCampaigns ? () => handleDeleteItem(c) : undefined}
                      onExport={() => handleExport(c.id, c.name)}
                      onRetry={canManageCampaigns ? () => handleRetry(c.id) : undefined}
                      onReschedule={
                        canManageCampaigns && canRescheduleCampaign(c.status)
                          ? () => setRescheduleTarget(c)
                          : undefined
                      }
                    />
                  )}
                  renderTable={() => (
                    <CampaignTable
                      campaigns={campaigns}
                      page={page}
                      pageSize={pageSize}
                      total={total}
                      onPageChange={setPage}
                      onPageSizeChange={setPageSize}
                      sortBy={sortBy}
                      sortDir={sortDir}
                      onSort={handleSort}
                      canManageTeam={canManageCampaigns}
                      showPagination={false}
                      onView={openView}
                      onEdit={canManageCampaigns ? openEdit : undefined}
                      onSend={canManageCampaigns ? (c) => handleSend(c.id) : undefined}
                      onPause={canManageCampaigns ? (c) => handlePause(c.id) : undefined}
                      onResume={canManageCampaigns ? (c) => handleResume(c.id) : undefined}
                      onDelete={canManageCampaigns ? handleDeleteItem : undefined}
                      onExport={(c) => handleExport(c.id, c.name)}
                      onRetry={canManageCampaigns ? (c) => handleRetry(c.id) : undefined}
                      onReschedule={canManageCampaigns ? setRescheduleTarget : undefined}
                    />
                  )}
                />
              </div>
              <footer className="list-shell-footer shrink-0">
                <CampaignListPagination
                  className="hidden lg:flex"
                  page={page}
                  pageSize={pageSize}
                  total={total}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
                <Pagination
                  className="lg:hidden"
                  page={page}
                  pageSize={pageSize}
                  total={total}
                  onPageChange={setPage}
                  itemLabel="campaigns"
                />
              </footer>
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
            ? 'Delivery summary'
            : 'Message, audience, timing, and review'
        }
        size={viewOnly ? '2xl' : 'xl'}
        icon={Send}
        accent="violet"
        footer={
          viewOnly ? (
            <div className="flex w-full flex-col gap-2.5">
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                {canManageCampaigns && editing && canRescheduleCampaign(editing.status) && (
                  <AppButton
                    size="sm"
                    variant="secondary"
                    className="w-full sm:w-auto"
                    icon={<CalendarClock size={14} />}
                    onClick={() => setRescheduleTarget(editing)}
                  >
                    Reschedule
                  </AppButton>
                )}
                {canManageCampaigns && editing && canEditCampaign(editing.status) && (
                  <>
                    <AppButton size="sm" className="w-full sm:w-auto" icon={<Play size={14} />} onClick={() => handleSend(editing.id)}>
                      Send now
                    </AppButton>
                    <AppButton
                      size="sm"
                      variant="secondary"
                      className="w-full sm:w-auto"
                      onClick={() => {
                        if (!editing) return;
                        const campaign = editing;
                        closeSlide();
                        openEdit(campaign);
                      }}
                    >
                      Edit campaign
                    </AppButton>
                  </>
                )}
                {canManageCampaigns && editing?.status === 'RUNNING' && (
                  <AppButton
                    size="sm"
                    variant="secondary"
                    className="w-full sm:w-auto"
                    icon={<Pause size={14} />}
                    onClick={() => editing && handleAction(() => campaignApi.pause(editing.id), 'Campaign paused')}
                  >
                    Pause
                  </AppButton>
                )}
                {canManageCampaigns && editing?.status === 'PAUSED' && (
                  <AppButton
                    size="sm"
                    variant="secondary"
                    className="w-full sm:w-auto"
                    icon={<Play size={14} />}
                    onClick={() => editing && handleAction(() => campaignApi.resume(editing.id), 'Campaign resumed')}
                  >
                    Resume
                  </AppButton>
                )}
              </div>
              <div className="flex flex-col gap-2 border-t border-theme-border pt-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                {editing && (
                  <CampaignActionsMenu>
                    {canManageCampaigns && ['RUNNING', 'PAUSED', 'SCHEDULED'].includes(editing.status) && (
                      <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-theme-secondary hover:bg-theme-subtle hover:text-theme-fg" onClick={() => handleAction(() => campaignApi.cancel(editing.id), 'Campaign cancelled')}>
                        <Square size={14} /> Cancel campaign
                      </button>
                    )}
                    {canManageCampaigns && editing.failedCount > 0 && (
                      <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-theme-secondary hover:bg-theme-subtle hover:text-theme-fg" onClick={() => handleAction(() => campaignApi.retryFailed(editing.id), 'Failed campaign messages queued for retry', 'Could not retry failed messages. Refresh and try again.')}>
                        <RefreshCw size={14} /> Retry failed sends
                      </button>
                    )}
                    {canManageCampaigns && (
                      <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-theme-secondary hover:bg-theme-subtle hover:text-theme-fg" onClick={handleDuplicate}>
                        <Copy size={14} /> Duplicate campaign
                      </button>
                    )}
                    <button type="button" role="menuitem" className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-semibold text-theme-secondary hover:bg-theme-subtle hover:text-theme-fg" onClick={() => handleExport(editing.id, editing.name)}>
                      <Download size={14} /> Export results
                    </button>
                  </CampaignActionsMenu>
                )}
                <AppButton size="sm" variant="secondary" className="w-full sm:w-auto" onClick={closeSlide}>
                  Close
                </AppButton>
              </div>
            </div>
          ) : (
            <SlideOverFooter
              onCancel={closeSlide}
              submitLabel={editing ? 'Save changes' : 'Save draft'}
              submitVariant="secondary"
              loading={saving}
              onDelete={editing ? handleDelete : undefined}
              deleteLabel="Delete campaign"
              primaryAction={
                activeStep === stageLabels.length - 1
                  ? {
                      label: form.scheduleEnabled
                        ? `Schedule campaign · ${latestAudienceCount.toLocaleString()} included`
                        : `Send now · ${latestAudienceCount.toLocaleString()} included`,
                      onClick: handleFinalAction,
                    }
                  : {
                      label: 'Continue',
                      onClick: continueToNextStage,
                    }
              }
              submitDisabled={saving}
              primaryDisabled={activeStep === stageLabels.length - 1 && finalActionBlocked}
            />
          )
        }
      >
        {viewOnly && editing ? (
          <div className="space-y-4">
            <CampaignDetailHeader campaign={editing} />
            <div className="sr-only" aria-live="polite" aria-atomic="true">
              {editing.name} is {editing.status.toLowerCase()}: {editing.sentCount.toLocaleString()} of {editing.totalContacts.toLocaleString()} recipients sent.
            </div>

            <CampaignRetargetPanel
              campaign={editing}
              campaignId={editing.id}
              campaignName={editing.name}
              analytics={analytics}
              analyticsLoading={analyticsLoading}
              analyticsError={analyticsError}
              onRetryFailed={() =>
                handleAction(
                  () => campaignApi.retryFailed(editing.id),
                  'Failed messages queued for retry',
                  'Could not retry failed messages. Refresh and try again.',
                )
              }
            />
          </div>
        ) : (
          <form id="slideover-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="sticky top-0 z-20 -mx-5 -mt-5 isolate border-b border-theme-border bg-theme-surface px-5 pb-3 pt-3 sm:-mx-6 sm:-mt-6 sm:px-6 sm:pt-4">
            <nav aria-label="Campaign creation steps" role="tablist" className="rounded-xl border border-theme-border bg-theme-surface p-2">
              <ol className="grid grid-cols-3 gap-1">
                {stageLabels.map((label, index) => (
                  <li key={label}>
                    <button
                      type="button"
                      onClick={() => setActiveStep(index)}
                      role="tab"
                      aria-selected={activeStep === index}
                      aria-current={activeStep === index ? 'step' : undefined}
                      className={`w-full rounded-lg px-1 py-2 text-[11px] font-bold transition focus:outline-none focus:ring-2 focus:ring-violet-500/40 ${
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
                title="Use an approved template"
                description="Choose an approved WhatsApp template for this campaign."
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
              <ModalSection title="Personalize message">
                <div className="space-y-4">
                  {form.bodyParams.map((_, i) => (
                    <AppInput
                      key={`body-${i}`}
                      id={`body-param-${i}`}
                      label={`Message detail ${i + 1}`}
                      placeholder={i === 0 ? 'Name or other value' : 'Enter a value'}
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
                      label={`Header detail ${i + 1}`}
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
                    hint="Add a link to the image, video, or document used in the header"
                      placeholder="https://example.com/image.jpg"
                      value={form.headerMediaUrl}
                      onChange={(e) => setForm({ ...form, headerMediaUrl: e.target.value })}
                      required
                    />
                  )}

                  {filledPreview && (
                  <ModalPreviewCard title="Message preview">
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
                recipientDetails={form.recipientDetails}
                onRecipientDetailsChange={(recipientDetails) => setForm({ ...form, recipientDetails })}
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

            {activeStep === 2 && <ModalSection title="Review and send" subtitle="Check the message, audience, cost, and send timing">
              <div className="grid gap-2 sm:grid-cols-2">
                {[
                  { value: false, title: 'Send now', description: 'Start sending after you confirm.' },
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
                    label="Send date and time"
                    type="datetime-local"
                    value={form.scheduledAt}
                    onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
                    min={getMinScheduleDateTime()}
                    aria-describedby="scheduled-at-timezone"
                    required={form.scheduleEnabled}
                  />
                  <div className="rounded-xl border border-theme-border bg-theme-subtle/35 px-3.5 py-3">
                    <p className="text-[11px] font-bold text-theme-fg">Browser timezone</p>
                    <p id="scheduled-at-timezone" className="mt-1 text-[12px] font-semibold text-theme-secondary">{browserTimezone}</p>
                  </div>
                </div>
              )}
              {audiencePreviewCount === null && (
                <div className="rounded-xl border border-amber-200/70 bg-amber-50/70 p-3 text-[12px] text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-200" role="alert">
                  <p className="font-bold">Preview audience to continue</p>
                  <p className="mt-1">
                    Check the audience preview before sending or scheduling.
                  </p>
                </div>
              )}
              <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/70 p-3 text-[12px] dark:border-emerald-800/40 dark:bg-emerald-950/20">
                  <p className="font-bold text-emerald-900 dark:text-emerald-200">Before you send</p>
                <p className="mt-1 text-emerald-800 dark:text-emerald-300">{messagingConsent.campaignNotice}</p>
              </div>
                {filledPreview && (
                  <ModalPreviewCard title="Preview">
                    <WhatsAppTemplatePreview {...filledPreview} variant="compact" />
                  </ModalPreviewCard>
                )}
            </ModalSection>}

            {templatesLoadError && templates.length === 0 ? (
              <ModalCallout
                icon={LayoutTemplate}
                title="Couldn’t load approved templates"
                description="This is not an empty list — WhatsApp didn’t return templates. Close this and try again."
                accent="amber"
              />
            ) : templates.length === 0 ? (
              <ModalCallout
                icon={LayoutTemplate}
                title="No approved templates yet"
                description="Add a Meta library template to use immediately, or create your own and wait for WhatsApp approval."
                accent="amber"
              />
            ) : null}
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
            </div>
          </form>
        )}
      </SlideOver>
      <CampaignRescheduleDialog
        campaign={rescheduleTarget}
        open={Boolean(rescheduleTarget)}
        loading={rescheduleSaving}
        onClose={() => {
          if (!rescheduleSaving) setRescheduleTarget(null);
        }}
        onSave={(payload) => void handleRescheduleSave(payload)}
      />
      <ConfirmDialog
        open={Boolean(confirmState)}
        onClose={() => {
          if (!confirmLoading) setConfirmState(null);
        }}
        onConfirm={() => void confirmState?.onConfirm()}
        title={confirmState?.title || ''}
        description={confirmState?.description}
        highlight={confirmState?.highlight}
        highlightLabel={confirmState?.highlightLabel}
        details={confirmState?.details}
        confirmLabel={confirmState?.confirmLabel}
        variant={confirmState?.variant}
        loading={confirmLoading}
        cancelLabel={confirmState?.variant === 'send' ? 'Not yet' : 'Cancel'}
      />
    </PageShell>
    </InboxGlassTipProvider>
  );
}

function getErrMsg(err: unknown, fallback: string) {
  return (
    (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ||
    fallback
  );
}

function getMinScheduleDateTime() {
  const now = new Date(Date.now() + 60_000);
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

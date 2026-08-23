import type { Campaign, CampaignRecipient, MessageTemplate } from '../../../types';
import { validatePhoneLines } from '../../../utils/phone';
import { templateNeedsHeaderMedia } from '../campaignPreviewUtils';
import { isLikelyPublicHttpsUrl } from '../../../utils/headerMedia';
import { templateDynamicUrlButtons, templateNeedsCoupon } from '../../../utils/templateForm';

export type CampaignAudienceType = 'MANUAL' | 'TAGS' | 'CONTACTS' | 'ALL_OPTED_IN';

export type CampaignRecipientDetail = {
  name?: string;
  variables?: { body?: string[]; header?: string[]; attributes?: Record<string, string> };
};

export interface CampaignWizardForm {
  name: string;
  templateName: string;
  templateLanguage: string;
  bodyParams: string[];
  headerParams: string[];
  headerMediaUrl: string;
  couponCode: string;
  buttonUrlSuffixes: string[];
  audienceType: CampaignAudienceType;
  selectedAudienceTypes: CampaignAudienceType[];
  audienceOperator: 'OR' | 'AND';
  audienceTags: string;
  selectedContactIds: string[];
  phones: string;
  recipientDetails: Record<string, CampaignRecipientDetail>;
  whatsappNumberId: string;
  scheduleEnabled: boolean;
  scheduledAt: string;
  timezone: string;
  repeatEnabled: boolean;
  repeatIntervalDays: string;
  repeatUntil: string;
  repeatMaxOccurrences: string;
  testPhone: string;
}

export type CampaignWizardDetail = Campaign & { recipients?: CampaignRecipient[] };

function getSelectedAudienceTypes(form: CampaignWizardForm): CampaignAudienceType[] {
  if (!form.selectedAudienceTypes?.length) return [form.audienceType];
  if (
    form.selectedAudienceTypes.length === 1 &&
    form.selectedAudienceTypes[0] === 'ALL_OPTED_IN' &&
    form.audienceType !== 'ALL_OPTED_IN'
  ) {
    return [form.audienceType];
  }
  return form.selectedAudienceTypes;
}

export function createEmptyCampaignWizardForm(): CampaignWizardForm {
  return {
    name: '',
    templateName: '',
    templateLanguage: '',
    bodyParams: [],
    headerParams: [],
    headerMediaUrl: '',
    couponCode: '',
    buttonUrlSuffixes: [],
    audienceType: 'ALL_OPTED_IN',
    selectedAudienceTypes: ['ALL_OPTED_IN'],
    audienceOperator: 'OR',
    audienceTags: '',
    selectedContactIds: [],
    phones: '',
    recipientDetails: {},
    whatsappNumberId: '',
    scheduleEnabled: false,
    scheduledAt: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    repeatEnabled: false,
    repeatIntervalDays: '2',
    repeatUntil: '',
    repeatMaxOccurrences: '',
    testPhone: '',
  };
}

export function recipientsFromPhones(
  phones: string[],
  details?: Record<string, CampaignRecipientDetail>,
) {
  return phones.map((phone) => {
    const extra = details?.[phone];
    const hasVars = Boolean(
      extra?.variables?.body?.length ||
        extra?.variables?.header?.length ||
        (extra?.variables?.attributes && Object.keys(extra.variables.attributes).length),
    );
    return {
      phone,
      ...(extra?.name ? { name: extra.name } : {}),
      ...(hasVars ? { variables: extra?.variables } : {}),
    };
  });
}

export function countTemplateVariables(text?: string) {
  if (!text) return 0;
  return (text.match(/\{\{\d+\}\}/g) || []).length;
}

function toDateTimeLocalValue(iso?: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function campaignToWizardForm(
  campaign: CampaignWizardDetail,
  templates: MessageTemplate[],
): CampaignWizardForm {
  const template = templates.find((item) => item.name === campaign.templateName);
  const bodyText = template?.body || template?.components?.find((component) => component.type === 'BODY')?.text;
  const headerText =
    template?.header || template?.components?.find((component) => component.type === 'HEADER')?.text;
  const empty = createEmptyCampaignWizardForm();
  const groups = campaign.audienceConfig?.groups;
  const selectedAudienceTypes: CampaignAudienceType[] = groups?.length
    ? groups.map((group) => group.type)
    : [(campaign.audienceType || 'ALL_OPTED_IN') as CampaignAudienceType];
  const audienceType =
    groups?.length && groups.some((group) => group.type === 'CONTACTS')
      ? 'CONTACTS'
      : groups?.length
        ? 'TAGS'
        : (campaign.audienceType || 'ALL_OPTED_IN') as CampaignAudienceType;
  const groupedTags = groups?.find((group) => group.type === 'TAGS')?.tags;
  const groupedContactIds = groups?.find((group) => group.type === 'CONTACTS')?.contactIds;

  return {
    ...empty,
    name: campaign.name,
    templateName: campaign.templateName,
    templateLanguage: campaign.templateLanguage || template?.language || '',
    bodyParams: campaign.templateParams?.body || Array(countTemplateVariables(bodyText)).fill(''),
    headerParams: campaign.templateParams?.header || Array(countTemplateVariables(headerText)).fill(''),
    headerMediaUrl: campaign.templateParams?.headerMediaUrl || '',
    couponCode: campaign.templateParams?.couponCode || '',
    buttonUrlSuffixes: campaign.templateParams?.buttonUrlSuffixes || [],
    audienceType,
    selectedAudienceTypes,
    audienceOperator: campaign.audienceConfig?.operator || 'OR',
    audienceTags: (groupedTags || campaign.audienceConfig?.tags || []).join(', '),
    selectedContactIds: groupedContactIds || campaign.audienceConfig?.contactIds || [],
    phones: (campaign.recipients || []).map((recipient) => recipient.phone).join('\n'),
    recipientDetails: Object.fromEntries(
      (campaign.recipients || [])
        .filter((recipient) => recipient.name || recipient.variables)
        .map((recipient) => [
          recipient.phone,
          {
            ...(recipient.name ? { name: recipient.name } : {}),
            ...(recipient.variables ? { variables: recipient.variables } : {}),
          },
        ]),
    ),
    whatsappNumberId: campaign.whatsappNumberId || '',
    scheduleEnabled: Boolean(campaign.scheduledAt),
    scheduledAt: toDateTimeLocalValue(campaign.scheduledAt),
    timezone: campaign.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    repeatEnabled: Boolean(campaign.repeatIntervalDays),
    repeatIntervalDays: campaign.repeatIntervalDays ? String(campaign.repeatIntervalDays) : '2',
    repeatUntil: toDateTimeLocalValue(campaign.repeatUntil),
    repeatMaxOccurrences: campaign.repeatMaxOccurrences ? String(campaign.repeatMaxOccurrences) : '',
    testPhone: '',
  };
}

export function buildCampaignPayload(
  form: CampaignWizardForm,
  options?: { clearSchedule?: boolean; draft?: boolean },
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

  const selectedAudienceTypes = getSelectedAudienceTypes(form);
  const hasTags = selectedAudienceTypes.includes('TAGS');
  const hasContacts = selectedAudienceTypes.includes('CONTACTS');

  if (hasTags && hasContacts) {
    payload.audienceType = 'CONTACTS';
    payload.audienceConfig = {
      groups: [
        {
          type: 'TAGS',
          tags: form.audienceTags.split(',').map((tag) => tag.trim()).filter(Boolean),
        },
        {
          type: 'CONTACTS',
          contactIds: form.selectedContactIds,
        },
      ],
      operator: form.audienceOperator || 'OR',
      requireOptIn: true,
    };
  } else if (form.audienceType === 'MANUAL') {
    const lines = form.phones.split('\n');
    const invalid = lines
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !validatePhoneLines([line]).ok);
    if (invalid.length) {
      throw new Error(
        `Remove or fix ${invalid.length} invalid phone line${invalid.length === 1 ? '' : 's'} before saving`,
      );
    }
    const phones = [
      ...new Set(
        lines.flatMap((line) => {
          const result = validatePhoneLines([line]);
          return result.ok ? result.phones : [];
        }),
      ),
    ];
    if (!phones.length) throw new Error('Add at least one valid phone number');
    payload.recipients = recipientsFromPhones(phones, form.recipientDetails);
  } else if (hasTags || form.audienceType === 'TAGS') {
    payload.audienceConfig = {
      tags: form.audienceTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      requireOptIn: true,
    };
  } else if (hasContacts || form.audienceType === 'CONTACTS') {
    if (!form.selectedContactIds.length) throw new Error('Select at least one contact');
    payload.audienceConfig = {
      contactIds: form.selectedContactIds,
      requireOptIn: true,
    };
  } else {
    payload.audienceConfig = { requireOptIn: true };
  }

  if (options?.draft) {
    if (options.clearSchedule) payload.scheduledAt = null;
  } else if (form.scheduleEnabled && form.scheduledAt) {
    payload.scheduledAt = new Date(form.scheduledAt).toISOString();
  } else if (options?.clearSchedule) {
    payload.scheduledAt = null;
  }

  const interval = Number.parseInt(form.repeatIntervalDays, 10);
  if (form.repeatEnabled && interval >= 1) {
    payload.repeatIntervalDays = interval;
    payload.repeatUntil = form.repeatUntil ? new Date(form.repeatUntil).toISOString() : null;
    const max = Number.parseInt(form.repeatMaxOccurrences, 10);
    payload.repeatMaxOccurrences = max >= 1 ? max : null;
  } else {
    payload.repeatIntervalDays = null;
    payload.repeatUntil = null;
    payload.repeatMaxOccurrences = null;
  }

  return payload;
}

export function validateCampaignWizardStage(
  stage: number,
  form: CampaignWizardForm,
  selectedTemplate: MessageTemplate | undefined,
) {
  if (stage === 0) {
    if (!form.name.trim()) return 'Add a campaign name.';
    if (!form.templateName) return 'Choose an approved template.';
    if (form.bodyParams.some((value) => !value.trim()) || form.headerParams.some((value) => !value.trim())) {
      return 'Fill in every template variable before continuing.';
    }
    if (selectedTemplate && templateNeedsHeaderMedia(selectedTemplate)) {
      if (!form.headerMediaUrl.trim()) {
        return 'Upload or paste the header media link before continuing.';
      }
      if (!isLikelyPublicHttpsUrl(form.headerMediaUrl)) {
        return 'Header media must be a public https:// link.';
      }
    }
    if (selectedTemplate && templateNeedsCoupon(selectedTemplate) && !form.couponCode.trim()) {
      return 'Add the copy-code / coupon for this template.';
    }
    const dynamicUrls = selectedTemplate ? templateDynamicUrlButtons(selectedTemplate) : [];
    if (dynamicUrls.some((_, index) => !form.buttonUrlSuffixes[index]?.trim())) {
      return 'Add the website link suffix for each trackable button.';
    }
  }

  if (stage === 1) {
    const selectedAudienceTypes = getSelectedAudienceTypes(form);
    if (selectedAudienceTypes.includes('TAGS') && !form.audienceTags.split(',').some((tag) => tag.trim())) {
      return 'Choose at least one contact tag.';
    }
    if (selectedAudienceTypes.includes('CONTACTS') && form.selectedContactIds.length === 0) {
      return 'Select at least one contact.';
    }
  }

  if (stage === 2 && form.scheduleEnabled) {
    if (!form.scheduledAt) return 'Choose when this campaign should be sent.';
    if (new Date(form.scheduledAt).getTime() <= Date.now()) {
      return 'Choose a future time for the campaign.';
    }
  }

  if (stage === 2 && form.repeatEnabled) {
    const interval = Number.parseInt(form.repeatIntervalDays, 10);
    if (!Number.isFinite(interval) || interval < 1) return 'Repeat interval must be at least 1 day.';
  }

  return null;
}

export function getCampaignScheduleMinimum() {
  const date = new Date(Date.now() + 60_000);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

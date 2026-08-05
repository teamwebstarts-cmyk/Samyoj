import { config } from '../../config';
import { AppError } from '../../utils/response';
import { createModuleLogger } from '../../utils/logger';
import { isSarvamSttConfigured } from './sarvam.stt';
import { isSarvamTtsConfigured } from './sarvam.tts';
import type { CallAction } from './types';

const log = createModuleLogger('meta-calling');
const META_BASE = `https://graph.facebook.com/${config.meta.apiVersion}`;

interface GraphErrorBody {
  message?: string;
  code?: number;
  error_subcode?: number;
  error_user_title?: string;
  error_user_msg?: string;
}

interface GraphError {
  error?: GraphErrorBody;
}

export interface CallSessionPayload {
  sdp_type: 'offer' | 'answer';
  sdp: string;
}

export const CALLING_ENABLE_HINTS = [
  'Your WhatsApp number must use Cloud API (not the WhatsApp Business mobile app).',
  'Add a payment method to your WhatsApp Business Account in Meta Business Manager.',
  'Reach a messaging limit of at least 2,000 unique customers per day (or use a Meta test number for development).',
  'Subscribe your app webhook to the "calls" field in Meta Developer Console.',
];

function parseMetaGraphError(data: GraphError, fallback: string): AppError {
  const meta = data.error;
  const raw =
    meta?.error_user_msg ||
    meta?.error_user_title ||
    meta?.message ||
    fallback;

  const isPrerequisite =
    raw.toLowerCase().includes('pre-requisite') ||
    raw.toLowerCase().includes('prerequisite') ||
    raw.toLowerCase().includes('cannot be enabled');

  if (isPrerequisite) {
    return new AppError(
      422,
      'Voice calling is not available on your WhatsApp account yet. Complete the requirements below in Meta Business Manager, then try again.',
      'CALLING_PREREQUISITES',
      undefined,
      true
    );
  }

  return new AppError(502, raw, 'META_CALLING_ERROR', undefined, true);
}

export interface CallActionResult {
  callId?: string;
}

export class MetaCallingService {
  static async callAction(
    phoneNumberId: string,
    accessToken: string,
    callId: string,
    action: CallAction,
    session?: CallSessionPayload,
    to?: string,
    bizOpaqueCallbackData?: string
  ): Promise<CallActionResult> {
    const isNewOutbound = action === 'connect' && Boolean(to);

    const body: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      action,
    };

    if (!isNewOutbound) {
      body.call_id = callId;
    }
    if (session) {
      body.session = session;
    }
    if (to) {
      body.to = to.replace(/\D/g, '');
    }
    if (bizOpaqueCallbackData) {
      body.biz_opaque_callback_data = bizOpaqueCallbackData.slice(0, 512);
    }

    const res = await fetch(`${META_BASE}/${phoneNumberId}/calls`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as {
      success?: boolean;
      calls?: Array<{ id: string }>;
    } & GraphError;
    if (!res.ok || data.success === false) {
      const message = data.error?.message || `Meta call action ${action} failed (${res.status})`;
      log.error('Meta call action failed', {
        action,
        callId: isNewOutbound ? undefined : callId,
        to: to ? body.to : undefined,
        status: res.status,
        error: data.error,
      });
      throw parseMetaGraphError(data, message);
    }

    const metaCallId = data.calls?.[0]?.id;
    log.info('Meta call action success', { action, callId: metaCallId || callId });
    return { callId: metaCallId };
  }

  static async initiateOutboundCall(
    phoneNumberId: string,
    accessToken: string,
    to: string,
    session: CallSessionPayload,
    bizOpaqueCallbackData?: string
  ): Promise<string> {
    const { callId } = await this.callAction(
      phoneNumberId,
      accessToken,
      '',
      'connect',
      session,
      to,
      bizOpaqueCallbackData
    );
    if (!callId) {
      throw new AppError(502, 'Meta did not return a call ID', 'META_CALLING_ERROR', undefined, true);
    }
    return callId;
  }

  static async preAccept(
    phoneNumberId: string,
    accessToken: string,
    callId: string,
    sdpAnswer: string
  ): Promise<void> {
    await this.callAction(phoneNumberId, accessToken, callId, 'pre_accept', {
      sdp_type: 'answer',
      sdp: sdpAnswer,
    });
  }

  static async accept(
    phoneNumberId: string,
    accessToken: string,
    callId: string,
    sdpAnswer: string
  ): Promise<void> {
    await this.callAction(phoneNumberId, accessToken, callId, 'accept', {
      sdp_type: 'answer',
      sdp: sdpAnswer,
    });
  }

  static async reject(phoneNumberId: string, accessToken: string, callId: string): Promise<void> {
    await this.callAction(phoneNumberId, accessToken, callId, 'reject');
  }

  static async terminate(phoneNumberId: string, accessToken: string, callId: string): Promise<void> {
    await this.callAction(phoneNumberId, accessToken, callId, 'terminate');
  }

  static async enableCalling(phoneNumberId: string, accessToken: string): Promise<void> {
    const res = await fetch(`${META_BASE}/${phoneNumberId}/settings`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        calling: {
          status: 'ENABLED',
          call_icon_visibility: 'DEFAULT',
          callback_permission_status: 'ENABLED',
        },
      }),
    });

    const data = (await res.json()) as { success?: boolean; calling?: { status?: string } } & GraphError;
    if (!res.ok && data.success !== true) {
      log.warn('Enable calling rejected by Meta', { phoneNumberId, error: data.error });
      throw parseMetaGraphError(data, `Failed to enable calling (${res.status})`);
    }
    log.info('Calling enabled on phone number', { phoneNumberId });
  }

  static isCallingEnabled(settings: Record<string, unknown> | null | undefined): boolean {
    const calling = settings?.calling as { status?: string } | undefined;
    return calling?.status === 'ENABLED';
  }

  static async getCallingSettings(
    phoneNumberId: string,
    accessToken: string
  ): Promise<Record<string, unknown>> {
    const res = await fetch(`${META_BASE}/${phoneNumberId}/settings`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = (await res.json()) as Record<string, unknown> & GraphError;
    if (!res.ok) {
      throw parseMetaGraphError(data, `Failed to get calling settings (${res.status})`);
    }
    return data;
  }

  /**
   * Per-user Meta call permission state (required before business-initiated calls).
   * @see https://developers.facebook.com/documentation/business-messaging/whatsapp/calling/user-call-permissions
   */
  static async getUserCallPermissions(
    phoneNumberId: string,
    accessToken: string,
    userWaId: string
  ): Promise<{
    status: string | null;
    expirationTime?: number;
    canStartCall: boolean;
    canRequestPermission: boolean;
    raw: Record<string, unknown>;
  }> {
    const waId = userWaId.replace(/\D/g, '');
    const res = await fetch(
      `${META_BASE}/${phoneNumberId}/call_permissions?user_wa_id=${encodeURIComponent(waId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = (await res.json()) as Record<string, unknown> & GraphError;
    if (!res.ok) {
      throw parseMetaGraphError(data, `Failed to get call permissions (${res.status})`);
    }

    const permission = data.permission as { status?: string; expiration_time?: number } | undefined;
    const actions = (data.actions as Array<{
      action_name?: string;
      can_perform_action?: boolean;
    }>) || [];

    const start = actions.find((a) => a.action_name === 'start_call');
    const request = actions.find((a) => a.action_name === 'send_call_permission_request');

    const status = permission?.status || null;
    const grantedLike =
      status === 'granted' ||
      status === 'temporary' ||
      status === 'permanent' ||
      Boolean(start?.can_perform_action);

    return {
      status,
      expirationTime: permission?.expiration_time,
      canStartCall: Boolean(start?.can_perform_action ?? grantedLike),
      canRequestPermission: Boolean(request?.can_perform_action ?? true),
      raw: data,
    };
  }

  /**
   * Official Meta interactive call_permission_request (NOT generic reply buttons).
   * Fake "Allow calls" buttons do not grant Meta calling permission.
   */
  static async sendCallPermissionRequest(
    phoneNumberId: string,
    accessToken: string,
    toPhone: string,
    bodyText?: string
  ): Promise<void> {
    const res = await fetch(`${META_BASE}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: toPhone.replace(/\D/g, ''),
        type: 'interactive',
        interactive: {
          type: 'call_permission_request',
          action: { name: 'call_permission_request' },
          body: {
            text:
              bodyText?.trim() ||
              'We would like to call you on WhatsApp to help with your request. Do you allow voice calls?',
          },
        },
      }),
    });

    const data = (await res.json()) as Record<string, unknown> & GraphError;
    if (!res.ok) {
      throw parseMetaGraphError(data, `Failed to send call permission request (${res.status})`);
    }
    log.info('Call permission request sent', { phoneNumberId, to: toPhone.replace(/\D/g, '') });
  }
}

export function isCallingConfigured(): boolean {
  if (config.calling.voiceProvider === 'sarvam') {
    return isSarvamSttConfigured() && isSarvamTtsConfigured();
  }
  return Boolean(config.calling.deepgramApiKey && config.calling.googleCredentialsPath);
}

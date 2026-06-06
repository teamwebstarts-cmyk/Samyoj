import { config } from '../../config';
import { AppError } from '../../utils/response';
import { createModuleLogger } from '../../utils/logger';
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

export class MetaCallingService {
  static async callAction(
    phoneNumberId: string,
    accessToken: string,
    callId: string,
    action: CallAction,
    session?: CallSessionPayload,
    to?: string
  ): Promise<void> {
    const body: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      call_id: callId,
      action,
    };

    if (session) {
      body.session = session;
    }
    if (to) {
      body.to = to;
    }

    const res = await fetch(`${META_BASE}/${phoneNumberId}/calls`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = (await res.json()) as { success?: boolean } & GraphError;
    if (!res.ok || data.success === false) {
      const message = data.error?.message || `Meta call action ${action} failed (${res.status})`;
      log.error('Meta call action failed', { action, callId, status: res.status, error: data.error });
      throw parseMetaGraphError(data, message);
    }

    log.info('Meta call action success', { action, callId });
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
}

export function isCallingConfigured(): boolean {
  return Boolean(config.calling.deepgramApiKey && config.calling.googleCredentialsPath);
}

import jwt from 'jsonwebtoken';
import { config } from '../../config';

export interface WhatsappConnectPendingPayload {
  type: 'whatsapp_connect_pending';
  organizationId: string;
  userId: string;
  accessToken: string;
}

export function signConnectPending(payload: Omit<WhatsappConnectPendingPayload, 'type'>): string {
  return jwt.sign(
    { ...payload, type: 'whatsapp_connect_pending' as const },
    config.jwt.secret,
    { expiresIn: '15m' }
  );
}

export function verifyConnectPending(token: string): WhatsappConnectPendingPayload {
  const decoded = jwt.verify(token, config.jwt.secret) as WhatsappConnectPendingPayload;
  if (decoded.type !== 'whatsapp_connect_pending') {
    throw new Error('Invalid connect session');
  }
  return decoded;
}

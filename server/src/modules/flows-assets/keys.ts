import { generateKeyPairSync } from 'crypto';
import { MetaWhatsAppService } from '../whatsapp/meta.service';

export function generateFlowKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKey, privateKey };
}

export function getFlowPrivateKey(): string {
  const raw = process.env.FLOW_PRIVATE_KEY || '';
  if (!raw) {
    throw new Error('FLOW_PRIVATE_KEY is not configured');
  }
  return raw.replace(/\\n/g, '\n');
}

export async function registerFlowKey(
  wabaId: string,
  accessToken: string,
  publicKeyPem: string
): Promise<void> {
  await MetaWhatsAppService.registerFlowPublicKey(wabaId, accessToken, publicKeyPem);
}

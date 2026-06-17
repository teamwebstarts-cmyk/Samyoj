import {
  constants,
  createCipheriv,
  createDecipheriv,
  privateDecrypt,
} from 'crypto';
import { getFlowPrivateKey } from './keys';

export interface FlowEncryptedRequest {
  encrypted_aes_key: string;
  encrypted_flow_data: string;
  initial_vector: string;
}

export interface DecryptedFlowRequest {
  decrypted: string;
  aesKey: Buffer;
  iv: Buffer;
}

export function decryptRequest(body: FlowEncryptedRequest): DecryptedFlowRequest {
  const privateKey = getFlowPrivateKey();
  const aesKey = privateDecrypt(
    {
      key: privateKey,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    Buffer.from(body.encrypted_aes_key, 'base64')
  );

  const iv = Buffer.from(body.initial_vector, 'base64');
  const encryptedData = Buffer.from(body.encrypted_flow_data, 'base64');
  const authTag = encryptedData.subarray(encryptedData.length - 16);
  const ciphertext = encryptedData.subarray(0, encryptedData.length - 16);

  const decipher = createDecipheriv('aes-128-gcm', aesKey.subarray(0, 16), iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return { decrypted: plaintext.toString('utf-8'), aesKey, iv };
}

export function flipIv(iv: Buffer): Buffer {
  return Buffer.from(iv.map((b, i) => b ^ (i + 1)));
}

export function encryptResponse(plaintext: object, aesKey: Buffer, iv: Buffer): string {
  const cipher = createCipheriv('aes-128-gcm', aesKey.subarray(0, 16), iv);
  const enc = Buffer.concat([
    cipher.update(JSON.stringify(plaintext), 'utf8'),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return enc.toString('base64');
}

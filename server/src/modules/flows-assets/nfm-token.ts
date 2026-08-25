import { createHmac, timingSafeEqual } from 'crypto';
import { randomUUID } from 'crypto';
import { config } from '../../config';
import prisma from '../../config/database';

const TOKEN_PREFIX = 'sy1.';
const TOKEN_TTL_SEC = 24 * 60 * 60;

export interface NfmFlowTokenClaims {
  conversationId: string;
  nodeId: string;
  exp: number;
  nonce: string;
}

function nfmHmacSecret(): string {
  const secret =
    config.meta.appSecret ||
    config.jwt.secret ||
    (config.nodeEnv !== 'production' ? 'dev-nfm-token-secret' : '');
  if (!secret) {
    throw new Error('NFM flow token secret is not configured (META_APP_SECRET)');
  }
  return secret;
}

function signPayload(payloadB64: string, secret: string): string {
  return createHmac('sha256', secret).update(payloadB64).digest('base64url');
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function mintNfmFlowToken(
  input: { conversationId: string; nodeId: string; now?: Date },
  secret = nfmHmacSecret()
): string {
  const exp = Math.floor((input.now ?? new Date()).getTime() / 1000) + TOKEN_TTL_SEC;
  const payload = Buffer.from(
    JSON.stringify({
      cid: input.conversationId,
      nid: input.nodeId,
      exp,
      n: randomUUID(),
    }),
    'utf8'
  ).toString('base64url');
  return `${TOKEN_PREFIX}${payload}.${signPayload(payload, secret)}`;
}

export function parseNfmFlowToken(
  token: string | undefined,
  opts?: { now?: Date; secret?: string }
): NfmFlowTokenClaims | null {
  if (!token || !token.startsWith(TOKEN_PREFIX)) return null;
  const body = token.slice(TOKEN_PREFIX.length);
  const lastDot = body.lastIndexOf('.');
  if (lastDot <= 0) return null;
  const payloadB64 = body.slice(0, lastDot);
  const sig = body.slice(lastDot + 1);
  if (!payloadB64 || !sig) return null;

  let secret: string;
  try {
    secret = opts?.secret ?? nfmHmacSecret();
  } catch {
    return null;
  }
  if (!safeEqual(sig, signPayload(payloadB64, secret))) return null;

  let parsed: { cid?: unknown; nid?: unknown; exp?: unknown; n?: unknown };
  try {
    parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      cid?: unknown;
      nid?: unknown;
      exp?: unknown;
      n?: unknown;
    };
  } catch {
    return null;
  }

  if (
    typeof parsed.cid !== 'string' ||
    !parsed.cid ||
    typeof parsed.nid !== 'string' ||
    !parsed.nid ||
    typeof parsed.n !== 'string' ||
    !parsed.n ||
    typeof parsed.exp !== 'number' ||
    !Number.isFinite(parsed.exp)
  ) {
    return null;
  }

  const nowSec = Math.floor((opts?.now ?? new Date()).getTime() / 1000);
  if (parsed.exp < nowSec) return null;

  return {
    conversationId: parsed.cid,
    nodeId: parsed.nid,
    exp: parsed.exp,
    nonce: parsed.n,
  };
}

/** Compare-and-set so a replayed NFM webhook cannot run the flow twice. */
export async function consumeNfmFlowTokenOnce(input: {
  conversationId: string;
  organizationId: string;
  whatsappNumberId: string;
  flowToken: string;
  nonce: string;
}): Promise<boolean> {
  const count = await prisma.$executeRaw`
    UPDATE conversations
    SET
      bot_state = jsonb_set(
        jsonb_set(
          COALESCE(bot_state, '{}'::jsonb),
          '{variables}',
          COALESCE(bot_state -> 'variables', '{}'::jsonb),
          true
        ),
        '{variables,_wa_flow_consumed_nonce}',
        to_jsonb(${input.nonce}::text),
        true
      ),
      updated_at = NOW()
    WHERE id = ${input.conversationId}
      AND organization_id = ${input.organizationId}
      AND whatsapp_number_id = ${input.whatsappNumberId}
      AND bot_state ->> 'waitingFor' = 'wa_flow'
      AND bot_state #>> '{variables,_last_wa_flow_token}' = ${input.flowToken}
      AND COALESCE(bot_state #>> '{variables,_wa_flow_consumed_nonce}', '') = ''
  `;
  return count === 1;
}

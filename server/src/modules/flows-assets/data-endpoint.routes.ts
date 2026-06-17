import { Router, Request, Response } from 'express';
import { decryptRequest, encryptResponse, flipIv } from './crypto';
import { AppError, asyncHandler } from '../../utils/response';
import logger from '../../utils/logger';

const router = Router();

interface FlowExchangePayload {
  screen?: string;
  action?: string;
  data?: Record<string, unknown>;
  version?: string;
  flow_token?: string;
}

async function handleFlowExchange(payload: FlowExchangePayload): Promise<Record<string, unknown>> {
  const action = payload.action || 'ping';

  if (action === 'ping') {
    return { data: { status: 'active' } };
  }

  if (action === 'INIT') {
    return {
      screen: payload.screen || 'MAIN',
      data: payload.data || {},
    };
  }

  if (action === 'data_exchange') {
    return {
      screen: 'SUCCESS',
      data: {
        extension_message_response: {
          params: {
            flow_token: payload.flow_token,
            ...payload.data,
          },
        },
      },
    };
  }

  return { screen: payload.screen || 'MAIN', data: payload.data || {} };
}

router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as {
      encrypted_aes_key?: string;
      encrypted_flow_data?: string;
      initial_vector?: string;
    };

    if (!body.encrypted_aes_key || !body.encrypted_flow_data || !body.initial_vector) {
      throw new AppError(400, 'Missing encrypted flow data fields');
    }

    let decrypted: string;
    let aesKey: Buffer;
    let iv: Buffer;

    try {
      ({ decrypted, aesKey, iv } = decryptRequest({
        encrypted_aes_key: body.encrypted_aes_key,
        encrypted_flow_data: body.encrypted_flow_data,
        initial_vector: body.initial_vector,
      }));
    } catch (err) {
      logger.warn('Flow data decryption failed', {
        source: 'flows-assets',
        error: err instanceof Error ? err.message : String(err),
      });
      throw new AppError(421, 'Failed to decrypt flow data');
    }

    let payload: FlowExchangePayload;
    try {
      payload = JSON.parse(decrypted) as FlowExchangePayload;
    } catch {
      throw new AppError(400, 'Invalid decrypted flow payload');
    }

    const response = await handleFlowExchange(payload);
    const flippedIv = flipIv(iv);

    return res.json({
      data: encryptResponse(response, aesKey, flippedIv),
    });
  })
);

export default router;

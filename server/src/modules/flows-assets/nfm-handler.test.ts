import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/database', () => ({
  default: {
    conversation: { findUnique: vi.fn() },
    flow: { findFirst: vi.fn() },
    flowAsset: { findFirst: vi.fn() },
    $executeRaw: vi.fn(),
  },
}));

vi.mock('../../config', () => ({
  config: {
    nodeEnv: 'test',
    meta: { appSecret: 'nfm-handler-test-secret' },
    jwt: { secret: 'test-jwt' },
  },
}));

vi.mock('../automation/engine', () => ({
  handleInboundAutomations: vi.fn(),
}));

vi.mock('./nfm-token', async () => {
  const actual = await vi.importActual<typeof import('./nfm-token')>('./nfm-token');
  return {
    ...actual,
    consumeNfmFlowTokenOnce: vi.fn(),
  };
});

import prisma from '../../config/database';
import { handleInboundAutomations } from '../automation/engine';
import { handleNfmReply } from './nfm-handler';
import { consumeNfmFlowTokenOnce, mintNfmFlowToken } from './nfm-token';

const conversationFind = vi.mocked(prisma.conversation.findUnique);
const flowFind = vi.mocked(prisma.flow.findFirst);
const inbound = vi.mocked(handleInboundAutomations);
const consume = vi.mocked(consumeNfmFlowTokenOnce);

const SECRET = 'nfm-handler-test-secret';

function signedToken(conversationId: string, nodeId: string) {
  return mintNfmFlowToken({ conversationId, nodeId }, SECRET);
}

function nfmEnvelope(opts: {
  token: string;
  from?: string;
  phoneNumberId?: string;
  flowId?: string;
  extra?: Record<string, unknown>;
}) {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: opts.phoneNumberId ?? 'meta-phone-1' },
              messages: [
                {
                  from: opts.from ?? '919876543210',
                  interactive: {
                    type: 'nfm_reply',
                    nfm_reply: {
                      flow_token: opts.token,
                      response_json: JSON.stringify({
                        flow_id: opts.flowId ?? 'meta-flow-1',
                        ...(opts.extra || {}),
                      }),
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

const token = signedToken('conv-1', 'form-step');

const baseConversation = {
  id: 'conv-1',
  organizationId: 'org-1',
  contactId: 'contact-1',
  whatsappNumberId: 'wa-1',
  contact: { phone: '+919876543210', normalizedPhone: '919876543210', optedIn: true },
  whatsappNumber: { phoneNumberId: 'meta-phone-1', isActive: true },
  botState: {
    flowId: 'flow-1',
    currentNodeId: 'form-step',
    waitingFor: 'wa_flow',
    variables: { _last_wa_flow_token: token },
  },
};

describe('handleNfmReply', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consume.mockResolvedValue(true);
    process.env.META_APP_SECRET = SECRET;
  });

  it('ignores payloads without an NFM reply', async () => {
    const result = await handleNfmReply({});
    expect(result).toEqual({ handled: false });
    expect(conversationFind).not.toHaveBeenCalled();
  });

  it('rejects unsigned legacy tokens without looking up the conversation', async () => {
    const result = await handleNfmReply(
      nfmEnvelope({ token: 'conv-1:form-step:token' })
    );
    expect(result).toEqual({ handled: true });
    expect(conversationFind).not.toHaveBeenCalled();
    expect(inbound).not.toHaveBeenCalled();
  });

  it('rejects a direct test payload that omits sender and number identity', async () => {
    const result = await handleNfmReply({
      nfm_reply: {
        flow_token: token,
        response_json: JSON.stringify({ flow_id: 'meta-flow-1' }),
      },
    } as never);
    expect(result).toEqual({ handled: false });
    expect(conversationFind).not.toHaveBeenCalled();
  });

  it('rejects replies when the WhatsApp number does not match', async () => {
    conversationFind.mockResolvedValue(baseConversation as never);

    const result = await handleNfmReply(
      nfmEnvelope({ token, phoneNumberId: 'other-phone' })
    );

    expect(result.handled).toBe(true);
    expect(inbound).not.toHaveBeenCalled();
  });

  it('rejects replies when the sender phone does not match the conversation contact', async () => {
    conversationFind.mockResolvedValue(baseConversation as never);

    const result = await handleNfmReply(nfmEnvelope({ token, from: '919999999999' }));

    expect(result.handled).toBe(true);
    expect(inbound).not.toHaveBeenCalled();
  });

  it('ignores replies when the conversation is not waiting for a form', async () => {
    conversationFind.mockResolvedValue({
      ...baseConversation,
      botState: { flowId: 'flow-1', currentNodeId: 'form-step', waitingFor: 'buttons' },
    } as never);

    const result = await handleNfmReply(nfmEnvelope({ token }));

    expect(result.handled).toBe(true);
    expect(inbound).not.toHaveBeenCalled();
  });

  it('rejects replies when the flow token node does not match the active step', async () => {
    conversationFind.mockResolvedValue(baseConversation as never);
    const other = signedToken('conv-1', 'other-step');

    const result = await handleNfmReply(nfmEnvelope({ token: other }));

    expect(result.handled).toBe(true);
    expect(inbound).not.toHaveBeenCalled();
  });

  it('rejects replies when the submitted form id does not match the active step', async () => {
    conversationFind.mockResolvedValue(baseConversation as never);
    flowFind.mockResolvedValue({
      nodes: [{ id: 'form-step', type: 'wa_flow', waFlowId: 'meta-flow-expected' }],
    } as never);

    const result = await handleNfmReply(nfmEnvelope({ token, flowId: 'meta-flow-wrong' }));

    expect(result.handled).toBe(true);
    expect(inbound).not.toHaveBeenCalled();
  });

  it('does not re-run inbound when the token was already consumed', async () => {
    conversationFind.mockResolvedValue(baseConversation as never);
    flowFind.mockResolvedValue({
      nodes: [{ id: 'form-step', type: 'wa_flow', waFlowId: 'meta-flow-1' }],
    } as never);
    consume.mockResolvedValue(false);

    const result = await handleNfmReply(nfmEnvelope({ token, extra: { name: 'Rahul' } }));

    expect(result.handled).toBe(true);
    expect(inbound).not.toHaveBeenCalled();
  });

  it('hands valid replies to inbound automation with reconstructed flow response', async () => {
    conversationFind.mockResolvedValue(baseConversation as never);
    flowFind.mockResolvedValue({
      nodes: [{ id: 'form-step', type: 'wa_flow', waFlowId: 'meta-flow-1' }],
    } as never);

    const result = await handleNfmReply(nfmEnvelope({ token, extra: { name: 'Rahul' } }));

    expect(result.handled).toBe(true);
    expect(consume).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-1',
        organizationId: 'org-1',
        whatsappNumberId: 'wa-1',
        flowToken: token,
      })
    );
    expect(inbound).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        conversationId: 'conv-1',
        contactId: 'contact-1',
        whatsappNumberId: 'wa-1',
        messageType: 'interactive',
        waFlowResponse: expect.objectContaining({ flow_id: 'meta-flow-1', name: 'Rahul' }),
      })
    );
  });
});

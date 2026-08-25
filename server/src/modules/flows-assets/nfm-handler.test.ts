import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../config/database', () => ({
  default: {
    conversation: { findUnique: vi.fn() },
    flow: { findFirst: vi.fn() },
    flowAsset: { findFirst: vi.fn() },
  },
}));

vi.mock('../automation/engine', () => ({
  handleInboundAutomations: vi.fn(),
}));

import prisma from '../../config/database';
import { handleInboundAutomations } from '../automation/engine';
import { handleNfmReply } from './nfm-handler';

const conversationFind = vi.mocked(prisma.conversation.findUnique);
const flowFind = vi.mocked(prisma.flow.findFirst);
const inbound = vi.mocked(handleInboundAutomations);

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
  },
};

describe('handleNfmReply', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ignores payloads without an NFM reply', async () => {
    const result = await handleNfmReply({});
    expect(result).toEqual({ handled: false });
    expect(conversationFind).not.toHaveBeenCalled();
  });

  it('rejects replies when the WhatsApp number does not match', async () => {
    conversationFind.mockResolvedValue(baseConversation as never);

    const result = await handleNfmReply({
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: 'other-phone' },
                messages: [
                  {
                    from: '919876543210',
                    interactive: {
                      type: 'nfm_reply',
                      nfm_reply: {
                        flow_token: 'conv-1:form-step:token',
                        response_json: JSON.stringify({ flow_id: 'meta-flow-1' }),
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(result.handled).toBe(true);
    expect(inbound).not.toHaveBeenCalled();
  });

  it('rejects replies when the sender phone does not match the conversation contact', async () => {
    conversationFind.mockResolvedValue(baseConversation as never);

    const result = await handleNfmReply({
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: 'meta-phone-1' },
                messages: [
                  {
                    from: '919999999999',
                    interactive: {
                      type: 'nfm_reply',
                      nfm_reply: {
                        flow_token: 'conv-1:form-step:token',
                        response_json: JSON.stringify({ flow_id: 'meta-flow-1' }),
                      },
                    },
                  },
                ],
              },
            },
          ],
        },
      ],
    });

    expect(result.handled).toBe(true);
    expect(inbound).not.toHaveBeenCalled();
  });

  it('ignores replies when the conversation is not waiting for a form', async () => {
    conversationFind.mockResolvedValue({
      ...baseConversation,
      botState: { flowId: 'flow-1', currentNodeId: 'form-step', waitingFor: 'buttons' },
    } as never);

    const result = await handleNfmReply({
      nfm_reply: {
        flow_token: 'conv-1:form-step:token',
        response_json: JSON.stringify({ flow_id: 'meta-flow-1' }),
      },
    });

    expect(result.handled).toBe(true);
    expect(inbound).not.toHaveBeenCalled();
  });

  it('rejects replies when the flow token node does not match the active step', async () => {
    conversationFind.mockResolvedValue(baseConversation as never);

    const result = await handleNfmReply({
      nfm_reply: {
        flow_token: 'conv-1:other-step:token',
        response_json: JSON.stringify({ flow_id: 'meta-flow-1' }),
      },
    });

    expect(result.handled).toBe(true);
    expect(inbound).not.toHaveBeenCalled();
  });

  it('rejects replies when the submitted form id does not match the active step', async () => {
    conversationFind.mockResolvedValue(baseConversation as never);
    flowFind.mockResolvedValue({
      nodes: [{ id: 'form-step', type: 'wa_flow', waFlowId: 'meta-flow-expected' }],
    } as never);

    const result = await handleNfmReply({
      nfm_reply: {
        flow_token: 'conv-1:form-step:token',
        response_json: JSON.stringify({ flow_id: 'meta-flow-wrong' }),
      },
    });

    expect(result.handled).toBe(true);
    expect(inbound).not.toHaveBeenCalled();
  });

  it('hands valid replies to inbound automation with reconstructed flow response', async () => {
    conversationFind.mockResolvedValue(baseConversation as never);
    flowFind.mockResolvedValue({
      nodes: [{ id: 'form-step', type: 'wa_flow', waFlowId: 'meta-flow-1' }],
    } as never);

    const result = await handleNfmReply({
      nfm_reply: {
        flow_token: 'conv-1:form-step:token',
        response_json: JSON.stringify({ flow_id: 'meta-flow-1', name: 'Rahul' }),
      },
    });

    expect(result.handled).toBe(true);
    expect(inbound).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        conversationId: 'conv-1',
        contactId: 'contact-1',
        whatsappNumberId: 'wa-1',
        messageType: 'interactive',
        waFlowResponse: expect.objectContaining({ flow_id: 'meta-flow-1', name: 'Rahul' }),
      }),
    );
  });
});

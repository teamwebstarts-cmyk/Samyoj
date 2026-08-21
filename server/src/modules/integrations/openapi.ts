import { Router, Request, Response } from 'express';
import { config } from '../../config';

const router = Router();

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'WhatsApp Platform Integrations API',
    version: '1.0.0',
    description:
      'Public integration endpoints for sending messages, managing webhooks, and connecting automation tools.',
  },
  servers: [{ url: `${config.serverUrl}/api` }],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
      },
      BearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
    },
    schemas: {
      InboundMessage: {
        type: 'object',
        required: ['phone', 'content'],
        properties: {
          phone: { type: 'string', example: '+919876543210' },
          name: { type: 'string' },
          content: { type: 'string' },
          type: { type: 'string', enum: ['TEXT', 'TEMPLATE'], default: 'TEXT' },
          templateName: { type: 'string' },
          templateLanguage: { type: 'string', example: 'en_US' },
          externalId: { type: 'string' },
        },
      },
      SendMessageResponse: {
        type: 'object',
        properties: {
          messageId: { type: 'string' },
          conversationId: { type: 'string' },
          contactId: { type: 'string' },
          status: { type: 'string' },
        },
      },
      WebhookEndpoint: {
        type: 'object',
        properties: {
          url: { type: 'string', format: 'uri' },
          events: {
            type: 'array',
            items: {
              type: 'string',
              enum: [
                'message.received',
                'message.sent',
                'conversation.assigned',
                'conversation.closed',
              ],
            },
          },
        },
      },
    },
  },
  paths: {
    '/integrations/inbound': {
      post: {
        summary: 'Send an outbound message from an external system',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/InboundMessage' } },
          },
        },
        responses: {
          '202': {
            description: 'Message accepted for delivery',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/SendMessageResponse' } },
            },
          },
        },
      },
    },
    '/messages/send': {
      post: {
        summary: 'Send a WhatsApp message (JWT or API key)',
        security: [{ ApiKeyAuth: [] }, { BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/InboundMessage' } },
          },
        },
        responses: {
          '201': { description: 'Message sent' },
        },
      },
    },
    '/integrations/webhooks': {
      get: {
        summary: 'List outbound webhook endpoints',
        security: [{ BearerAuth: [] }],
        responses: { '200': { description: 'Webhook list' } },
      },
      post: {
        summary: 'Create an outbound webhook endpoint',
        security: [{ BearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/WebhookEndpoint' } },
          },
        },
        responses: { '201': { description: 'Webhook created' } },
      },
    },
    '/v1/messages': {
      post: {
        summary: 'Enterprise public API — send message',
        security: [{ ApiKeyAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/InboundMessage' } },
          },
        },
        responses: { '201': { description: 'Message sent' } },
      },
    },
    '/integrations/zapier/triggers': {
      get: {
        summary: 'List Zapier-compatible triggers',
        security: [{ ApiKeyAuth: [] }],
        responses: { '200': { description: 'Trigger definitions' } },
      },
    },
  },
};

router.get('/openapi.json', (_req: Request, res: Response) => {
  res.json(spec);
});

export default router;

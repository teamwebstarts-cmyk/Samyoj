import { describe, expect, it } from 'vitest';
import { computeActivationStage, computeIndependentFlags, worstQualityRating } from './stage';
import { activationStage, healthFlags } from './snapshots';

describe('platform activation stage', () => {
  it('encodes the primary funnel from existing table counts', () => {
    expect(
      computeActivationStage({
        lastLoginAt: null,
        activeNumberCount: 0,
        contactCount: 0,
        outboundMessageCount: 0,
        inboundMessageCount: 0,
      })
    ).toBe('REGISTERED');
    expect(
      computeActivationStage({
        lastLoginAt: new Date(),
        activeNumberCount: 0,
        contactCount: 10,
        outboundMessageCount: 4,
        inboundMessageCount: 2,
      })
    ).toBe('NOT_CONNECTED');
    expect(
      computeActivationStage({
        lastLoginAt: new Date(),
        activeNumberCount: 1,
        contactCount: 0,
        outboundMessageCount: 0,
        inboundMessageCount: 0,
      })
    ).toBe('CONNECTED_EMPTY');
    expect(
      computeActivationStage({
        lastLoginAt: new Date(),
        activeNumberCount: 1,
        contactCount: 3,
        outboundMessageCount: 0,
        inboundMessageCount: 0,
      })
    ).toBe('CONTACTS_READY');
    expect(
      computeActivationStage({
        lastLoginAt: new Date(),
        activeNumberCount: 1,
        contactCount: 3,
        outboundMessageCount: 8,
        inboundMessageCount: 0,
      })
    ).toBe('OUTBOUND_ONLY');
    expect(
      computeActivationStage({
        lastLoginAt: new Date(),
        activeNumberCount: 1,
        contactCount: 3,
        outboundMessageCount: 8,
        inboundMessageCount: 2,
      })
    ).toBe('LIVE');
  });

  it('matches the snapshot helper', () => {
    expect(
      activationStage({
        activeNumberCount: 1,
        contactCount: 0,
        outboundMessageCount: 0,
        inboundMessageCount: 0,
        lastLoginAt: new Date(),
      })
    ).toBe('CONNECTED_EMPTY');
  });
});

describe('independent health flags', () => {
  it('does not fold AI, billing, quality, or webhook into the primary stage', () => {
    const flags = computeIndependentFlags({
      stage: 'LIVE',
      lastAiUsageAt: null,
      planExpiresAt: new Date('2020-01-01T00:00:00.000Z'),
      subscriptionStatus: 'active',
      lastPaymentStatus: 'FAILED',
      qualityRating: 'RED',
      lastInboundAt: new Date('2020-01-01T00:00:00.000Z'),
      outboundMessageCount: 4,
      now: new Date('2026-08-17T00:00:00.000Z'),
    });
    expect(flags).toEqual({
      aiInactive: true,
      billingRisk: true,
      qualityRisk: true,
      webhookStale: true,
    });
    expect(worstQualityRating(['GREEN', 'YELLOW'])).toBe('YELLOW');
  });

  it('does not treat complimentary access as billing risk', () => {
    const flags = healthFlags({
      stage: 'LIVE',
      lastAiUsageAt: new Date(),
      subscriptionStatus: 'complimentary',
      planExpiresAt: new Date('2020-01-01T00:00:00.000Z'),
      failedPaymentCount: 1,
      qualityRatings: ['GREEN'],
      lastInboundAt: new Date(),
      outboundMessageCount: 2,
    });
    expect(flags.billingRisk).toBe(false);
    expect(flags.qualityRisk).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  flowAudienceLabel,
  flowAudienceState,
  flowSaveSuccessMessage,
  flowToggleSuccessMessage,
  isFlowLive,
  isUnpublishedFlow,
} from './flow-live';

describe('flowAudienceState', () => {
  it('is draft for new and unpublished flows even if the switch is on', () => {
    expect(flowAudienceState({ isNew: true, enabled: true, status: 'PUBLISHED' })).toBe('draft');
    expect(flowAudienceState({ status: 'DRAFT', enabled: true })).toBe('draft');
  });

  it('is live only when published and enabled', () => {
    expect(flowAudienceState({ status: 'PUBLISHED', enabled: true })).toBe('live');
    expect(isFlowLive({ status: 'PUBLISHED', enabled: true })).toBe(true);
  });

  it('is off when published but not enabled', () => {
    expect(flowAudienceState({ status: 'PUBLISHED', enabled: false })).toBe('off');
    expect(isFlowLive({ status: 'PUBLISHED', enabled: false })).toBe(false);
  });

  it('labels match audience state', () => {
    expect(flowAudienceLabel('live')).toBe('Live');
    expect(flowAudienceLabel('draft')).toBe('Draft');
    expect(flowAudienceLabel('off')).toBe('Off');
  });
});

describe('isUnpublishedFlow', () => {
  it('treats missing status as published', () => {
    expect(isUnpublishedFlow({})).toBe(false);
    expect(isUnpublishedFlow({ status: 'DRAFT' })).toBe(true);
    expect(isUnpublishedFlow({ isNew: true })).toBe(true);
  });
});

describe('flow copy', () => {
  it('never says live for a draft save', () => {
    expect(flowSaveSuccessMessage({ asDraft: true, enabled: true, isNew: false })).toBe(
      'Draft saved — not live yet.'
    );
  });

  it('does not say live when published but still off', () => {
    expect(flowSaveSuccessMessage({ asDraft: false, enabled: false, isNew: false })).toContain('Still off');
    expect(flowSaveSuccessMessage({ asDraft: false, enabled: false, isNew: false }).toLowerCase()).not.toContain(
      'live'
    );
  });

  it('says live only when published and on', () => {
    expect(flowSaveSuccessMessage({ asDraft: false, enabled: true, isNew: false })).toContain('Live');
  });

  it('toggle copy matches live vs off', () => {
    expect(flowToggleSuccessMessage(true)).toContain('Live');
    expect(flowToggleSuccessMessage(false)).toContain('will not get this');
  });
});

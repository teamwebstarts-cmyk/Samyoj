import { describe, expect, it } from 'vitest';
import {
  automationScopeFilter,
  findAutomationConflicts,
  mergeProposedForConflicts,
} from './conflicts';

describe('automationScopeFilter', () => {
  it('scopes WhatsApp rows to one number while including org-level Instagram keywords', () => {
    expect(automationScopeFilter('wa-1')).toEqual({
      OR: [
        { whatsappNumberId: 'wa-1' },
        {
          triggerType: 'KEYWORD',
          whatsappNumberId: null,
          config: { path: ['platform'], equals: 'IG' },
        },
        {
          triggerType: 'KEYWORD',
          whatsappNumberId: null,
          config: { path: ['platform'], equals: 'FB' },
        },
      ],
    });
  });

  it('scopes an Instagram-only workspace to Instagram rows only', () => {
    expect(automationScopeFilter()).toEqual({
      OR: [
        {
          triggerType: 'KEYWORD',
          whatsappNumberId: null,
          config: { path: ['platform'], equals: 'IG' },
        },
        {
          triggerType: 'KEYWORD',
          whatsappNumberId: null,
          config: { path: ['platform'], equals: 'FB' },
        },
      ],
    });
  });
});

describe('findAutomationConflicts', () => {
  it('warns when ANY_MESSAGE catch-all coexists with keyword journeys', () => {
    const conflicts = findAutomationConflicts(
      [],
      [
        { name: 'Price FAQ', triggerType: 'KEYWORD', triggerConfig: { keyword: 'price' } },
        { name: 'Fallback', triggerType: 'ANY_MESSAGE', triggerConfig: {} },
      ]
    );
    expect(conflicts.some((c) => c.type === 'any_message_vs_keyword')).toBe(true);
  });

  it('warns that tag triggers can re-enter', () => {
    const conflicts = findAutomationConflicts(
      [],
      [{ name: 'VIP', triggerType: 'CONTACT_TAG', triggerConfig: { tag: 'vip' } }]
    );
    expect(conflicts.some((c) => c.type === 'tag_reentry')).toBe(true);
  });

  it('warns on duplicate flow keywords', () => {
    const conflicts = findAutomationConflicts(
      [],
      [
        { name: 'A', triggerType: 'KEYWORD', triggerConfig: { keyword: 'demo' } },
        { name: 'B', triggerType: 'KEYWORD', triggerConfig: { keyword: 'demo' } },
      ]
    );
    const dup = conflicts.find((c) => c.type === 'duplicate_flow_keyword');
    expect(dup).toBeTruthy();
    expect(dup?.severity).toBe('error');
  });

  it('attaches builder links when ids are present', () => {
    const conflicts = findAutomationConflicts(
      [],
      [
        { id: 'flow-a', name: 'A', triggerType: 'KEYWORD', triggerConfig: { keyword: 'demo' } },
        { id: 'flow-b', name: 'B', triggerType: 'KEYWORD', triggerConfig: { keyword: 'demo' } },
      ]
    );
    const dup = conflicts.find((c) => c.type === 'duplicate_flow_keyword');
    expect(dup?.links).toEqual([
      { label: 'A', href: '/automations/flows/flow-a' },
      { label: 'B', href: '/automations/flows/flow-b' },
    ]);
  });
});

describe('mergeProposedForConflicts', () => {
  it('adds a live proposed welcome against an existing welcome', () => {
    const merged = mergeProposedForConflicts(
      [{ id: 'auto-1', name: 'Hi', triggerType: 'WELCOME', config: {} }],
      [],
      {
        kind: 'automation',
        name: 'Hello again',
        triggerType: 'WELCOME',
        enabled: true,
      }
    );
    const conflicts = findAutomationConflicts(merged.automations, merged.flows);
    const dup = conflicts.find((c) => c.type === 'duplicate_welcome');
    expect(dup?.severity).toBe('error');
  });

  it('replaces the row being edited instead of duplicating it', () => {
    const merged = mergeProposedForConflicts(
      [{ id: 'auto-1', name: 'Hi', triggerType: 'WELCOME', config: {} }],
      [],
      {
        kind: 'automation',
        excludeId: 'auto-1',
        name: 'Hi',
        triggerType: 'WELCOME',
        enabled: true,
      }
    );
    expect(merged.automations).toHaveLength(1);
    const conflicts = findAutomationConflicts(merged.automations, merged.flows);
    expect(conflicts.some((c) => c.type === 'duplicate_welcome')).toBe(false);
  });

  it('ignores draft proposed flows', () => {
    const merged = mergeProposedForConflicts(
      [],
      [{ id: 'flow-1', name: 'Live keyword', triggerType: 'KEYWORD', triggerConfig: { keyword: 'hi' } }],
      {
        kind: 'flow',
        name: 'Catch-all draft',
        triggerType: 'ANY_MESSAGE',
        enabled: true,
        status: 'DRAFT',
      }
    );
    const conflicts = findAutomationConflicts(merged.automations, merged.flows);
    expect(conflicts.some((c) => c.type === 'any_message_vs_keyword')).toBe(false);
  });
});

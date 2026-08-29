import { describe, expect, it } from 'vitest';
import { buildInboxListParams, nextUnreadCount } from './inboxListParams';

describe('buildInboxListParams', () => {
  const base = { page: 1, pageSize: 10, chip: 'all' as const };

  it('always sends page + limit', () => {
    expect(buildInboxListParams(base)).toEqual({ page: '1', limit: '10' });
  });

  it('maps chips to API flags', () => {
    expect(buildInboxListParams({ ...base, chip: 'unread' }).unread).toBe('true');
    expect(buildInboxListParams({ ...base, chip: 'favourites' }).favorite).toBe('true');
    expect(buildInboxListParams({ ...base, chip: 'unreplied' }).unreplied).toBe('true');
    expect(buildInboxListParams({ ...base, chip: 'canReply' }).window).toBe('open');
    expect(buildInboxListParams({ ...base, chip: 'needsTemplate' }).window).toBe('closed');
    expect(buildInboxListParams({ ...base, chip: 'open' }).status).toBe('OPEN');
    expect(buildInboxListParams({ ...base, chip: 'pending' }).status).toBe('PENDING');
    expect(buildInboxListParams({ ...base, chip: 'hasTicket' }).hasOpenTicket).toBe('true');
    expect(buildInboxListParams({ ...base, chip: 'botActive' }).botActive).toBe('true');
  });

  it('maps assignee filters', () => {
    expect(
      buildInboxListParams({ ...base, agentFilter: '__mine__', userId: 'u1' }).assignedTo
    ).toBe('u1');
    expect(buildInboxListParams({ ...base, agentFilter: 'agent-9' }).assignedTo).toBe('agent-9');
  });
});

describe('nextUnreadCount', () => {
  it('bumps zero/null to 1 and keeps existing unread', () => {
    expect(nextUnreadCount(0)).toBe(1);
    expect(nextUnreadCount(null)).toBe(1);
    expect(nextUnreadCount(3)).toBe(3);
  });
});

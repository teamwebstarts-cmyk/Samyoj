import type { Request } from 'express';

export type OverviewPeriodMode = 'preset' | 'custom' | 'overall';

export interface OverviewPeriodWindow {
  since: Date;
  until: Date;
  previousSince: Date;
  previousUntil: Date;
  compareEnabled: boolean;
  dayCount: number;
  period: {
    mode: OverviewPeriodMode;
    days?: number;
    from?: string;
    to?: string;
  };
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_CUSTOM_DAYS = 366;

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function endOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function parseIsoDate(value: string): Date | null {
  const match = ISO_DATE.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return parsed;
}

function diffCalendarDays(from: Date, to: Date) {
  const start = startOfDay(from).getTime();
  const end = startOfDay(to).getTime();
  return Math.floor((end - start) / (24 * 60 * 60 * 1000)) + 1;
}

function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function toIsoDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function resolveOverviewPeriod(query: Request['query']): OverviewPeriodWindow {
  const overall = query.overall === '1' || query.overall === 'true';
  const fromRaw = typeof query.from === 'string' ? query.from : '';
  const toRaw = typeof query.to === 'string' ? query.to : '';

  if (fromRaw && toRaw) {
    const fromDate = parseIsoDate(fromRaw);
    const toDate = parseIsoDate(toRaw);
    const todayEnd = endOfDay(new Date());

    if (!fromDate || !toDate) {
      throw new Error('Invalid date range');
    }

    const since = startOfDay(fromDate);
    const until = endOfDay(toDate > todayEnd ? todayEnd : toDate);

    if (since.getTime() > until.getTime()) {
      throw new Error('Invalid date range');
    }

    const dayCount = diffCalendarDays(since, until);
    if (dayCount > MAX_CUSTOM_DAYS) {
      throw new Error(`Date range cannot exceed ${MAX_CUSTOM_DAYS} days`);
    }

    const previousUntil = endOfDay(addDays(since, -1));
    const previousSince = startOfDay(addDays(previousUntil, -(dayCount - 1)));

    return {
      since,
      until,
      previousSince,
      previousUntil,
      compareEnabled: true,
      dayCount,
      period: {
        mode: 'custom',
        from: toIsoDate(since),
        to: toIsoDate(until),
      },
    };
  }

  if (overall) {
    const since = startOfDay(new Date(2020, 0, 1));
    const until = endOfDay(new Date());
    return {
      since,
      until,
      previousSince: since,
      previousUntil: since,
      compareEnabled: false,
      dayCount: diffCalendarDays(since, until),
      period: { mode: 'overall' },
    };
  }

  const rawDays = parseInt((query.days as string) || '7', 10);
  const days = [7, 14, 30].includes(rawDays) ? rawDays : 7;
  const since = daysAgo(days);
  const until = new Date();
  const previousSince = daysAgo(days * 2);
  const previousUntil = since;

  return {
    since,
    until,
    previousSince,
    previousUntil,
    compareEnabled: true,
    dayCount: days,
    period: { mode: 'preset', days },
  };
}

export function buildDailySeriesBuckets(window: OverviewPeriodWindow) {
  const buckets: Array<{ dayStart: Date; dayEnd: Date; dateLabel: string }> = [];
  const maxBuckets = Math.min(window.dayCount, MAX_CUSTOM_DAYS);

  if (window.period.mode === 'preset') {
    const now = new Date();
    for (let i = window.dayCount - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStart = startOfDay(d);
      const dayEnd = endOfDay(d);
      buckets.push({
        dayStart,
        dayEnd,
        dateLabel: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      });
    }
    return buckets;
  }

  let cursor = startOfDay(window.since);
  const lastDay = startOfDay(window.until);
  while (cursor.getTime() <= lastDay.getTime() && buckets.length < maxBuckets) {
    const dayStart = startOfDay(cursor);
    const dayEnd = endOfDay(cursor);
    buckets.push({
      dayStart,
      dayEnd,
      dateLabel: cursor.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    });
    cursor = addDays(cursor, 1);
  }

  return buckets;
}

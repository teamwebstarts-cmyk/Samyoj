/** Offset of `timeZone` at `date`, as wall-clock-as-UTC minus the instant. */
export function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = dtf.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  const asUTC = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour) % 24,
    Number(map.minute),
    Number(map.second)
  );
  return asUTC - date.getTime();
}

/**
 * Add N calendar days keeping the campaign's wall-clock time of day, store UTC.
 * Falls back to 24h multiples if the IANA timezone is invalid.
 */
export function addCalendarDaysInTimeZone(instant: Date, days: number, timeZone?: string | null): Date {
  const tz = timeZone?.trim() || 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format();
  } catch {
    return new Date(instant.getTime() + days * 24 * 60 * 60 * 1000);
  }
  const offsetBefore = getTimeZoneOffsetMs(instant, tz);
  const wall = new Date(instant.getTime() + offsetBefore);
  wall.setUTCDate(wall.getUTCDate() + days);
  const guess = new Date(wall.getTime() - offsetBefore);
  const offsetAfter = getTimeZoneOffsetMs(guess, tz);
  return new Date(wall.getTime() - offsetAfter);
}

export type RepeatPolicy = {
  repeatIntervalDays?: number | null;
  repeatUntil?: Date | null;
  repeatMaxOccurrences?: number | null;
  repeatOccurrenceCount: number;
};

export function nextRepeatInstant(input: {
  lastScheduledAt?: Date | null;
  completedAt?: Date;
  intervalDays: number;
  timeZone?: string | null;
}): Date {
  const base = input.lastScheduledAt || input.completedAt || new Date();
  return addCalendarDaysInTimeZone(base, input.intervalDays, input.timeZone);
}

export function shouldScheduleRepeat(input: RepeatPolicy & { nextAt: Date }): boolean {
  if (!input.repeatIntervalDays || input.repeatIntervalDays < 1) return false;
  if (input.repeatMaxOccurrences != null && input.repeatOccurrenceCount >= input.repeatMaxOccurrences) {
    return false;
  }
  if (input.repeatUntil && input.nextAt.getTime() > input.repeatUntil.getTime()) return false;
  return true;
}

// Days in the student's calendar. A port of LearnDay (LearnProgress.swift) and of the Foundation `Calendar` calls the
// learning logic makes, with a time zone and a first weekday instead of a Calendar object. Time is always an epoch
// in milliseconds that the caller passes in; nothing here reads the clock.

/** A calendar for the learning logic: an IANA time zone and Foundation's `firstWeekday` (1 = Sunday, 2 = Monday). */
export interface LearnCalendar {
  timeZone: string;
  firstWeekday: number;
}

export function learnCalendar(timeZone: string, firstWeekday = 2): LearnCalendar {
  return { timeZone, firstWeekday };
}

/** A day as year, month and day in the student's calendar, so a saved day keeps its meaning across daylight saving
 * time and time zones. */
export interface LearnDay {
  year: number;
  month: number;
  day: number;
}

export function learnDay(year: number, month: number, day: number): LearnDay {
  return { year, month, day };
}

export function sameDay(a: LearnDay | null | undefined, b: LearnDay | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/** Stable text for sets and sorting: "2026-10-9". */
export function dayKey(d: LearnDay): string {
  return `${d.year}-${d.month}-${d.day}`;
}

export function compareDays(a: LearnDay, b: LearnDay): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

// Civil calendar arithmetic (proleptic Gregorian), independent of any zone.

/** Days since 1970-01-01 of a civil date. */
export function civilDays(year: number, month: number, day: number): number {
  // Months outside 1...12 roll over like Foundation's lenient date(from:).
  const m0 = month - 1;
  const y = year + Math.floor(m0 / 12);
  const m = ((m0 % 12) + 12) % 12 + 1;
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400);
  const yoe = yy - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5);
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468 + (day - 1);
}

/** The civil date of a day count since 1970-01-01. */
export function civilFromDays(days: number): LearnDay {
  const z = days + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  return { year: month <= 2 ? y + 1 : y, month, day };
}

// Zone handling through Intl.

interface Fields {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone,
      calendar: 'gregory',
      numberingSystem: 'latn',
      hourCycle: 'h23',
      era: 'short',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** The wall clock of an instant in the zone. */
function fieldsAt(ms: number, timeZone: string): Fields {
  const parts = formatter(timeZone).formatToParts(new Date(ms));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  let year = get('year');
  const era = parts.find((p) => p.type === 'era')?.value ?? 'AD';
  if (era.startsWith('B')) year = 1 - year;
  return { year, month: get('month'), day: get('day'), hour: get('hour') % 24, minute: get('minute'), second: get('second') };
}

function fieldsAsUtcMs(f: Fields): number {
  return civilDays(f.year, f.month, f.day) * 86_400_000 + f.hour * 3_600_000 + f.minute * 60_000 + f.second * 1000;
}

/** Offset of the zone from UTC at an instant, in milliseconds. */
export function utcOffsetMs(ms: number, timeZone: string): number {
  const whole = Math.floor(ms / 1000) * 1000;
  return fieldsAsUtcMs(fieldsAt(whole, timeZone)) - whole;
}

/** The instant of a wall-clock time in the zone. A time that does not exist (the hour skipped when the clocks go
 * forward) moves ahead by the gap; a time that happens twice takes the first. */
export function localToMs(
  calendar: LearnCalendar,
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): number {
  const local = (civilDays(year, month, day) * 24 + hour) * 3_600_000 + minute * 60_000 + second * 1000;
  const before = local - utcOffsetMs(local - 86_400_000, calendar.timeZone);
  const after = local - utcOffsetMs(local + 86_400_000, calendar.timeZone);
  const valid = (instant: number) => fieldsAsUtcMs(fieldsAt(instant, calendar.timeZone)) === local;
  const candidates = [before, after].filter(valid);
  if (candidates.length > 0) return Math.min(...candidates);
  return Math.max(before, after);
}

/** The day an instant falls on in the calendar. */
export function dayOf(nowMs: number, calendar: LearnCalendar): LearnDay {
  const f = fieldsAt(nowMs, calendar.timeZone);
  return { year: f.year, month: f.month, day: f.day };
}

/** Whole days from one day to another; counted from noon to noon, so a day of 23 or 25 hours is one day. */
export function daysTo(from: LearnDay, to: LearnDay, _calendar?: LearnCalendar): number {
  return civilDays(to.year, to.month, to.day) - civilDays(from.year, from.month, from.day);
}

/** The day `count` days after (or before) a day. */
export function adding(day: LearnDay, count: number, _calendar?: LearnCalendar): LearnDay {
  return civilFromDays(civilDays(day.year, day.month, day.day) + count);
}

/** Weekday of a day, as Foundation numbers them: 1 = Sunday ... 7 = Saturday. */
export function weekdayOf(day: LearnDay): number {
  // 1970-01-01 was a Thursday (5).
  const days = civilDays(day.year, day.month, day.day);
  return ((((days + 4) % 7) + 7) % 7) + 1;
}

/** The first day of the week an instant falls in (`dateInterval(of: .weekOfYear)` honoring `firstWeekday`). */
export function weekStart(nowMs: number, calendar: LearnCalendar): LearnDay {
  const today = dayOf(nowMs, calendar);
  const offset = (((weekdayOf(today) - calendar.firstWeekday) % 7) + 7) % 7;
  return adding(today, -offset);
}

/** The first instant of a day (midnight, or the first moment after it if midnight is skipped). */
export function startOfDayMs(day: LearnDay, calendar: LearnCalendar): number {
  return localToMs(calendar, day.year, day.month, day.day, 0, 0, 0);
}

/** Seconds until the next local midnight, for the timer on the quest tile. */
export function secondsUntilNextDay(nowMs: number, calendar: LearnCalendar): number {
  const next = startOfDayMs(adding(dayOf(nowMs, calendar), 1), calendar);
  return Math.max(0, (next - nowMs) / 1000);
}

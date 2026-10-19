/** A day as year, month and day in the student's calendar, so a saved day keeps its meaning across daylight saving time and time zones. */
export interface LearnDay {
  year: number;
  month: number;
  day: number;
}

/** The calendar the Lernen tab works in: it turns a moment into a day and back. Injected, so tests can use any zone. */
export interface Calendar {
  parts(ms: number): LearnDay;
  /** The moment of a wall-clock time in this calendar; days past the end of a month roll over. */
  at(year: number, month: number, day: number, hour?: number, minute?: number): number;
}

export const localCalendar: Calendar = {
  parts(ms) {
    const date = new Date(ms);
    return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() };
  },
  at(year, month, day, hour = 0, minute = 0) {
    return new Date(year, month - 1, day, hour, minute).getTime();
  },
};

/** A calendar in a named time zone, for tests (midnight, daylight saving time, other zones). */
export function zoneCalendar(timeZone: string): Calendar {
  const format = new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric' });
  const wall = (ms: number) => {
    const values: Record<string, number> = {};
    for (const part of format.formatToParts(new Date(ms))) if (part.type !== 'literal') values[part.type] = Number(part.value);
    return values;
  };
  const offset = (ms: number) => {
    const w = wall(ms);
    return Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second) - Math.floor(ms / 1000) * 1000;
  };
  return {
    parts(ms) {
      const w = wall(ms);
      return { year: w.year, month: w.month, day: w.day };
    },
    at(year, month, day, hour = 0, minute = 0) {
      const guess = Date.UTC(year, month - 1, day, hour, minute);
      let result = guess - offset(guess);
      result = guess - offset(result);
      return result;
    },
  };
}

const NOON = 12;
const DAY_MS = 86_400_000;

export const dayOf = (ms: number, calendar: Calendar): LearnDay => calendar.parts(ms);

export const sameDay = (a: LearnDay | null | undefined, b: LearnDay | null | undefined): boolean =>
  !!a && !!b && a.year === b.year && a.month === b.month && a.day === b.day;

/** Whole days from one day to another; counted from noon to noon, so a day of 23 or 25 hours is one day. */
export function daysBetween(from: LearnDay, to: LearnDay, calendar: Calendar): number {
  const a = calendar.at(from.year, from.month, from.day, NOON);
  const b = calendar.at(to.year, to.month, to.day, NOON);
  return Math.round((b - a) / DAY_MS);
}

export function addDays(day: LearnDay, count: number, calendar: Calendar): LearnDay {
  return calendar.parts(calendar.at(day.year, day.month, day.day + count, NOON));
}

export const isDay = (value: unknown): value is LearnDay =>
  typeof value === 'object' && value !== null && Number.isInteger((value as LearnDay).year) && Number.isInteger((value as LearnDay).month) && Number.isInteger((value as LearnDay).day);

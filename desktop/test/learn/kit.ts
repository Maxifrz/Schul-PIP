// Helpers shared by the learn tests: calendars and dates the way the Swift tests build them.
import { type LearnCalendar, learnCalendar, localToMs } from '../../src/lib/learn/day';

export function calendar(zone = 'Europe/Berlin', firstWeekday = 1): LearnCalendar {
  return learnCalendar(zone, firstWeekday);
}

/** Epoch milliseconds of a wall-clock time in a zone (Swift: `calendar.date(from: DateComponents(...))`). */
export function at(cal: LearnCalendar, year: number, month: number, day: number, hour = 12, minute = 0): number {
  return localToMs(cal, year, month, day, hour, minute, 0);
}

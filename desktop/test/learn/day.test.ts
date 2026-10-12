import { describe, expect, it } from 'vitest';
import {
  adding,
  civilDays,
  civilFromDays,
  dayOf,
  daysTo,
  learnCalendar,
  localToMs,
  secondsUntilNextDay,
  utcOffsetMs,
  weekStart,
  weekdayOf,
} from '../../src/lib/learn/day';
import { at, calendar } from './kit';

describe('LearnDay and the calendar', () => {
  const berlin = calendar('Europe/Berlin');
  const utc = calendar('UTC');
  const auckland = calendar('Pacific/Auckland');

  it('dayOf follows the zone, not UTC', () => {
    const late = at(utc, 2026, 10, 9, 10);
    const early = at(utc, 2026, 10, 9, 12);
    expect(dayOf(late, auckland)).toEqual({ year: 2026, month: 10, day: 9 });
    expect(dayOf(early, auckland)).toEqual({ year: 2026, month: 10, day: 10 });
    expect(dayOf(late, utc)).toEqual({ year: 2026, month: 10, day: 9 });
  });

  it('counts days from noon to noon, also across daylight saving time and year ends', () => {
    expect(daysTo({ year: 2026, month: 12, day: 31 }, { year: 2027, month: 1, day: 1 }, utc)).toBe(1);
    expect(daysTo({ year: 2026, month: 3, day: 28 }, { year: 2026, month: 3, day: 30 }, berlin)).toBe(2);
    expect(daysTo({ year: 2026, month: 10, day: 24 }, { year: 2026, month: 10, day: 26 }, berlin)).toBe(2);
    expect(daysTo({ year: 2026, month: 10, day: 9 }, { year: 2026, month: 10, day: 8 }, berlin)).toBe(-1);
    expect(daysTo({ year: 2024, month: 2, day: 28 }, { year: 2024, month: 3, day: 1 }, berlin)).toBe(2);
  });

  it('adds days with month and year rollover', () => {
    expect(adding({ year: 2026, month: 12, day: 30 }, 3, utc)).toEqual({ year: 2027, month: 1, day: 2 });
    expect(adding({ year: 2026, month: 3, day: 1 }, -1, utc)).toEqual({ year: 2026, month: 2, day: 28 });
    expect(adding({ year: 2028, month: 2, day: 28 }, 1, utc)).toEqual({ year: 2028, month: 2, day: 29 });
  });

  it('civil day arithmetic round-trips', () => {
    for (let d = -800000; d < 800000; d += 997) {
      const c = civilFromDays(d);
      expect(civilDays(c.year, c.month, c.day)).toBe(d);
    }
    expect(civilDays(1970, 1, 1)).toBe(0);
  });

  it('knows the weekday as Foundation numbers it (1 = Sunday)', () => {
    expect(weekdayOf({ year: 2026, month: 10, day: 12 })).toBe(2); // a Monday
    expect(weekdayOf({ year: 2026, month: 10, day: 11 })).toBe(1);
    expect(weekdayOf({ year: 1970, month: 1, day: 1 })).toBe(5);
  });

  it('weekStart honors firstWeekday', () => {
    const monday = calendar('Europe/Berlin', 2);
    const sunday = calendar('Europe/Berlin', 1);
    // Wednesday 7 October 2026.
    expect(weekStart(at(berlin, 2026, 10, 7), monday)).toEqual({ year: 2026, month: 10, day: 5 });
    expect(weekStart(at(berlin, 2026, 10, 7), sunday)).toEqual({ year: 2026, month: 10, day: 4 });
    // A Sunday is the last day of a Monday week and the first of a Sunday week.
    expect(weekStart(at(berlin, 2026, 10, 11), monday)).toEqual({ year: 2026, month: 10, day: 5 });
    expect(weekStart(at(berlin, 2026, 10, 11), sunday)).toEqual({ year: 2026, month: 10, day: 11 });
    expect(weekStart(at(berlin, 2026, 10, 12, 0, 1), monday)).toEqual({ year: 2026, month: 10, day: 12 });
    // Across a year end.
    expect(weekStart(at(berlin, 2027, 1, 1), monday)).toEqual({ year: 2026, month: 12, day: 28 });
  });

  it('localToMs and offsets', () => {
    expect(utcOffsetMs(at(berlin, 2026, 7, 1), 'Europe/Berlin')).toBe(2 * 3600_000);
    expect(utcOffsetMs(at(berlin, 2026, 1, 1), 'Europe/Berlin')).toBe(3600_000);
    expect(at(utc, 1970, 1, 2, 0, 0)).toBe(86_400_000);
    // 29 March 2026: 02:30 does not exist in Berlin; it moves ahead to 03:30.
    expect(localToMs(berlin, 2026, 3, 29, 2, 30)).toBe(localToMs(berlin, 2026, 3, 29, 3, 30));
    // 25 October 2026: 02:30 happens twice; the first one is meant.
    expect(localToMs(berlin, 2026, 10, 25, 2, 30)).toBe(Date.UTC(2026, 9, 25, 0, 30));
  });

  it('seconds until midnight across daylight saving time', () => {
    expect(secondsUntilNextDay(at(berlin, 2026, 10, 10, 23), berlin)).toBeCloseTo(3600, 0);
    expect(secondsUntilNextDay(at(berlin, 2026, 10, 25, 0), berlin)).toBeCloseTo(25 * 3600, 0);
    expect(secondsUntilNextDay(at(berlin, 2026, 3, 29, 0), berlin)).toBeCloseTo(23 * 3600, 0);
    expect(secondsUntilNextDay(at(berlin, 2026, 10, 10, 23, 59) + 59_500, berlin)).toBeCloseTo(0.5, 2);
  });

  it('copes with a zone whose midnight is skipped (São Paulo 2018)', () => {
    const sp = learnCalendar('America/Sao_Paulo', 1);
    // On 4 November 2018 the clocks went from 00:00 to 01:00.
    const start = localToMs(sp, 2018, 11, 4, 0, 0);
    expect(dayOf(start, sp)).toEqual({ year: 2018, month: 11, day: 4 });
    expect(dayOf(start - 1000, sp)).toEqual({ year: 2018, month: 11, day: 3 });
    // Foundation adds one day to the start of the day (01:00 here), so the timer shows 24 hours, as the Swift app does.
    expect(secondsUntilNextDay(start, sp)).toBeCloseTo(24 * 3600, 0);
  });
});

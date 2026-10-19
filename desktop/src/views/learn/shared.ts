import type { Course } from '../../lib/learn/course';
import { prefersDarkText } from '../../lib/learn/course';

/** The course's color as CSS, from its 0xRRGGBB. */
export const tint = (course: Course): string => `#${course.color.toString(16).padStart(6, '0')}`;

/** Text and symbols on the course's color. */
export const onTint = (course: Course): string => (prefersDarkText(course) ? '#16150f' : '#faf9f6');

export const randomSeed = (): bigint => BigInt(Math.floor(Math.random() * 2 ** 52) + 1);

export const newSessionID = (): string => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `s${Date.now()}${Math.random()}`);

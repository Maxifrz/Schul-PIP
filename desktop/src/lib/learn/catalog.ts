// The registry of course providers. A port of `CourseCatalog` (CoursePath.swift) without the hard-coded list: each
// course module calls `registerProvider` once, so the logic core knows no course.

import type { Course, CourseProvider } from './course';

const registry: CourseProvider[] = [];

/** Adds a provider; one with the same course id is replaced. */
export function registerProvider(provider: CourseProvider): void {
  const index = registry.findIndex((p) => p.course.id === provider.course.id);
  if (index >= 0) registry[index] = provider;
  else registry.push(provider);
}

/** For tests: forgets every registered provider. */
export function clearProviders(): void {
  registry.length = 0;
}

export function providers(): CourseProvider[] {
  return registry.slice();
}

export function courses(): Course[] {
  return registry.map((p) => p.course);
}

export function provider(forCourse: string): CourseProvider | undefined {
  return registry.find((p) => p.course.id === forCourse);
}

/** The provider whose course id is the node id's prefix up to a dot. */
export function providerForNode(nodeID: string): CourseProvider | undefined {
  return registry.find((p) => nodeID.startsWith(p.course.id + '.'));
}

export const CourseCatalog = { registerProvider, clearProviders, providers, courses, provider, providerForNode };

/** Same as `provider`, named like `providerForNode`. */
export const providerForCourse = provider;

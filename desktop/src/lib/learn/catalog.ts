import type { CourseProvider } from './course';

/** The courses the app ships with; each engine registers its provider here once it exists. */
export const providers: CourseProvider[] = [];

export const registerCourse = (provider: CourseProvider): void => {
  if (!providers.some((p) => p.course.id === provider.course.id)) providers.push(provider);
};

export const courses = () => providers.map((p) => p.course);

export const providerFor = (courseID: string): CourseProvider | undefined => providers.find((p) => p.course.id === courseID);

export const providerForNode = (nodeID: string): CourseProvider | undefined => providers.find((p) => nodeID.startsWith(`${p.course.id}.`));

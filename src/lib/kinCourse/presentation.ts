import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { kinCourseContentsHref } from "./hrefs";
import { courseHeading, firstLesson, visibleSections } from "./player";
import type { KinCourseDocument, KinCourseLanding, KinCoursePresentation } from "./types";

const KIN_COURSE_DATA_DIR = join(process.cwd(), "src", "data", "kin_courses");

function readOptionalJson<T>(courseId: number, filename: string): T | null {
  const path = join(KIN_COURSE_DATA_DIR, String(courseId), filename);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return null;
  }
}

export function readKinCoursePresentation(courseId: number): KinCoursePresentation {
  return readOptionalJson<KinCoursePresentation>(courseId, "presentation.json") ?? {};
}

export function readKinCourseLandingOverride(courseId: number): Partial<KinCourseLanding> | null {
  return readOptionalJson<Partial<KinCourseLanding>>(courseId, "landing.json");
}

export function buildKinCourseLanding(course: KinCourseDocument): KinCourseLanding {
  const override = readKinCourseLandingOverride(course.id);
  const heading = courseHeading(course);
  const start = firstLesson(course);
  const topics =
    override?.topics?.length
      ? override.topics
      : visibleSections(course).map((section) => section.title);
  const imageSrc =
    override?.image?.src ||
    course.thumbnail ||
    "/images/courses/mastering-silver-reed-sk840.png";
  const imageAlt = override?.image?.alt || course.title;

  return {
    courseId: course.id,
    title: override?.title || heading.title,
    subtitle: override?.subtitle ?? heading.subtitle,
    fullTitle: override?.fullTitle || course.title,
    image: { src: imageSrc, alt: imageAlt },
    descriptionHtml: override?.descriptionHtml ?? (course.description ? `<p>${course.description}</p>` : null),
    topics,
    included: override?.included?.map((item) => ({ label: item.label })) ?? [
      { label: "Video tutorials" },
      { label: "Printable reference material" },
      { label: "Exercises" },
    ],
    firstLessonId: override?.firstLessonId ?? start?.id ?? null,
    catalogSlug: override?.catalogSlug || course.catalogSlug,
  };
}

export function buildKinCourseCompletion(
  course: KinCourseDocument,
  presentation: KinCoursePresentation,
  preview: boolean,
): {
  courseTitle: string;
  heading: string;
  lead: string;
  paragraphs: string[];
  contentsHref: string;
  returnHref: string;
} {
  const { title } = courseHeading(course);
  return {
    courseTitle: title,
    heading: presentation.completion?.heading || "You did it!",
    lead:
      presentation.completion?.lead ||
      `Congratulations! You've completed ${course.title}.`,
    paragraphs: presentation.completion?.paragraphs ?? [],
    contentsHref: kinCourseContentsHref(course.id, preview),
    returnHref: "/courses/",
  };
}

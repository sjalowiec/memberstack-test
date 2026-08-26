import type { CourseLesson, CoursePreviewData } from "./coursePreviewPoc";
import {
  readCourseContentFile,
  validateLessonInput,
  writeCourseContentFile,
  type CourseContentWriteOptions,
} from "./courseContentAdmin";

export type LessonStructureResult = {
  backupPath: string;
  persistedVia: "filesystem" | "github";
  branch?: string;
  commitSha?: string;
  course: CoursePreviewData;
  lesson?: CourseLesson;
  lessonSlug?: string;
};

export function sortedCourseLessons(data: CoursePreviewData): CourseLesson[] {
  return [...data.lessons].sort((a, b) => a.displayOrder - b.displayOrder);
}

export function renumberLessonOrders(lessons: CourseLesson[]): CourseLesson[] {
  return lessons.map((lesson, index) => {
    const order = index + 1;
    return {
      ...lesson,
      displayOrder: order,
      legacy: {
        ...lesson.legacy,
        lessonOrder: order,
      },
    };
  });
}

export function validateLessonList(lessons: CourseLesson[]): string | null {
  if (lessons.length === 0) {
    return "Course must contain at least one lesson.";
  }

  const slugs = new Set<string>();
  for (const lesson of lessons) {
    const validated = validateLessonInput(lesson);
    if ("error" in validated) return validated.error;
    if (slugs.has(lesson.slug)) {
      return `Duplicate lesson slug: ${lesson.slug}`;
    }
    slugs.add(lesson.slug);
  }

  return null;
}

export function nextLessonItemId(lessons: CourseLesson[]): number {
  let max = 0;
  for (const lesson of lessons) {
    const id = Number(lesson.legacy?.itemId ?? 0);
    if (Number.isFinite(id) && id > max) max = id;
  }
  return max + 1;
}

export function createNewLesson(lessons: CourseLesson[]): CourseLesson {
  const sorted = sortedCourseLessons({ lessons } as CoursePreviewData);
  const order = sorted.length + 1;
  const timestamp = Date.now();

  return {
    title: "New Lesson",
    slug: `lesson-${timestamp}`,
    displayOrder: order,
    legacy: {
      itemId: nextLessonItemId(sorted),
      lessonOrder: order,
    },
    blocks: [],
  };
}

function maxLegacyComponentId(lessons: CourseLesson[]): number {
  let max = 0;
  for (const lesson of lessons) {
    for (const block of lesson.blocks) {
      for (const component of block.components) {
        const id = Number(component.legacyComponentId);
        if (Number.isFinite(id) && id > max) max = id;
      }
    }
  }
  return max;
}

function maxAssignId(lessons: CourseLesson[]): number {
  let max = 0;
  for (const lesson of lessons) {
    for (const block of lesson.blocks) {
      const id = Number(block.legacy?.assignId ?? 0);
      if (Number.isFinite(id) && id > max) max = id;
    }
  }
  return max;
}

function reassignCloneIds(lesson: CourseLesson, lessons: CourseLesson[]): CourseLesson {
  let nextComponentId = maxLegacyComponentId(lessons) + 1;
  let nextAssignId = maxAssignId(lessons) + 1;
  const timestamp = Date.now();

  const blocks = lesson.blocks.map((block, blockIndex) => {
    const assignId = nextAssignId++;
    const slugBase = String(block.slug ?? `block-${blockIndex + 1}`).replace(/-copy-\d+$/, "");
    const components = block.components.map((component) => {
      const clone = { ...component, legacyComponentId: nextComponentId++ };
      return clone;
    });
    return {
      ...block,
      slug: `${slugBase}-copy-${timestamp}`,
      legacy: {
        ...block.legacy,
        assignId,
      },
      components,
    };
  });

  return { ...lesson, blocks };
}

async function writeValidatedLessons(
  courseId: number,
  data: CoursePreviewData,
  lessons: CourseLesson[],
  writeOptions: CourseContentWriteOptions = {},
): Promise<{ persist: Awaited<ReturnType<typeof writeCourseContentFile>>; course: CoursePreviewData }> {
  const error = validateLessonList(lessons);
  if (error) throw new Error(error);
  const nextData = { ...data, lessons: renumberLessonOrders(lessons) };
  const persist = await writeCourseContentFile(courseId, nextData, writeOptions);
  return { persist, course: nextData };
}

export async function addLessonToCourse(
  courseId: number,
  writeOptions: CourseContentWriteOptions = {},
): Promise<LessonStructureResult> {
  const data = readCourseContentFile(courseId);
  const sorted = sortedCourseLessons(data);
  const lesson = createNewLesson(sorted);
  const { persist, course } = await writeValidatedLessons(
    courseId,
    data,
    [...sorted, lesson],
    writeOptions,
  );
  const saved = sortedCourseLessons(course).find((item) => item.slug === lesson.slug)!;
  return {
    backupPath: persist.backupPath,
    persistedVia: persist.persistedVia,
    branch: persist.branch,
    commitSha: persist.commitSha,
    course,
    lesson: saved,
    lessonSlug: saved.slug,
  };
}

export async function deleteLessonFromCourse(
  courseId: number,
  lessonSlug: string,
  writeOptions: CourseContentWriteOptions = {},
): Promise<LessonStructureResult> {
  const data = readCourseContentFile(courseId);
  if (data.lessons.length <= 1) {
    throw new Error("Cannot delete the last remaining lesson in a course.");
  }

  const sorted = sortedCourseLessons(data);
  const nextLessons = sorted.filter((lesson) => lesson.slug !== lessonSlug);
  if (nextLessons.length === sorted.length) {
    throw new Error(`Lesson not found: ${lessonSlug}`);
  }

  const { persist, course } = await writeValidatedLessons(
    courseId,
    data,
    nextLessons,
    writeOptions,
  );
  return {
    backupPath: persist.backupPath,
    persistedVia: persist.persistedVia,
    branch: persist.branch,
    commitSha: persist.commitSha,
    course,
  };
}

export async function reorderLessonsInCourse(
  courseId: number,
  lessonSlugs: string[],
  writeOptions: CourseContentWriteOptions = {},
): Promise<LessonStructureResult> {
  const data = readCourseContentFile(courseId);
  const sorted = sortedCourseLessons(data);
  const bySlug = new Map(sorted.map((lesson) => [lesson.slug, lesson]));

  if (lessonSlugs.length !== sorted.length) {
    throw new Error("Reorder request must include every lesson slug.");
  }

  const reordered: CourseLesson[] = [];
  for (const slug of lessonSlugs) {
    const lesson = bySlug.get(slug);
    if (!lesson) throw new Error(`Unknown lesson slug: ${slug}`);
    reordered.push(lesson);
  }

  const { persist, course } = await writeValidatedLessons(
    courseId,
    data,
    reordered,
    writeOptions,
  );
  return {
    backupPath: persist.backupPath,
    persistedVia: persist.persistedVia,
    branch: persist.branch,
    commitSha: persist.commitSha,
    course,
  };
}

export async function moveLessonInCourse(
  courseId: number,
  fromIndex: number,
  toIndex: number,
  writeOptions: CourseContentWriteOptions = {},
): Promise<LessonStructureResult> {
  const data = readCourseContentFile(courseId);
  const sorted = sortedCourseLessons(data);
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= sorted.length || toIndex >= sorted.length) {
    throw new Error("Invalid lesson move.");
  }

  const next = [...sorted];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved!);
  const { persist, course } = await writeValidatedLessons(
    courseId,
    data,
    next,
    writeOptions,
  );
  return {
    backupPath: persist.backupPath,
    persistedVia: persist.persistedVia,
    branch: persist.branch,
    commitSha: persist.commitSha,
    course,
  };
}

export async function duplicateLessonInCourse(
  courseId: number,
  lessonSlug: string,
  sourceLesson?: unknown,
  writeOptions: CourseContentWriteOptions = {},
): Promise<LessonStructureResult> {
  const data = readCourseContentFile(courseId);
  const sorted = sortedCourseLessons(data);
  const index = sorted.findIndex((lesson) => lesson.slug === lessonSlug);
  if (index === -1) throw new Error(`Lesson not found: ${lessonSlug}`);

  let source: CourseLesson;
  if (sourceLesson != null) {
    const validated = validateLessonInput(sourceLesson);
    if ("error" in validated) throw new Error(validated.error);
    source = { ...validated, slug: lessonSlug };
  } else {
    source = sorted[index]!;
  }

  const timestamp = Date.now();
  const clone = reassignCloneIds(
    {
      ...JSON.parse(JSON.stringify(source)) as CourseLesson,
      title: `${source.title} (copy)`,
      slug: `${lessonSlug}-copy-${timestamp}`,
      legacy: {
        ...source.legacy,
        itemId: nextLessonItemId(sorted),
      },
    },
    sorted,
  );

  const nextLessons = [...sorted.slice(0, index + 1), clone, ...sorted.slice(index + 1)];
  const { persist, course } = await writeValidatedLessons(
    courseId,
    data,
    nextLessons,
    writeOptions,
  );
  const saved = sortedCourseLessons(course).find((lesson) => lesson.slug === clone.slug)!;
  return {
    backupPath: persist.backupPath,
    persistedVia: persist.persistedVia,
    branch: persist.branch,
    commitSha: persist.commitSha,
    course,
    lesson: saved,
    lessonSlug: saved.slug,
  };
}

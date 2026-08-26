import {
  validateLessonForEditor,
  validationSummary,
  type LessonEditorValidation,
} from "./courseContentEditorSchema";
import {
  getCourseContentPath,
  loadCourseContentDocument,
  writeCourseContentFile,
  type CourseContentWriteOptions,
} from "./courseContentAdmin";
import type { CourseLesson, CoursePreviewData } from "./coursePreviewPoc";
import {
  createIdAllocator,
  maxAssignIdFromLessons,
  maxLegacyComponentIdFromLessons,
} from "./courseContentSplitIds";
import { validateLessonForPublicRenderer, isLessonSplitAllowed } from "./courseLessonPublicRenderer";
import {
  analyzeLessonSplit,
  splitLessonBlocks,
  type SplitBlockResult,
} from "./splitImportedLessonHtml";

export const HAND_CLEANED_COURSE_IDS = new Set([50, 51]);

export type CourseSplitOptions = {
  courseId: number;
  lessonSlug?: string;
  blockSlug?: string;
  dryRun?: boolean;
  force?: boolean;
  allowHandCleaned?: boolean;
  write?: CourseContentWriteOptions;
};

export type LessonSplitReport = {
  lessonSlug: string;
  lessonTitle: string;
  originalBlockCount: number;
  newBlockCount: number;
  detectedTypes: string[];
  warnings: string[];
  changed: boolean;
  skippedReason?: string;
  blockReports: SplitBlockResult[];
  validation?: LessonEditorValidation;
};

export type CourseSplitReport = {
  courseId: number;
  courseSlug: string;
  courseTitle: string;
  dryRun: boolean;
  backupPath?: string;
  persistedVia?: "filesystem" | "blob" | "github";
  commitSha?: string;
  writtenCourse?: CoursePreviewData;
  lessons: LessonSplitReport[];
  validationPassed: boolean;
  validationErrorCount: number;
  validationWarningCount: number;
  totals: {
    lessonsAnalyzed: number;
    lessonsChanged: number;
    blocksBefore: number;
    blocksAfter: number;
  };
};

async function assertCourseAllowed(options: CourseSplitOptions): Promise<CoursePreviewData> {
  if (
    !options.allowHandCleaned &&
    HAND_CLEANED_COURSE_IDS.has(options.courseId) &&
    !options.force
  ) {
    throw new Error(
      `Course ${options.courseId} is hand-cleaned and skipped by default. Use --allow-hand-cleaned or --force to override.`,
    );
  }

  return loadCourseContentDocument(options.courseId, options.write);
}

function filterBlocksInLesson(lesson: CourseLesson, blockSlug?: string): CourseLesson {
  if (!blockSlug) return lesson;
  const blocks = lesson.blocks.filter((block) => block.slug === blockSlug);
  if (blocks.length === 0) {
    throw new Error(`Block not found in lesson ${lesson.slug}: ${blockSlug}`);
  }
  return { ...lesson, blocks };
}

function mergeLessonBlocks(
  original: CourseLesson,
  processed: CourseLesson,
  blockSlug?: string,
): CourseLesson {
  if (!blockSlug) return processed;

  const nextBlocks: CourseLesson["blocks"] = [];
  let replaced = false;

  for (const block of original.blocks) {
    if (block.slug !== blockSlug) {
      nextBlocks.push(block);
      continue;
    }
    if (!replaced) {
      nextBlocks.push(...processed.blocks);
      replaced = true;
    }
  }

  let order = 1;
  return {
    ...original,
    blocks: nextBlocks.map((block) => ({ ...block, order: order++ })),
    legacy: {
      ...original.legacy,
      contentSplitCleanup: true,
      contentSplitCleanupAt: new Date().toISOString(),
      contentSplitOriginalBlockCount: original.blocks.length,
    },
  };
}
function targetLessons(data: CoursePreviewData, lessonSlug?: string): CourseLesson[] {
  const lessons = [...data.lessons].sort((a, b) => a.displayOrder - b.displayOrder);
  if (!lessonSlug) return lessons;
  const lesson = lessons.find((item) => item.slug === lessonSlug);
  if (!lesson) {
    throw new Error(`Lesson not found: ${lessonSlug}`);
  }
  return [lesson];
}

function buildLessonReport(
  before: CourseLesson,
  after: CourseLesson,
  blockReports: SplitBlockResult[],
  analysis: ReturnType<typeof analyzeLessonSplit>,
): LessonSplitReport {
  const changed = before.blocks.length !== after.blocks.length;
  const validation = validateLessonForPublicRenderer(after);
  return {
    lessonSlug: before.slug,
    lessonTitle: before.title,
    originalBlockCount: before.blocks.length,
    newBlockCount: after.blocks.length,
    detectedTypes: analysis.detectedTypes,
    warnings: analysis.warnings,
    changed,
    skippedReason: changed
      ? undefined
      : analysis.alreadyCleaned
        ? "Lesson already marked as cleaned."
        : analysis.splittableBlocks === 0
          ? "No splittable richText blocks found."
          : undefined,
    blockReports,
    validation,
  };
}

export async function runCourseContentSplit(options: CourseSplitOptions): Promise<CourseSplitReport> {
  const data = await assertCourseAllowed(options);
  const lessonsToProcess = targetLessons(data, options.lessonSlug);
  const dryRun = options.dryRun !== false;

  let nextComponentId = maxLegacyComponentIdFromLessons(data.lessons);
  let nextAssignId = maxAssignIdFromLessons(data.lessons);
  const componentIdAllocator = createIdAllocator(nextComponentId);
  const assignIdAllocator = createIdAllocator(nextAssignId);

  const lessonReports: LessonSplitReport[] = [];
  const updatedLessons = new Map<string, CourseLesson>();

  for (const lesson of lessonsToProcess) {
    if (!isLessonSplitAllowed(lesson)) {
      lessonReports.push({
        lessonSlug: lesson.slug,
        lessonTitle: lesson.title,
        originalBlockCount: lesson.blocks.length,
        newBlockCount: lesson.blocks.length,
        detectedTypes: [],
        warnings: [],
        changed: false,
        skippedReason: `Lesson "${lesson.slug}" is blocklisted from automated splitting.`,
        blockReports: [],
        validation: validateLessonForPublicRenderer(lesson),
      });
      continue;
    }

    const scopedLesson = filterBlocksInLesson(lesson, options.blockSlug);
    const analysis = analyzeLessonSplit(scopedLesson, { force: options.force });
    if (!analysis.wouldChange && !options.force) {
      lessonReports.push({
        lessonSlug: lesson.slug,
        lessonTitle: lesson.title,
        originalBlockCount: lesson.blocks.length,
        newBlockCount: lesson.blocks.length,
        detectedTypes: analysis.detectedTypes,
        warnings: analysis.warnings,
        changed: false,
        skippedReason: analysis.alreadyCleaned
          ? "Lesson already marked as cleaned."
          : "No splittable richText blocks found.",
        blockReports: [],
      });
      continue;
    }

    const { lesson: splitLesson, reports } = splitLessonBlocks(scopedLesson, {
      nextLegacyComponentId: componentIdAllocator,
      nextAssignId: assignIdAllocator,
      force: options.force,
    });

    updatedLessons.set(lesson.slug, mergeLessonBlocks(lesson, splitLesson, options.blockSlug));
    lessonReports.push(
      buildLessonReport(lesson, updatedLessons.get(lesson.slug)!, reports, analysis),
    );
  }

  const totals = {
    lessonsAnalyzed: lessonReports.length,
    lessonsChanged: lessonReports.filter((report) => report.changed).length,
    blocksBefore: lessonReports.reduce((sum, report) => sum + report.originalBlockCount, 0),
    blocksAfter: lessonReports.reduce((sum, report) => sum + report.newBlockCount, 0),
  };

  const changedValidations = lessonReports
    .filter((report) => report.changed)
    .map((report) => report.validation)
    .filter((validation): validation is LessonEditorValidation => Boolean(validation));
  const validationStats = validationSummary(changedValidations);

  if (!dryRun && totals.lessonsChanged > 0 && !validationStats.passed) {
    const failedLessons = lessonReports
      .filter((report) => report.changed && report.validation && !report.validation.passed)
      .map((report) => report.lessonSlug);
    throw new Error(
      `Split validation failed for lesson(s): ${failedLessons.join(", ")}. No files were written. Re-run with --dry-run to inspect validation details.`,
    );
  }

  let backupPath: string | undefined;
  let persistedVia: CourseSplitReport["persistedVia"];
  let commitSha: string | undefined;
  let writtenCourse: CoursePreviewData | undefined;
  if (!dryRun && totals.lessonsChanged > 0) {
    const nextData: CoursePreviewData = {
      ...data,
      lessons: data.lessons.map((lesson) => updatedLessons.get(lesson.slug) ?? lesson),
    };
    const persist = await writeCourseContentFile(options.courseId, nextData, options.write);
    backupPath = persist.backupPath || undefined;
    persistedVia = persist.persistedVia;
    commitSha = persist.commitSha;
    writtenCourse = nextData;
  }

  return {
    courseId: options.courseId,
    courseSlug: data.course.slug,
    courseTitle: data.course.title,
    dryRun,
    backupPath,
    persistedVia,
    commitSha,
    writtenCourse,
    lessons: lessonReports,
    validationPassed: changedValidations.length === 0 || validationStats.passed,
    validationErrorCount: validationStats.errorCount,
    validationWarningCount: validationStats.warningCount,
    totals,
  };
}

export function formatCourseSplitReport(report: CourseSplitReport): string {
  const lines: string[] = [
    `# Course content split ${report.dryRun ? "(dry run)" : "(applied)"}`,
    "",
    `- Course: **${report.courseId}** ${report.courseTitle} (\`${report.courseSlug}\`)`,
    `- File: \`${getCourseContentPath(report.courseId)}\``,
    `- Lessons analyzed: ${report.totals.lessonsAnalyzed}`,
    `- Lessons changed: ${report.totals.lessonsChanged}`,
    `- Blocks before: ${report.totals.blocksBefore}`,
    `- Blocks after: ${report.totals.blocksAfter}`,
  ];

  if (report.backupPath) {
    lines.push(`- Backup: \`${report.backupPath}\``);
  }

  lines.push(
    `- Validation: ${report.validationPassed ? "PASSED" : "FAILED"} (${report.validationErrorCount} errors, ${report.validationWarningCount} warnings)`,
    "",
    "## Lessons",
    "",
  );

  for (const lesson of report.lessons) {
    lines.push(
      `### ${lesson.lessonTitle} (\`${lesson.lessonSlug}\`)`,
      `- Blocks: ${lesson.originalBlockCount} → ${lesson.newBlockCount}`,
      `- Detected types: ${lesson.detectedTypes.join(", ") || "(none)"}`,
    );
    if (lesson.validation) {
      lines.push(
        `- Editor items: ${lesson.validation.editorItemCount}`,
        `- Block slugs: ${lesson.validation.blockSlugs.join(", ") || "(none)"}`,
        `- Component types: ${lesson.validation.componentTypes.join(", ") || "(none)"}`,
        `- Validation: ${lesson.validation.passed ? "PASSED" : "FAILED"}`,
      );
      if (lesson.validation.issues.length > 0) {
        lines.push("- Issues:");
        for (const issue of lesson.validation.issues) {
          const location = [
            issue.blockSlug ? `block ${issue.blockSlug}` : null,
            issue.componentType ? issue.componentType : null,
            issue.field ? issue.field : null,
          ]
            .filter(Boolean)
            .join(" / ");
          lines.push(`  - [${issue.severity}] ${location ? `${location}: ` : ""}${issue.message}`);
        }
      }
    }
    if (lesson.skippedReason) {
      lines.push(`- Skipped: ${lesson.skippedReason}`);
    }
    if (lesson.warnings.length > 0) {
      lines.push("- Warnings:");
      for (const warning of lesson.warnings) {
        lines.push(`  - ${warning}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

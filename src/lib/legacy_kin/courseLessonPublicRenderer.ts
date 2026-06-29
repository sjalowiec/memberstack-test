import type { CourseComponent, CourseLesson } from "./coursePreviewPoc";
import { sortedBlocks, sortedComponents } from "./coursePreviewPoc";
import {
  flattenLessonContent,
  getLessonContentNavEntries,
} from "./courseLessonContentItems";import type { EditorValidationIssue, LessonEditorValidation } from "./courseContentEditorSchema";
import { validateLessonForEditor } from "./courseContentEditorSchema";

/** Lessons with inline images inside lists — splitting breaks render/editor grouping. */
export const SPLIT_DISABLED_LESSON_SLUGS = new Set([
  "decorative-seams",
]);

export function isLessonSplitAllowed(lesson: CourseLesson): boolean {
  return !SPLIT_DISABLED_LESSON_SLUGS.has(lesson.slug);
}

function pushRenderIssue(
  issues: EditorValidationIssue[],
  issue: Omit<EditorValidationIssue, "severity">,
) {
  issues.push({ severity: "error", ...issue });
}

/** Mirrors LegacyCourseBlock.astro render preconditions — throws if .map on missing arrays. */
export function validateComponentForPublicRenderer(
  component: CourseComponent,
  ctx: { lessonSlug: string; blockSlug: string },
): EditorValidationIssue[] {
  const issues: EditorValidationIssue[] = [];
  const type = String((component as { type?: string }).type ?? "");
  const legacyComponentId = Number((component as { legacyComponentId?: number }).legacyComponentId);

  switch (type) {
    case "richText":
      if (typeof (component as { html?: unknown }).html !== "string") {
        pushRenderIssue(issues, {
          ...ctx,
          componentType: type,
          legacyComponentId,
          field: "html",
          message: "Public renderer cannot render richText without html string.",
        });
      }
      break;
    case "video":
      if (!String((component as { vimeoId?: string }).vimeoId ?? "").trim()) {
        pushRenderIssue(issues, {
          ...ctx,
          componentType: type,
          legacyComponentId,
          field: "vimeoId",
          message: "Public renderer cannot render video without vimeoId.",
        });
      }
      break;
    case "download":
      if (!String((component as { filename?: string }).filename ?? "").trim()) {
        pushRenderIssue(issues, {
          ...ctx,
          componentType: type,
          legacyComponentId,
          field: "filename",
          message: "Public renderer cannot render download without filename.",
        });
      }
      break;
    case "image":
    case "imageWithCaption":
      if (!String((component as { src?: string }).src ?? "").trim()) {
        pushRenderIssue(issues, {
          ...ctx,
          componentType: type,
          legacyComponentId,
          field: "src",
          message: "Public renderer cannot render image without src.",
        });
      }
      break;
    case "imageGallery":
    case "imageCarousel": {
      const slides = (component as { slides?: unknown }).slides;
      if (!Array.isArray(slides)) {
        pushRenderIssue(issues, {
          ...ctx,
          componentType: type,
          legacyComponentId,
          field: "slides",
          message: "Public renderer requires slides array.",
        });
      } else {
        slides.forEach((slide, index) => {
          if (!slide || typeof slide !== "object") {
            pushRenderIssue(issues, {
              ...ctx,
              componentType: type,
              legacyComponentId,
              field: `slides[${index}]`,
              message: "Public renderer slide must be an object.",
            });
            return;
          }
          const src = String((slide as { src?: string }).src ?? "").trim();
          if (!src) {
            pushRenderIssue(issues, {
              ...ctx,
              componentType: type,
              legacyComponentId,
              field: `slides[${index}].src`,
              message: "Public renderer slide requires src.",
            });
          }
        });
      }
      break;
    }
    case "exerciseAccordion": {
      const sections = (component as { sections?: unknown }).sections;
      if (!Array.isArray(sections)) {
        pushRenderIssue(issues, {
          ...ctx,
          componentType: type,
          legacyComponentId,
          field: "sections",
          message: "Public renderer requires exerciseAccordion.sections array.",
        });
      } else {
        sections.forEach((section, index) => {
          if (!section || typeof section !== "object") {
            pushRenderIssue(issues, {
              ...ctx,
              componentType: type,
              legacyComponentId,
              field: `sections[${index}]`,
              message: "Public renderer accordion section must be an object.",
            });
            return;
          }
          if (typeof (section as { title?: unknown }).title !== "string") {
            pushRenderIssue(issues, {
              ...ctx,
              componentType: type,
              legacyComponentId,
              field: `sections[${index}].title`,
              message: "Public renderer accordion section requires title string.",
            });
          }
          if (typeof (section as { bodyHtml?: unknown }).bodyHtml !== "string") {
            pushRenderIssue(issues, {
              ...ctx,
              componentType: type,
              legacyComponentId,
              field: `sections[${index}].bodyHtml`,
              message: "Public renderer accordion section requires bodyHtml string.",
            });
          }
        });
      }
      break;
    }
    case "migrationPending": {
      const notes = (component as { notes?: unknown }).notes;
      if (!Array.isArray(notes)) {
        pushRenderIssue(issues, {
          ...ctx,
          componentType: type,
          legacyComponentId,
          field: "notes",
          message: "Public renderer requires migrationPending.notes array.",
        });
      }
      break;
    }
    case "embeddedTool":
      if (!String((component as { toolKey?: string }).toolKey ?? "").trim()) {
        pushRenderIssue(issues, {
          ...ctx,
          componentType: type,
          legacyComponentId,
          field: "toolKey",
          message: "Public renderer requires embeddedTool.toolKey.",
        });
      }
      break;
    default:
      pushRenderIssue(issues, {
        ...ctx,
        componentType: type || "(missing)",
        field: "type",
        message: `Public renderer has no branch for component type "${type}".`,
      });
      break;
  }

  return issues;
}

export function validateLessonForPublicRenderer(
  lesson: CourseLesson,
): LessonEditorValidation & { rendererPassed: boolean } {
  const base = validateLessonForEditor(lesson);
  const renderIssues: EditorValidationIssue[] = [];

  if (Array.isArray(lesson.blocks)) {
    for (const block of sortedBlocks(lesson)) {
      const blockSlug = String(block.slug ?? "");
      for (const component of sortedComponents(block)) {
        renderIssues.push(
          ...validateComponentForPublicRenderer(component, {
            lessonSlug: lesson.slug,
            blockSlug,
          }),
        );
      }
    }

    const navEntries = getLessonContentNavEntries(lesson);
    if (navEntries.length === 0 && lesson.blocks.length > 0) {
      pushRenderIssue(renderIssues, {
        lessonSlug: lesson.slug,
        message: "Public renderer produced zero content nav entries.",
      });
    }
    if (flattenLessonContent(lesson).length === 0 && lesson.blocks.length > 0) {
      pushRenderIssue(renderIssues, {
        lessonSlug: lesson.slug,
        message: "Public renderer flattenLessonContent produced zero items.",
      });
    }  }

  const issues = [...base.issues, ...renderIssues];
  const errors = issues.filter((issue) => issue.severity === "error");

  return {
    ...base,
    issues,
    rendererPassed: errors.length === 0,
    passed: errors.length === 0 && base.editorItemCount > 0,
  };
}

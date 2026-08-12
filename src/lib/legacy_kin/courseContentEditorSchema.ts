import { validateLessonInput } from "./courseContentAdmin";
import { isAccordionLayoutBlock } from "./courseAccordionLayout";
import { isTextImageLayoutBlock } from "./courseTextImageLayout";
import { isTextVideoLayoutBlock, richTextHasVisibleContent } from "./courseTextVideoLayout";
import { isThreeVideosLayoutBlock } from "./courseThreeVideosLayout";
import { isTwoVideosLayoutBlock } from "./courseTwoVideosLayout";
import type { CourseBlock, CourseComponent, CourseLesson } from "./coursePreviewPoc";
import { sortedBlocks, sortedComponents } from "./coursePreviewPoc";
import { flattenLessonContent } from "./courseLessonContentItems";

export const EDITOR_COMPONENT_TYPES = new Set([
  "richText",
  "video",
  "download",
  "image",
  "imageWithCaption",
  "imageGallery",
  "imageCarousel",
  "exerciseAccordion",
  "embeddedTool",
  "migrationPending",
]);

export type EditorValidationIssue = {
  lessonSlug: string;
  blockSlug?: string;
  legacyComponentId?: number;
  componentType?: string;
  field?: string;
  message: string;
  severity: "error" | "warning";
};

export type LessonEditorValidation = {
  lessonSlug: string;
  lessonTitle: string;
  editorItemCount: number;
  blockCount: number;
  blockSlugs: string[];
  componentTypes: string[];
  issues: EditorValidationIssue[];
  passed: boolean;
};

const FRAGMENT_RICHTEXT_RE =
  /^\s*(?:<\/(?:li|ul|ol|p|div|table|tr|td|th|tbody|thead)\b|<\/)/i;

function pushIssue(
  issues: EditorValidationIssue[],
  issue: Omit<EditorValidationIssue, "severity"> & { severity?: EditorValidationIssue["severity"] },
) {
  issues.push({ severity: "error", ...issue });
}

function validateRichTextHtml(
  html: string,
  ctx: { lessonSlug: string; blockSlug: string; legacyComponentId: number },
  issues: EditorValidationIssue[],
) {
  if (typeof html !== "string") {
    pushIssue(issues, {
      ...ctx,
      componentType: "richText",
      field: "html",
      message: "richText.html must be a string.",
    });
    return;
  }

  if (FRAGMENT_RICHTEXT_RE.test(html)) {
    pushIssue(issues, {
      ...ctx,
      componentType: "richText",
      field: "html",
      message: "richText appears to start with orphaned closing markup from a bad split.",
    });
  }

  const openUl = (html.match(/<ul\b/gi) ?? []).length;
  const closeUl = (html.match(/<\/ul>/gi) ?? []).length;
  const openOl = (html.match(/<ol\b/gi) ?? []).length;
  const closeOl = (html.match(/<\/ol>/gi) ?? []).length;
  const openLi = (html.match(/<li\b/gi) ?? []).length;
  const closeLi = (html.match(/<\/li>/gi) ?? []).length;

  if (openUl !== closeUl || openOl !== closeOl || openLi !== closeLi) {
    pushIssue(issues, {
      ...ctx,
      componentType: "richText",
      field: "html",
      message: `richText has unbalanced list markup (ul ${openUl}/${closeUl}, ol ${openOl}/${closeOl}, li ${openLi}/${closeLi}).`,
      severity: "warning",
    });
  }

  if (!richTextHasVisibleContent(html) && !/<img\b/i.test(html)) {
    pushIssue(issues, {
      ...ctx,
      componentType: "richText",
      field: "html",
      message: "richText has no visible content.",
      severity: "warning",
    });
  }
}

function validateComponent(
  component: CourseComponent,
  ctx: { lessonSlug: string; blockSlug: string },
  issues: EditorValidationIssue[],
) {
  const type = String((component as { type?: string }).type ?? "");
  const legacyComponentId = Number((component as { legacyComponentId?: number }).legacyComponentId);

  if (!type) {
    pushIssue(issues, {
      ...ctx,
      field: "type",
      message: "Component is missing type.",
    });
    return;
  }

  if (!EDITOR_COMPONENT_TYPES.has(type)) {
    pushIssue(issues, {
      ...ctx,
      componentType: type,
      field: "type",
      message: `Unsupported component type "${type}" for editor/renderer.`,
    });
    return;
  }

  if (!Number.isFinite(legacyComponentId)) {
    pushIssue(issues, {
      ...ctx,
      componentType: type,
      field: "legacyComponentId",
      message: "Component is missing legacyComponentId.",
    });
  }

  if (!Number.isFinite(Number((component as { order?: number }).order))) {
    pushIssue(issues, {
      ...ctx,
      componentType: type,
      legacyComponentId,
      field: "order",
      message: "Component is missing order.",
    });
  }

  switch (type) {
    case "richText":
      validateRichTextHtml(String((component as { html?: string }).html ?? ""), {
        ...ctx,
        legacyComponentId,
      }, issues);
      break;
    case "video":
      if (!String((component as { vimeoId?: string }).vimeoId ?? "").trim()) {
        pushIssue(issues, {
          ...ctx,
          componentType: type,
          legacyComponentId,
          field: "vimeoId",
          message: "video component requires vimeoId.",
        });
      }
      break;
    case "download":
      if (!String((component as { label?: string }).label ?? "").trim()) {
        pushIssue(issues, {
          ...ctx,
          componentType: type,
          legacyComponentId,
          field: "label",
          message: "download component requires label.",
        });
      }
      if (!String((component as { filename?: string }).filename ?? "").trim()) {
        pushIssue(issues, {
          ...ctx,
          componentType: type,
          legacyComponentId,
          field: "filename",
          message: "download component requires filename.",
        });
      }
      break;
    case "image":
    case "imageWithCaption":
      if (!String((component as { src?: string }).src ?? "").trim()) {
        pushIssue(issues, {
          ...ctx,
          componentType: type,
          legacyComponentId,
          field: "src",
          message: `${type} component requires src.`,
        });
      }
      break;
    case "imageGallery":
    case "imageCarousel": {
      const slides = (component as { slides?: unknown[] }).slides;
      if (!Array.isArray(slides) || slides.length === 0) {
        pushIssue(issues, {
          ...ctx,
          componentType: type,
          legacyComponentId,
          field: "slides",
          message: `${type} component requires a non-empty slides array.`,
        });
      }
      break;
    }
    case "exerciseAccordion": {
      const sections = (component as { sections?: unknown[] }).sections;
      if (!Array.isArray(sections) || sections.length === 0) {
        pushIssue(issues, {
          ...ctx,
          componentType: type,
          legacyComponentId,
          field: "sections",
          message: "exerciseAccordion requires sections.",
        });
      }
      break;
    }
    case "embeddedTool":
      if (!String((component as { toolKey?: string }).toolKey ?? "").trim()) {
        pushIssue(issues, {
          ...ctx,
          componentType: type,
          legacyComponentId,
          field: "toolKey",
          message: "embeddedTool requires toolKey.",
        });
      }
      break;
    case "migrationPending":
      if (!String((component as { legacyType?: string }).legacyType ?? "").trim()) {
        pushIssue(issues, {
          ...ctx,
          componentType: type,
          legacyComponentId,
          field: "legacyType",
          message: "migrationPending requires legacyType.",
        });
      }
      break;
    default:
      break;
  }
}

function validateBlock(
  block: CourseBlock,
  lessonSlug: string,
  issues: EditorValidationIssue[],
) {
  const blockSlug = String(block.slug ?? "").trim();
  if (!blockSlug) {
    pushIssue(issues, {
      lessonSlug,
      field: "slug",
      message: "Block is missing slug.",
    });
  }

  if (typeof block.title !== "string") {
    pushIssue(issues, {
      lessonSlug,
      blockSlug,
      field: "title",
      message: "Block is missing title.",
    });
  }

  if (!Number.isFinite(Number(block.order))) {
    pushIssue(issues, {
      lessonSlug,
      blockSlug,
      field: "order",
      message: "Block is missing order.",
    });
  }

  if (!block.legacy || !Number.isFinite(Number(block.legacy.assignId))) {
    pushIssue(issues, {
      lessonSlug,
      blockSlug,
      field: "legacy.assignId",
      message: "Block is missing legacy.assignId (required by hand-cleaned course schema).",
    });
  }

  if (!Array.isArray(block.components)) {
    pushIssue(issues, {
      lessonSlug,
      blockSlug,
      field: "components",
      message: "Block components must be an array.",
    });
    return;
  }

  if (block.components.length === 0) {
    pushIssue(issues, {
      lessonSlug,
      blockSlug,
      field: "components",
      message: "Block has an empty components array; editor removes these on save.",
    });
  }

  for (const component of block.components) {
    validateComponent(component, { lessonSlug, blockSlug }, issues);
  }
}

/** Count editable items the course editor would show (mirrors flattenLessonContent). */
export function countEditorItems(lesson: CourseLesson): number {
  return flattenLessonContent(lesson).length;
}

export function validateLessonForEditor(lesson: CourseLesson): LessonEditorValidation {
  const issues: EditorValidationIssue[] = [];
  const componentTypes = new Set<string>();
  const blockSlugs = new Set<string>();

  if (!Array.isArray(lesson.blocks)) {
    pushIssue(issues, {
      lessonSlug: lesson.slug,
      field: "blocks",
      message: "Lesson blocks must be an array.",
    });
  } else {
    for (const block of lesson.blocks) {
      if (blockSlugs.has(block.slug)) {
        pushIssue(issues, {
          lessonSlug: lesson.slug,
          blockSlug: block.slug,
          field: "slug",
          message: `Duplicate block slug "${block.slug}" within lesson.`,
        });
      }
      blockSlugs.add(block.slug);
      validateBlock(block, lesson.slug, issues);
      for (const component of block.components ?? []) {
        componentTypes.add(String((component as { type?: string }).type ?? ""));
      }
    }

    const componentIds = new Map<number, string>();
    for (const block of lesson.blocks) {
      for (const component of block.components ?? []) {
        const id = Number((component as { legacyComponentId?: number }).legacyComponentId);
        if (!Number.isFinite(id)) continue;
        const key = `${block.slug}#${(component as { type?: string }).type}:${id}`;
        if (componentIds.has(id)) {
          pushIssue(issues, {
            lessonSlug: lesson.slug,
            blockSlug: block.slug,
            legacyComponentId: id,
            message: `Duplicate legacyComponentId ${id} (${componentIds.get(id)} and ${key}).`,
          });
        }
        componentIds.set(id, key);
      }
    }
  }

  const structural = validateLessonInput(lesson);
  if ("error" in structural) {
    pushIssue(issues, {
      lessonSlug: lesson.slug,
      message: structural.error,
    });
  }

  const editorItemCount = Array.isArray(lesson.blocks) ? countEditorItems(lesson) : 0;
  if (editorItemCount === 0 && Array.isArray(lesson.blocks) && lesson.blocks.length > 0) {
    pushIssue(issues, {
      lessonSlug: lesson.slug,
      message: "Lesson has blocks but the editor would show zero items.",
    });
  }

  const errors = issues.filter((issue) => issue.severity === "error");
  return {
    lessonSlug: lesson.slug,
    lessonTitle: lesson.title,
    editorItemCount,
    blockCount: Array.isArray(lesson.blocks) ? lesson.blocks.length : 0,
    blockSlugs: [...blockSlugs],
    componentTypes: [...componentTypes].sort(),
    issues,
    passed: errors.length === 0 && editorItemCount > 0,
  };
}

export function validateLessonsForEditor(lessons: CourseLesson[]): LessonEditorValidation[] {
  return lessons.map((lesson) => validateLessonForEditor(lesson));
}

export function validationSummary(validations: LessonEditorValidation[]): {
  passed: boolean;
  errorCount: number;
  warningCount: number;
} {
  let errorCount = 0;
  let warningCount = 0;
  for (const validation of validations) {
    for (const issue of validation.issues) {
      if (issue.severity === "error") errorCount += 1;
      else warningCount += 1;
    }
  }
  return {
    passed: validations.every((validation) => validation.passed),
    errorCount,
    warningCount,
  };
}

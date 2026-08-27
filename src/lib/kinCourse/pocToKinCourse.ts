import type { CourseBlock, CourseComponent, CoursePreviewData } from "../legacy_kin/coursePreviewPoc";
import { sortedBlocks, sortedComponents } from "../legacy_kin/coursePreviewPoc";
import { isLegacyLessonPublished } from "../legacy_kin/legacyCoursePublication";
import type { KinCourseComponent, KinCourseDocument, KinCourseLesson } from "./types";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function componentIdOf(component: CourseComponent): number {
  return Number((component as { legacyComponentId?: number }).legacyComponentId) || 0;
}

function mapPocComponent(component: CourseComponent): KinCourseComponent {
  const order = Number(component.order) || 0;
  const componentId = componentIdOf(component);

  switch (component.type) {
    case "richText":
      return {
        type: "html",
        order,
        componentId,
        html: String(component.html ?? ""),
      };
    case "video":
      return {
        type: "vimeo",
        order,
        componentId,
        vimeoId: String(component.vimeoId ?? "").trim(),
        label: component.title ?? undefined,
      };
    case "image":
    case "imageWithCaption": {
      const src = String(component.src ?? "").trim();
      const alt = escapeHtml(String(component.alt ?? "").trim());
      const caption = component.caption
        ? `<figcaption>${component.caption}</figcaption>`
        : "";
      const link = component.linkUrl
        ? `<a href="${escapeHtml(component.linkUrl)}"><img src="${escapeHtml(src)}" alt="${alt}"></a>`
        : `<img src="${escapeHtml(src)}" alt="${alt}">`;
      return {
        type: "html",
        order,
        componentId,
        html: `<figure class="kin-poc-image">${link}${caption}</figure>`,
      };
    }
    case "download": {
      const href = escapeHtml(String(component.filename ?? "").trim());
      const label = component.label || component.filename || "Download";
      return {
        type: "html",
        order,
        componentId,
        filename: component.filename,
        html: `<p><a href="${href}" target="_blank" rel="noopener">${label}</a></p>`,
      };
    }
    case "imageGallery":
    case "imageCarousel":
      return {
        type: "imageslideshow",
        order,
        componentId,
        slides: (component.slides ?? []).map((slide) => ({
          src: slide.src,
          caption: slide.caption ?? undefined,
        })),
      };
    case "exerciseAccordion":
      return {
        type: "exercise",
        order,
        componentId,
        items: (component.sections ?? []).map((section, index) => ({
          order: index + 1,
          heading: section.title,
          detailsHtml: section.bodyHtml,
          image: section.iconSrc,
        })),
      };
    case "embeddedTool":
      return {
        type: "html",
        order,
        componentId,
        html: `<p class="legacy-placeholder" role="note">Embedded tool: ${escapeHtml(component.toolKey)}</p>`,
      };
    case "migrationPending":
      return {
        type: component.legacyType || "unknown",
        order,
        componentId,
        pending: true,
        unsupported: true,
        legacyType: component.legacyType,
      };
    default:
      return {
        type: String((component as { type?: string }).type || "unknown"),
        order,
        componentId,
        unsupported: true,
        legacyType: String((component as { type?: string }).type || "unknown"),
      };
  }
}

function mapBlockToLesson(block: CourseBlock): KinCourseLesson | null {
  const id = Number(block.legacy?.assignId) || 0;
  if (!id) return null;
  return {
    id,
    title: block.title?.trim() || block.slug,
    order: Number(block.order) || 0,
    slug: block.slug,
    components: sortedComponents(block).map(mapPocComponent),
  };
}

export function pocToKinCourse(
  data: CoursePreviewData,
  options: { includeDrafts?: boolean } = {},
): KinCourseDocument {
  const includeDrafts = options.includeDrafts === true;
  const parents = [...data.lessons].sort((a, b) => a.displayOrder - b.displayOrder);
  const sections = parents
    .filter((lesson) => includeDrafts || isLegacyLessonPublished(lesson))
    .map((lesson) => {
      const lessons = sortedBlocks(lesson)
        .map(mapBlockToLesson)
        .filter((entry): entry is KinCourseLesson => entry !== null)
        .sort((a, b) => a.order - b.order);
      return {
        id: Number(lesson.legacy?.itemId) || lesson.displayOrder,
        title: lesson.title,
        order: lesson.displayOrder,
        empty: lessons.length === 0,
        lessons,
      };
    });

  return {
    id: Number(data.course.legacyChallengeId),
    title: data.course.title,
    slug: data.course.slug,
    thumbnail: data.course.thumbnail,
    description: data.course.description,
    sections,
  };
}

export function findPocBlockByAssignId(
  data: CoursePreviewData,
  assignId: number,
): { parentSlug: string; blockSlug: string; assignId: number } | null {
  const target = Number(assignId);
  for (const lesson of data.lessons) {
    for (const block of lesson.blocks ?? []) {
      if (Number(block.legacy?.assignId) === target) {
        return { parentSlug: lesson.slug, blockSlug: block.slug, assignId: target };
      }
    }
  }
  return null;
}

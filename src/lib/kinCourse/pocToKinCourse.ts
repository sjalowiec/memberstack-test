import type { CourseBlock, CourseComponent, CoursePreviewData, MigrationPendingComponent } from "../legacy_kin/coursePreviewPoc";
import { sortedBlocks, sortedComponents } from "../legacy_kin/coursePreviewPoc";
import { isLegacyLessonPublished } from "../legacy_kin/legacyCoursePublication";
import { numberedLegacyFields } from "./legacyFields";
import type { KinCourseComponent, KinCourseDocument, KinCourseLesson } from "./types";
import {
  jumpsFromComponent,
  prepareVimeoJumpLinkPlayback,
} from "./vimeoJumpLinks";

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

function legacyTypeOf(component: CourseComponent): string {
  return String((component as { legacyType?: string }).legacyType ?? "").trim();
}

function normalizedLegacyType(component: CourseComponent): string {
  return legacyTypeOf(component).toLowerCase();
}

function isVideoComponent(
  component: CourseComponent,
): component is CourseComponent & { type: "video"; vimeoId?: string } {
  return component.type === "video";
}

export { numberedLegacyFields } from "./legacyFields";

function optionalNumber(value: string | undefined): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function siblingVimeoId(
  components: CourseComponent[],
  index: number,
): string | undefined {
  for (let i = index - 1; i >= 0; i--) {
    const candidate = components[i];
    if (candidate && isVideoComponent(candidate) && String(candidate.vimeoId ?? "").trim()) {
      return String(candidate.vimeoId).trim();
    }
  }
  for (const candidate of components) {
    if (isVideoComponent(candidate) && String(candidate.vimeoId ?? "").trim()) {
      return String(candidate.vimeoId).trim();
    }
  }
  return undefined;
}

function pendingComponent(
  component: CourseComponent,
  order: number,
  componentId: number,
): KinCourseComponent {
  return {
    type: legacyTypeOf(component) || "unknown",
    order,
    componentId,
    pending: true,
    unsupported: true,
    legacyType: component.type === "migrationPending" ? component.legacyType : legacyTypeOf(component),
  };
}

function mapVimeoJumpLinks(
  component: CourseComponent,
  order: number,
  componentId: number,
  vimeoId: string | undefined,
): KinCourseComponent {
  const jumps = jumpsFromComponent(component);
  if (jumps.length === 0) {
    return pendingComponent(component as MigrationPendingComponent, order, componentId);
  }

  const nativeVimeoId = String((component as { vimeoId?: string }).vimeoId ?? "").trim();
  const playerComponentId = Number((component as { playerComponentId?: number }).playerComponentId);

  return {
    type: "vimeoJumpLinks",
    order,
    componentId,
    vimeoId: nativeVimeoId || vimeoId,
    playerComponentId: Number.isFinite(playerComponentId) && playerComponentId > 0 ? playerComponentId : undefined,
    jumps,
  };
}

function mapHotspot(
  component: MigrationPendingComponent,
  order: number,
  componentId: number,
): KinCourseComponent {
  const fields = component.legacyFields ?? {};
  const image = String(fields.SPOTT_IMAGE ?? "").trim();
  const count = Number(fields.HOTSPOTCOUNT) || 0;
  const cords = numberedLegacyFields(fields, "SPOT_CORD");
  const texts = new Map(numberedLegacyFields(fields, "SPOT_TEXT").map((item) => [item.index, item.value]));
  const locations = new Map(numberedLegacyFields(fields, "SPOT_LOCATION").map((item) => [item.index, item.value]));
  const actions = new Map(numberedLegacyFields(fields, "SPOT_FUNCTION").map((item) => [item.index, item.value]));
  const actionIds = new Map(numberedLegacyFields(fields, "SPOT_ACTIONID").map((item) => [item.index, item.value]));
  const indexes = new Set<number>([
    ...cords.map((item) => item.index),
    ...texts.keys(),
    ...(count > 0 ? Array.from({ length: count }, (_, i) => i + 1) : []),
  ]);

  const spots = [...indexes]
    .sort((a, b) => a - b)
    .map((index) => ({
      index,
      text: texts.get(index),
      style: cords.find((item) => item.index === index)?.value,
      location: locations.get(index),
      actionId: actionIds.get(index) ?? null,
      action: actions.get(index) ?? null,
    }))
    .filter((spot) => spot.style || spot.text);

  if (!image || spots.length === 0) return pendingComponent(component, order, componentId);

  return {
    type: "hotspot",
    order,
    componentId,
    image,
    imageWidth: optionalNumber(fields.IMAGE_WIDTH),
    imageHeight: optionalNumber(fields.IMAGE_HEIGHT),
    wrapperStyle: String(fields.TOPDIV ?? "").trim() || undefined,
    stageStyle: String(fields.SECONDDIV ?? "").trim() || undefined,
    spots,
  };
}

function mapPocComponent(
  component: CourseComponent,
  siblings: CourseComponent[],
  index: number,
): KinCourseComponent {
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
        items: (component.sections ?? []).map((section, sectionIndex) => ({
          order: sectionIndex + 1,
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
    case "vimeoJumpLinks":
      return mapVimeoJumpLinks(component, order, componentId, siblingVimeoId(siblings, index));
    case "migrationPending": {
      const kind = normalizedLegacyType(component);
      if (kind === "vimeojumplinks") {
        return mapVimeoJumpLinks(component, order, componentId, siblingVimeoId(siblings, index));
      }
      if (kind === "hotspot") {
        return mapHotspot(component, order, componentId);
      }
      return pendingComponent(component, order, componentId);
    }
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
  const siblings = sortedComponents(block);
  return {
    id,
    title: block.title?.trim() || block.slug,
    order: Number(block.order) || 0,
    slug: block.slug,
    components: prepareVimeoJumpLinkPlayback(
      siblings.map((component, index) => mapPocComponent(component, siblings, index)),
    ),
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

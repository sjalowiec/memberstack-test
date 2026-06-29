import type { FlatContentItem } from "./courseContentEditorTypes";
import { isEditorLayoutBlock } from "./courseContentEditorBlocks";
import { flattenLessonContent } from "./courseLessonContentItems";
import type { CourseLesson } from "./coursePreviewPoc";
import { sortedBlocks } from "./coursePreviewPoc";

type LessonRecord = Record<string, unknown>;

export type ContentListGroup = {
  blockSlug: string;
  blockTitle: string;
  sectionNumber: number;
  totalSections: number;
  canSplit: boolean;
  isLayout: boolean;
  blockCount: number;
  entries: { item: FlatContentItem; index: number }[];
};

export function blockTitleForEditing(title: unknown): string {
  const trimmed = typeof title === "string" ? title.trim() : "";
  if (!trimmed || /^\(untitled assign \d+\)$/i.test(trimmed)) return "";
  return trimmed;
}

function findBlockInLesson(lesson: LessonRecord, blockSlug: string): LessonRecord | null {
  const blocks = Array.isArray(lesson.blocks) ? (lesson.blocks as LessonRecord[]) : [];
  return blocks.find((block) => String(block.slug ?? "") === blockSlug) ?? null;
}

export function sectionTitleForBlock(lesson: LessonRecord, blockSlug: string): string {
  const block = findBlockInLesson(lesson, blockSlug);
  if (!block) return "";
  return blockTitleForEditing(block.title) || "Untitled section";
}

export function countLessonSectionsAndBlocks(lesson: LessonRecord): {
  sectionCount: number;
  blockCount: number;
} {
  const items = flattenLessonContent(lesson as CourseLesson);
  const sectionCount = sortedBlocks(lesson as CourseLesson).length;
  return { sectionCount, blockCount: items.length };
}

export function formatLessonSidebarMeta(sectionCount: number, blockCount: number): string {
  const sections = `${sectionCount} section${sectionCount === 1 ? "" : "s"}`;
  const blocks = `${blockCount} block${blockCount === 1 ? "" : "s"}`;
  return `${sections} \u00b7 ${blocks}`;
}

export function buildContentListGroups(
  lesson: LessonRecord,
  items: FlatContentItem[],
): ContentListGroup[] {
  const blockOrder = sortedBlocks(lesson as CourseLesson)
    .map((block) => String(block.slug ?? ""))
    .filter(Boolean);

  return blockOrder.map((blockSlug, index) => {
    const block = findBlockInLesson(lesson, blockSlug);
    const entries = items
      .map((item, itemIndex) => ({ item, index: itemIndex }))
      .filter((entry) => entry.item.blockSlug === blockSlug);
    const componentCount = Array.isArray(block?.components)
      ? block.components.length
      : entries.length;
    return {
      blockSlug,
      blockTitle: sectionTitleForBlock(lesson, blockSlug),
      sectionNumber: index + 1,
      totalSections: blockOrder.length,
      canSplit: Boolean(block && !isEditorLayoutBlock(block) && componentCount > 1),
      isLayout: Boolean(block && isEditorLayoutBlock(block)),
      blockCount: entries.length,
      entries,
    };
  });
}

export function sectionGroupMetaLabel(group: ContentListGroup): string {
  if (group.blockCount === 0) {
    return "No blocks";
  }
  if (group.isLayout && group.blockCount === 1) {
    return "Combined layout";
  }
  if (group.blockCount === 1) {
    return "1 block";
  }
  return `${group.blockCount} blocks`;
}

export function formatSectionBlockCount(blockCount: number): string {
  if (blockCount === 0) return "No blocks";
  return `${blockCount} block${blockCount === 1 ? "" : "s"}`;
}

export function sectionNavLabel(title: string): string {
  const trimmed = title.trim();
  return trimmed || "Untitled section";
}

/** Pick which section row should be expanded in the lesson outline. */
export function resolveExpandedSectionSlug(
  groups: ContentListGroup[],
  options: {
    currentExpanded: string | null;
    selectedBlockSectionSlug: string | null;
    preferFirstWhenUnset?: boolean;
  },
): string | null {
  if (groups.length === 0) return null;

  const slugs = new Set(groups.map((group) => group.blockSlug));

  if (options.currentExpanded && slugs.has(options.currentExpanded)) {
    return options.currentExpanded;
  }

  if (options.selectedBlockSectionSlug && slugs.has(options.selectedBlockSectionSlug)) {
    return options.selectedBlockSectionSlug;
  }

  if (options.preferFirstWhenUnset !== false) {
    return groups[0]!.blockSlug;
  }

  return null;
}

/** Simple block types that can be added inside an existing section. */
export const SECTION_BLOCK_ADD_KINDS: { kind: string; label: string }[] = [
  { kind: "richText-blank", label: "Text" },
  { kind: "video", label: "Video" },
  { kind: "download", label: "Download" },
  { kind: "image", label: "Image" },
  { kind: "imageWithCaption", label: "Image + caption" },
  { kind: "embeddedTool", label: "Tool" },
];

/** Section types that always create a new section (block) in the lesson. */
export const NEW_SECTION_ADD_KINDS: { kind: string; label: string }[] = [
  { kind: "richText-blank", label: "Text" },
  { kind: "textVideoLayout", label: "Text + Video" },
  { kind: "threeVideosLayout", label: "Three Videos with Text" },
  { kind: "textImageLayout", label: "Text + Image" },
  { kind: "video", label: "Video" },
  { kind: "image", label: "Image" },
  { kind: "imageWithCaption", label: "Image with Caption" },
  { kind: "download", label: "Download" },
  { kind: "embeddedTool", label: "Embedded Tool" },
  { kind: "exerciseAccordion", label: "Accordion" },
  { kind: "imageGallery", label: "Gallery" },
  { kind: "imageCarousel", label: "Carousel" },
];

import type { FlatContentItem } from "./courseContentEditorTypes";
import { isEditorLayoutBlock } from "./courseContentEditorBlocks";
import { flattenLessonContent } from "./courseLessonContentItems";
import {
  isVimeoJumpLinksComponent,
  jumpLinksOwnedByVideo,
  unattachedJumpLinksReason,
  unattachedJumpLinksSummary,
} from "./vimeoJumpLinksEditor";
import type { CourseLesson } from "./coursePreviewPoc";
import { sortedBlocks } from "./coursePreviewPoc";

type LessonRecord = Record<string, unknown>;

export type ContentListGroup = {
  blockSlug: string;
  blockTitle: string;
  /** Block title written back when the section name is edited. */
  titleValue?: string;
  /** False for extra preview sections that share one block title. */
  titleEditable?: boolean;
  sectionNumber: number;
  totalSections: number;
  canSplit: boolean;
  isLayout: boolean;
  blockCount: number;
  /** Index in sorted lesson blocks. Section move uses this, not the preview row index. */
  blockIndex?: number;
  /** Section move, split, and delete apply to the whole block only on this row. */
  ownsBlockActions?: boolean;
  siblingPrevIndex?: number | null;
  siblingNextIndex?: number | null;
  entries: {
    item: FlatContentItem;
    index: number;
    jumpLinks: FlatContentItem[];
    /** Set when a jump-links component is shown on its own. */
    jumpLinksNote: string | null;
  }[];
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
  const groups = buildContentListGroups(lesson, items);
  return {
    sectionCount: groups.length,
    blockCount: groups.reduce((total, group) => total + group.blockCount, 0),
  };
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

  const groups: ContentListGroup[] = [];

  blockOrder.forEach((blockSlug, blockIndex) => {
    const block = findBlockInLesson(lesson, blockSlug);
    const sectionEntries = items
      .map((item, itemIndex) => ({ item, index: itemIndex }))
      .filter((entry) => entry.item.blockSlug === blockSlug);
    const sectionComponents = sectionEntries.map((entry) => entry.item.component);
    const entries = sectionEntries.flatMap((entry, entryIndex) => {
      const unattached = unattachedJumpLinksReason(sectionComponents, entryIndex);
      if (isVimeoJumpLinksComponent(entry.item.component) && unattached == null) {
        return [];
      }
      const owned = new Set(
        entry.item.component.type === "video"
          ? jumpLinksOwnedByVideo(sectionComponents, entryIndex)
          : [],
      );
      const jumpLinks = sectionEntries
        .filter((candidate) => owned.has(candidate.item.component))
        .map((candidate) => candidate.item);
      return [
        {
          ...entry,
          jumpLinks,
          jumpLinksNote: unattached ? unattachedJumpLinksSummary(unattached) : null,
        },
      ];
    });
    const isLayout = Boolean(block && isEditorLayoutBlock(block));
    const rawTitle = sectionTitleForBlock(lesson, blockSlug);
    const canSplit = Boolean(block && !isLayout && entries.length > 1);

    groups.push({
      blockSlug,
      blockTitle: rawTitle,
      titleValue: rawTitle,
      titleEditable: true,
      sectionNumber: 0,
      totalSections: 0,
      canSplit,
      isLayout,
      blockCount: entries.length,
      blockIndex,
      ownsBlockActions: true,
      siblingPrevIndex: null,
      siblingNextIndex: null,
      entries,
    });
  });

  return groups.map((group, index) => ({
    ...group,
    sectionNumber: index + 1,
    totalSections: groups.length,
  }));
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

import {
  TEXT_VIDEO_LAYOUT_TYPE,
  type ComponentRef,
  type FlatContentItem,
} from "./courseContentEditorTypes";
import {
  contentItemMatchesRef,
  flattenLessonContent,
} from "./courseLessonContentItems";
import type { CourseBlock, CourseLesson } from "./coursePreviewPoc";
import { sortedBlocks, sortedComponents } from "./coursePreviewPoc";
import {
  getTextVideoLayoutParts,
  isTextVideoLayoutBlock,
  richTextHasVisibleContent,
  TEXT_VIDEO_BOTTOM_ROLE,
} from "./courseTextVideoLayout";

function findBlock(lesson: CourseLesson, blockSlug: string): CourseBlock | undefined {
  return lesson.blocks.find((block) => block.slug === blockSlug);
}

/** Next standalone richText item after a Text + Video layout item in the admin list. */
export function getNextPlainTextItem(
  lesson: CourseLesson,
  ref: ComponentRef,
): FlatContentItem | null {
  if (ref.type !== TEXT_VIDEO_LAYOUT_TYPE) return null;
  const items = flattenLessonContent(lesson);
  const index = items.findIndex((item) => contentItemMatchesRef(item, ref));
  if (index === -1 || index >= items.length - 1) return null;
  const next = items[index + 1]!;
  if (next.type !== "richText") return null;
  return next;
}

function ensureBottomTextComponent(
  block: CourseBlock,
  bottomLegacyComponentId: number,
): Record<string, unknown> {
  const parts = getTextVideoLayoutParts(block);
  if (!parts) throw new Error("Not a text+video layout block.");
  if (parts.bottomText) return parts.bottomText;

  const bottom = {
    type: "richText",
    html: "",
    legacyComponentId: bottomLegacyComponentId,
    order: 3,
    layoutRole: TEXT_VIDEO_BOTTOM_ROLE,
  };
  if (!Array.isArray(block.components)) block.components = [];
  block.components.push(bottom);
  return bottom;
}

function removeStandaloneRichTextItem(lesson: CourseLesson, item: FlatContentItem): boolean {
  const blockIndex = lesson.blocks.findIndex((block) => block.slug === item.blockSlug);
  if (blockIndex === -1) return false;
  const block = lesson.blocks[blockIndex]!;
  const componentIndex = block.components.findIndex(
    (component) =>
      component.legacyComponentId === item.legacyComponentId && component.type === item.type,
  );
  if (componentIndex === -1) return false;
  block.components.splice(componentIndex, 1);
  if (block.components.length === 0) {
    lesson.blocks.splice(blockIndex, 1);
  }
  return true;
}

function reassignAllContentOrders(lesson: CourseLesson) {
  let order = 1;
  for (const block of sortedBlocks(lesson)) {
    for (const component of sortedComponents(block)) {
      component.order = order++;
    }
  }
}

/** Merge the next plain Text item into this Text + Video block's bottom text column. */
export function combineTextVideoWithNextPlainText(
  lesson: CourseLesson,
  ref: ComponentRef,
  bottomLegacyComponentId: number,
): { lesson: CourseLesson; combined: boolean } {
  const next = getNextPlainTextItem(lesson, ref);
  if (!next) return { lesson, combined: false };

  const block = findBlock(lesson, ref.blockSlug);
  if (!block || !isTextVideoLayoutBlock(block)) return { lesson, combined: false };

  const nextHtml = String(next.component.html ?? "");
  const parts = getTextVideoLayoutParts(block);
  if (!parts) return { lesson, combined: false };

  let bottomHtml = nextHtml;
  if (parts.bottomText && richTextHasVisibleContent(String(parts.bottomText.html ?? ""))) {
    bottomHtml = `${String(parts.bottomText.html ?? "")}\n${nextHtml}`;
  }

  const bottom = ensureBottomTextComponent(block, bottomLegacyComponentId);
  bottom.html = bottomHtml;

  if (!removeStandaloneRichTextItem(lesson, next)) {
    return { lesson, combined: false };
  }

  reassignAllContentOrders(lesson);
  return { lesson, combined: true };
}

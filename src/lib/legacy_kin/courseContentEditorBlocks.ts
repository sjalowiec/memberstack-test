import type { CourseLesson } from "./coursePreviewPoc";
import { sortedBlocks } from "./coursePreviewPoc";
import { maxLegacyComponentIdFromLessons } from "./courseContentSplitIds";
import { isAccordionLayoutBlock } from "./courseAccordionLayout";
import { isEmbeddedToolLayoutBlock } from "./courseEmbeddedToolLayout";
import { isTextImageLayoutBlock } from "./courseTextImageLayout";
import { isTextVideoLayoutBlock } from "./courseTextVideoLayout";
import { isThreeVideosLayoutBlock } from "./courseThreeVideosLayout";
import { isTwoVideosLayoutBlock } from "./courseTwoVideosLayout";

type LessonRecord = Record<string, unknown>;

export type MovedComponentRef = {
  blockSlug: string;
  legacyComponentId: number;
  type: string;
};

export type ContentMoveTarget = MovedComponentRef;

export function maxLegacyComponentIdAcrossLessons(lessons: LessonRecord[]): number {
  return maxLegacyComponentIdFromLessons(
    lessons as { blocks: { components: { legacyComponentId: number }[] }[] }[],
  );
}

export function nextLegacyComponentId(lessons: LessonRecord[]): number {
  return maxLegacyComponentIdAcrossLessons(lessons) + 1;
}

export function nextAssignIdInLesson(lesson: LessonRecord): number {
  let max = 0;
  for (const block of sortedBlocks(lesson as CourseLesson)) {
    const assignId = Number((block.legacy as Record<string, unknown> | undefined)?.assignId);
    if (Number.isFinite(assignId) && assignId > max) max = assignId;
  }
  return max + 1;
}

export function nextBlockOrderInLesson(lesson: LessonRecord): number {
  let max = 0;
  for (const block of sortedBlocks(lesson as CourseLesson)) {
    const order = Number(block.order);
    if (Number.isFinite(order) && order > max) max = order;
  }
  return max + 1;
}

function numericOrder(value: unknown): number {
  const order = Number(value);
  return Number.isFinite(order) ? order : 0;
}

function compareStoredOrder(
  orderA: number,
  orderB: number,
  slotA: number,
  slotB: number,
  indexA: number,
  indexB: number,
): number {
  if (orderA !== orderB) return orderA - orderB;
  if (slotA !== slotB) return slotA - slotB;
  return indexA - indexB;
}

/**
 * Make the stored arrays match the order students and the editor already
 * display. Order fields win. Equal orders keep their current relative
 * position, then legacy slot.
 */
export function syncLessonArraysToStoredOrder(lesson: CourseLesson): void {
  const blocks = Array.isArray(lesson.blocks) ? lesson.blocks : [];
  const orderedBlocks = blocks
    .map((block, index) => ({ block, index }))
    .sort((a, b) =>
      compareStoredOrder(
        numericOrder(a.block.order),
        numericOrder(b.block.order),
        0,
        0,
        a.index,
        b.index,
      ),
    )
    .map((entry) => entry.block);

  for (const block of orderedBlocks) {
    const components = Array.isArray(block.components) ? block.components : [];
    block.components = components
      .map((component, index) => ({ component, index }))
      .sort((a, b) =>
        compareStoredOrder(
          numericOrder(a.component.order),
          numericOrder(b.component.order),
          numericOrder(
            (a.component as { legacySlot?: unknown }).legacySlot,
          ),
          numericOrder(
            (b.component as { legacySlot?: unknown }).legacySlot,
          ),
          a.index,
          b.index,
        ),
      )
      .map((entry) => entry.component);
  }

  lesson.blocks = orderedBlocks;
}

/** Write unique 1-based orders from the arrays' current positions. */
export function assignLessonOrdersFromArrayPosition(lesson: CourseLesson): void {
  lesson.blocks.forEach((block, blockIndex) => {
    block.order = blockIndex + 1;
    block.components.forEach((component, componentIndex) => {
      component.order = componentIndex + 1;
    });
  });
}

/** Insert a new single-component block before or after `targetBlockSlug`. */
export function insertStandaloneComponentBlockRelative(
  lesson: LessonRecord,
  component: Record<string, unknown>,
  targetBlockSlug: string,
  after: boolean,
  timestamp = Date.now(),
): LessonRecord {
  const typed = lesson as unknown as CourseLesson;
  syncLessonArraysToStoredOrder(typed);

  const newBlock: LessonRecord = {
    title: "Content",
    slug: `content-${timestamp}`,
    order: 1,
    legacy: { assignId: nextAssignIdInLesson(lesson), blockType: "HTML" },
    components: [{ ...component, order: 1 }],
  };

  if (!Array.isArray(lesson.blocks)) lesson.blocks = [];
  const blocks = lesson.blocks as LessonRecord[];
  const targetIndex = targetBlockSlug
    ? blocks.findIndex((block) => block.slug === targetBlockSlug)
    : -1;
  const insertAt =
    targetIndex === -1 ? blocks.length : after ? targetIndex + 1 : targetIndex;
  blocks.splice(insertAt, 0, newBlock);
  lesson.blocks = blocks;
  assignLessonOrdersFromArrayPosition(typed);
  return newBlock;
}

/** @deprecated Prefer insertStandaloneComponentBlockRelative */
export function insertStandaloneComponentBlock(
  lesson: LessonRecord,
  component: Record<string, unknown>,
  afterBlockSlug: string,
  timestamp = Date.now(),
): LessonRecord {
  return insertStandaloneComponentBlockRelative(
    lesson,
    component,
    afterBlockSlug,
    true,
    timestamp,
  );
}

export function appendStandaloneComponentBlock(
  lesson: LessonRecord,
  component: Record<string, unknown>,
  timestamp = Date.now(),
): LessonRecord {
  const blocks = sortedBlocks(lesson as CourseLesson);
  const anchorSlug = blocks.length > 0 ? String(blocks[blocks.length - 1]!.slug ?? "") : "";
  return insertStandaloneComponentBlock(lesson, component, anchorSlug, timestamp);
}

export function createRichTextComponent(lessons: LessonRecord[]): Record<string, unknown> {
  return {
    type: "richText",
    html: "<p></p>",
    legacyComponentId: nextLegacyComponentId(lessons),
    order: 1,
  };
}

export function isEditorLayoutBlock(block: LessonRecord): boolean {
  return (
    isTextVideoLayoutBlock(block) ||
    isTextImageLayoutBlock(block) ||
    isThreeVideosLayoutBlock(block) ||
    isTwoVideosLayoutBlock(block) ||
    isAccordionLayoutBlock(block) ||
    isEmbeddedToolLayoutBlock(block)
  );
}

/** One sidebar item backed by a single non-layout component in its own block. */
export function isPlainStandaloneBlock(lesson: CourseLesson, blockSlug: string): boolean {
  const block = lesson.blocks.find((entry) => entry.slug === blockSlug);
  if (!block || isEditorLayoutBlock(block as LessonRecord)) return false;
  return block.components.length === 1;
}

export function findBlockContainingComponent(
  lesson: CourseLesson,
  legacyComponentId: number,
  type: string,
): LessonRecord | null {
  for (const block of lesson.blocks) {
    const match = block.components.find(
      (component) =>
        component.legacyComponentId === legacyComponentId && component.type === type,
    );
    if (match) return block as LessonRecord;
  }
  return null;
}

/** Move an entire section (block) up or down relative to adjacent sections. */
export function moveSectionByOffset(
  lesson: LessonRecord,
  blockSlug: string,
  delta: -1 | 1,
): boolean {
  if (!Array.isArray(lesson.blocks)) return false;

  const ordered = sortedBlocks(lesson as CourseLesson);
  const fromIndex = ordered.findIndex((block) => String(block.slug ?? "") === blockSlug);
  return moveSectionAtIndex(lesson, fromIndex, delta);
}

/** Move a section by its 0-based position in sorted display order. */
export function moveSectionAtIndex(
  lesson: LessonRecord,
  sectionIndex: number,
  delta: -1 | 1,
): boolean {
  const typed = lesson as unknown as CourseLesson;
  syncLessonArraysToStoredOrder(typed);
  if (!Array.isArray(lesson.blocks)) return false;
  if (!Number.isInteger(sectionIndex)) return false;

  const ordered = lesson.blocks as CourseLesson["blocks"];
  if (sectionIndex < 0 || sectionIndex >= ordered.length) return false;

  const toIndex = sectionIndex + delta;
  if (toIndex < 0 || toIndex >= ordered.length) return false;

  const [moved] = ordered.splice(sectionIndex, 1);
  if (!moved) return false;
  ordered.splice(toIndex, 0, moved);

  assignLessonOrdersFromArrayPosition(typed);
  return true;
}

export function moveBlockRelativeToTarget(
  lesson: LessonRecord,
  blockSlug: string,
  targetBlockSlug: string,
  moveDown: boolean,
) {
  const typed = lesson as unknown as CourseLesson;
  syncLessonArraysToStoredOrder(typed);
  if (!Array.isArray(lesson.blocks)) return;
  const blocks = lesson.blocks as LessonRecord[];
  const fromIndex = blocks.findIndex((block) => block.slug === blockSlug);
  if (fromIndex === -1) return;
  const [moved] = blocks.splice(fromIndex, 1);
  if (!moved) return;

  let targetIndex = blocks.findIndex((block) => block.slug === targetBlockSlug);
  if (targetIndex === -1) {
    blocks.push(moved);
  } else {
    if (moveDown) targetIndex += 1;
    blocks.splice(targetIndex, 0, moved);
  }

  assignLessonOrdersFromArrayPosition(typed);
}

function removeComponentFromBlockRecord(
  lesson: CourseLesson,
  blockSlug: string,
  legacyComponentId: number,
  type: string,
): Record<string, unknown> | null {
  const blockIndex = lesson.blocks.findIndex((block) => block.slug === blockSlug);
  if (blockIndex === -1) return null;
  const block = lesson.blocks[blockIndex]!;
  const componentIndex = block.components.findIndex(
    (component) =>
      component.legacyComponentId === legacyComponentId && component.type === type,
  );
  if (componentIndex === -1) return null;
  const [removed] = block.components.splice(componentIndex, 1);
  if (!removed) return null;
  if (block.components.length === 0) {
    lesson.blocks.splice(blockIndex, 1);
  }
  return removed as Record<string, unknown>;
}

export function pruneEmptyBlocks(lesson: CourseLesson) {
  lesson.blocks = lesson.blocks.filter((block) => block.components.length > 0);
}

/**
 * Compact every section and block onto unique orders without changing the
 * sequence already stored in the order fields.
 */
export function reassignAllContentOrders(lesson: CourseLesson) {
  syncLessonArraysToStoredOrder(lesson);
  assignLessonOrdersFromArrayPosition(lesson);
}

/**
 * Move a plain (non-layout) content item without merging blocks.
 * Each sidebar item keeps its own block and section title.
 */
export function movePlainContentComponent(
  lesson: CourseLesson,
  current: ContentMoveTarget,
  target: ContentMoveTarget,
  moveDown: boolean,
  timestamp = Date.now(),
): MovedComponentRef | null {
  syncLessonArraysToStoredOrder(lesson);
  if (
    isPlainStandaloneBlock(lesson, current.blockSlug) &&
    isPlainStandaloneBlock(lesson, target.blockSlug) &&
    current.blockSlug !== target.blockSlug
  ) {
    moveBlockRelativeToTarget(lesson, current.blockSlug, target.blockSlug, moveDown);
    return { ...current };
  }

  const comp = removeComponentFromBlockRecord(
    lesson,
    current.blockSlug,
    current.legacyComponentId,
    current.type,
  );
  if (!comp) return null;

  pruneEmptyBlocks(lesson);

  if (current.blockSlug === target.blockSlug) {
    const block = lesson.blocks.find((entry) => entry.slug === target.blockSlug);
    if (!block) return null;
    const targetIdx = block.components.findIndex(
      (component) =>
        component.legacyComponentId === target.legacyComponentId &&
        component.type === target.type,
    );
    if (targetIdx === -1) return null;
    const insertAt = moveDown ? targetIdx + 1 : targetIdx;
    block.components.splice(insertAt, 0, comp as (typeof block.components)[number]);
    assignLessonOrdersFromArrayPosition(lesson);
    return { ...current };
  }

  const newBlock = insertStandaloneComponentBlockRelative(
    lesson,
    comp,
    target.blockSlug,
    moveDown,
    timestamp,
  );
  return {
    blockSlug: String(newBlock.slug),
    legacyComponentId: Number(comp.legacyComponentId),
    type: String(comp.type),
  };
}

export function moveComponentBesideBlock(
  lesson: CourseLesson,
  current: ContentMoveTarget,
  targetBlockSlug: string,
  moveDown: boolean,
  timestamp = Date.now(),
): MovedComponentRef | null {
  const comp = removeComponentFromBlockRecord(
    lesson,
    current.blockSlug,
    current.legacyComponentId,
    current.type,
  );
  if (!comp) return null;

  pruneEmptyBlocks(lesson);
  const newBlock = insertStandaloneComponentBlockRelative(
    lesson,
    comp,
    targetBlockSlug,
    moveDown,
    timestamp,
  );
  return {
    blockSlug: String(newBlock.slug),
    legacyComponentId: Number(comp.legacyComponentId),
    type: String(comp.type),
  };
}

/**
 * Turn a multi-component section into one block per piece (each with its own heading).
 * Reassigns duplicate legacyComponentIds inside the block.
 */
export function splitBlockIntoStandaloneSections(
  lesson: CourseLesson,
  blockSlug: string,
  lessonsForIdScope: LessonRecord[],
): boolean {
  syncLessonArraysToStoredOrder(lesson);
  const blockIndex = lesson.blocks.findIndex((block) => block.slug === blockSlug);
  if (blockIndex === -1) return false;

  const source = lesson.blocks[blockIndex]!;
  if (isEditorLayoutBlock(source as LessonRecord)) return false;
  if (source.components.length <= 1) return false;

  const sectionTitle = String(source.title ?? "Content");
  const baseLegacy = source.legacy ? { ...source.legacy } : { blockType: "HTML" };
  const assignedIds = new Set<number>();
  let nextId = nextLegacyComponentId(lessonsForIdScope);

  const replacementBlocks: CourseLesson["blocks"] = [];
  const timestamp = Date.now();

  source.components.forEach((component, index) => {
    let legacyComponentId = Number(component.legacyComponentId);
    if (!Number.isFinite(legacyComponentId) || assignedIds.has(legacyComponentId)) {
      while (assignedIds.has(nextId)) nextId += 1;
      legacyComponentId = nextId;
      nextId += 1;
    }
    assignedIds.add(legacyComponentId);

    const draftLesson = {
      ...lesson,
      blocks: [
        ...lesson.blocks.slice(0, blockIndex),
        ...replacementBlocks,
      ],
    } as CourseLesson;

    replacementBlocks.push({
      title: sectionTitle,
      slug: index === 0 ? source.slug : `content-${timestamp + index}`,
      order: blockIndex + index + 1,
      legacy: {
        ...baseLegacy,
        assignId: nextAssignIdInLesson(draftLesson as unknown as LessonRecord),
      },
      components: [
        {
          ...component,
          legacyComponentId,
          order: 1,
        },
      ],
    });
  });

  lesson.blocks.splice(blockIndex, 1, ...replacementBlocks);
  assignLessonOrdersFromArrayPosition(lesson);
  return true;
}

/**
 * Insert a component into a plain section.
 * With an anchor, it is placed immediately after that component.
 * Without an anchor, it is placed at the end of the section.
 */
export function insertComponentIntoBlockRelative(
  lesson: CourseLesson,
  blockSlug: string,
  component: Record<string, unknown>,
  afterLegacyComponentId: number | null = null,
  afterType: string | null = null,
): boolean {
  syncLessonArraysToStoredOrder(lesson);
  const block = lesson.blocks.find((entry) => entry.slug === blockSlug);
  if (!block || isEditorLayoutBlock(block as LessonRecord)) return false;

  let insertAt = block.components.length;
  if (afterLegacyComponentId != null && afterType) {
    const anchor = block.components.findIndex(
      (entry) =>
        entry.legacyComponentId === afterLegacyComponentId && entry.type === afterType,
    );
    if (anchor !== -1) insertAt = anchor + 1;
  }

  block.components.splice(
    insertAt,
    0,
    component as (typeof block.components)[number],
  );
  assignLessonOrdersFromArrayPosition(lesson);
  return true;
}

/** Append a new component to an existing plain (non-layout) section. */
export function appendComponentToBlock(
  lesson: CourseLesson,
  blockSlug: string,
  component: Record<string, unknown>,
): boolean {
  return insertComponentIntoBlockRelative(lesson, blockSlug, component, null, null);
}

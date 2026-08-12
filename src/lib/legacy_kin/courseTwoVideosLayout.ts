/** Two Videos layout: optional intro, two side-by-side videos, optional captions/outro. */

import {
  richTextHasVisibleContent,
  sortedBlockComponents,
  unwrapTextVideoColumnHtml,
} from "./courseTextVideoLayout";

export { richTextHasVisibleContent, unwrapTextVideoColumnHtml };

export const TWO_VIDEOS_LAYOUT_TYPE = "twoVideosLayout";
export const TWO_VIDEOS_EDITOR_LAYOUT = "twoVideosSideBySide";
export const TWO_VIDEOS_INTRO_ROLE = "twoVideosIntro";
export const TWO_VIDEOS_OUTRO_ROLE = "twoVideosOutro";

export function twoVideosVideoRole(slot: 1 | 2): string {
  return `twoVideosVideo${slot}`;
}

export function twoVideosCaptionRole(slot: 1 | 2): string {
  return `twoVideosCaption${slot}`;
}

type BlockLike = {
  slug?: string;
  components?: unknown[];
  legacy?: Record<string, unknown>;
};

type ComponentLike = Record<string, unknown>;

export type TwoVideosSlot = {
  video: ComponentLike;
  caption: ComponentLike | null;
};

export type TwoVideosLayoutParts = {
  intro: ComponentLike | null;
  slots: [TwoVideosSlot, TwoVideosSlot];
  outro: ComponentLike | null;
};

function findByRole(components: ComponentLike[], role: string): ComponentLike | null {
  return components.find((c) => c.layoutRole === role) ?? null;
}

function slotFromBlock(components: ComponentLike[], slot: 1 | 2): TwoVideosSlot {
  const video =
    findByRole(components, twoVideosVideoRole(slot)) ??
    components.filter((c) => c.type === "video")[slot - 1];
  if (!video) {
    throw new Error(`Missing video slot ${slot}`);
  }
  return {
    video,
    caption: findByRole(components, twoVideosCaptionRole(slot)),
  };
}

/**
 * Opt-in only via legacy.editorLayout or layoutRole markers.
 * Do not auto-detect plain two-video blocks without those markers.
 */
export function isTwoVideosLayoutBlock(block: BlockLike): boolean {
  const legacy = block.legacy;
  if (legacy?.editorLayout === TWO_VIDEOS_EDITOR_LAYOUT) return true;

  const components = sortedBlockComponents(block);
  const videos = components.filter((c) => c.type === "video");
  if (videos.length !== 2) return false;

  return components.some(
    (c) =>
      c.layoutRole === TWO_VIDEOS_INTRO_ROLE ||
      c.layoutRole === twoVideosVideoRole(1) ||
      c.layoutRole === twoVideosVideoRole(2),
  );
}

export function getTwoVideosLayoutParts(block: BlockLike): TwoVideosLayoutParts | null {
  if (!isTwoVideosLayoutBlock(block)) return null;

  const components = sortedBlockComponents(block);
  try {
    return {
      intro: findByRole(components, TWO_VIDEOS_INTRO_ROLE),
      slots: [slotFromBlock(components, 1), slotFromBlock(components, 2)],
      outro: findByRole(components, TWO_VIDEOS_OUTRO_ROLE),
    };
  } catch {
    return null;
  }
}

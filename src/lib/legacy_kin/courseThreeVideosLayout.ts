/** Three Videos with Text: intro richText, three side-by-side videos, optional outro. */

import {
  richTextHasVisibleContent,
  sortedBlockComponents,
  unwrapTextVideoColumnHtml,
} from "./courseTextVideoLayout";

export { richTextHasVisibleContent, unwrapTextVideoColumnHtml };

export const THREE_VIDEOS_LAYOUT_TYPE = "threeVideosLayout";
export const THREE_VIDEOS_EDITOR_LAYOUT = "threeVideosWithText";
export const THREE_VIDEOS_INTRO_ROLE = "threeVideosIntro";
export const THREE_VIDEOS_OUTRO_ROLE = "threeVideosOutro";

export function threeVideosVideoRole(slot: 1 | 2 | 3): string {
  return `threeVideosVideo${slot}`;
}

export function threeVideosCaptionRole(slot: 1 | 2 | 3): string {
  return `threeVideosCaption${slot}`;
}

type BlockLike = {
  slug?: string;
  components?: unknown[];
  legacy?: Record<string, unknown>;
};

type ComponentLike = Record<string, unknown>;

export type ThreeVideosSlot = {
  video: ComponentLike;
  caption: ComponentLike | null;
};

export type ThreeVideosLayoutParts = {
  intro: ComponentLike | null;
  slots: [ThreeVideosSlot, ThreeVideosSlot, ThreeVideosSlot];
  outro: ComponentLike | null;
};

function findByRole(components: ComponentLike[], role: string): ComponentLike | null {
  return components.find((c) => c.layoutRole === role) ?? null;
}

function slotFromBlock(components: ComponentLike[], slot: 1 | 2 | 3): ThreeVideosSlot {
  const video =
    findByRole(components, threeVideosVideoRole(slot)) ??
    components.filter((c) => c.type === "video")[slot - 1];
  if (!video) {
    throw new Error(`Missing video slot ${slot}`);
  }
  return {
    video,
    caption: findByRole(components, threeVideosCaptionRole(slot)),
  };
}

export function isThreeVideosLayoutBlock(block: BlockLike): boolean {
  const legacy = block.legacy;
  if (legacy?.editorLayout === THREE_VIDEOS_EDITOR_LAYOUT) return true;

  const components = sortedBlockComponents(block);
  const videos = components.filter((c) => c.type === "video");
  if (videos.length !== 3) return false;

  return components.some(
    (c) =>
      c.layoutRole === THREE_VIDEOS_INTRO_ROLE ||
      c.layoutRole === threeVideosVideoRole(1),
  );
}

export function getThreeVideosLayoutParts(block: BlockLike): ThreeVideosLayoutParts | null {
  if (!isThreeVideosLayoutBlock(block)) return null;

  const components = sortedBlockComponents(block);
  try {
    return {
      intro: findByRole(components, THREE_VIDEOS_INTRO_ROLE),
      slots: [
        slotFromBlock(components, 1),
        slotFromBlock(components, 2),
        slotFromBlock(components, 3),
      ],
      outro: findByRole(components, THREE_VIDEOS_OUTRO_ROLE),
    };
  } catch {
    return null;
  }
}

export function threeVideosLayoutSummary(parts: ThreeVideosLayoutParts): string {
  const introHtml = String(parts.intro?.html ?? "");
  const introText = introHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const introPreview = introText
    ? introText.length > 40
      ? `${introText.slice(0, 40)}…`
      : introText
    : "No intro";

  const videoLabels = parts.slots.map((slot, i) => {
    const title = slot.video.title ? String(slot.video.title) : "";
    const id = String(slot.video.vimeoId ?? "").trim();
    return title || (id ? `Video ${i + 1}: ${id}` : `Video ${i + 1}`);
  });

  const outroNote =
    parts.outro && richTextHasVisibleContent(String(parts.outro.html ?? ""))
      ? " · + text below"
      : "";

  return `${introPreview} · ${videoLabels.join(" · ")}${outroNote}`;
}

export const DEFAULT_THREE_VIDEOS_INTRO_HTML = `<p>
    Optional introductory text goes here. Explain what students should watch for before viewing the videos.
</p>`;

export const DEFAULT_THREE_VIDEOS_CAPTION_HTML =
  "<p>\n    Optional caption or notes.\n</p>";

export const DEFAULT_THREE_VIDEOS_OUTRO_HTML = `<p>
    Optional text below the videos. Summarize key points, compare techniques, or provide an exercise/challenge.
</p>`;

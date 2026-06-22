/** Text + Video layout: one block with richText + video (+ optional bottom richText). */

export const TEXT_VIDEO_LAYOUT_TYPE = "textVideoLayout";
export const TEXT_VIDEO_LEFT_ROLE = "textVideoLeft";
export const TEXT_VIDEO_BOTTOM_ROLE = "textVideoBottom";

type BlockLike = {
  slug?: string;
  components?: unknown[];
  legacy?: Record<string, unknown>;
};

type ComponentLike = Record<string, unknown>;

export type TextVideoLayoutParts = {
  leftText: ComponentLike;
  video: ComponentLike;
  bottomText: ComponentLike | null;
};

export function sortedBlockComponents(block: BlockLike): ComponentLike[] {
  const components = Array.isArray(block.components) ? [...block.components] : [];
  return (components as ComponentLike[]).sort((a, b) => {
    const orderA = Number(a.order ?? 0);
    const orderB = Number(b.order ?? 0);
    if (orderA !== orderB) return orderA - orderB;
    const slotA = Number(a.legacySlot ?? 0);
    const slotB = Number(b.legacySlot ?? 0);
    if (slotA !== slotB) return slotA - slotB;
    return String(a.type).localeCompare(String(b.type));
  });
}

export function richTextHasVisibleContent(html: string): boolean {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim().length > 0;
}

const LAYOUT_WRAPPER_RE =
  /^<div[^>]*\bclass="[^"]*\b(?<cls>lesson-media-row|lesson-text)\b[^"]*"[^>]*>(?<inner>[\s\S]*)<\/div>\s*$/i;

/** Strip legacy layout wrappers from text stored before the composite block model. */
export function unwrapTextVideoColumnHtml(html: string): string {
  let trimmed = html.trim();
  if (!trimmed) return trimmed;

  for (let pass = 0; pass < 4; pass += 1) {
    const match = trimmed.match(LAYOUT_WRAPPER_RE);
    if (!match?.groups?.inner) break;

    const wrapperClass = match.groups.cls;
    const inner = match.groups.inner.trim();
    if (!inner) break;

    if (wrapperClass === "lesson-media-row" && /\blesson-video\b/i.test(inner)) {
      break;
    }

    trimmed = inner;
  }

  return trimmed;
}

/** True when a block is a text+video layout (2 or 3 components: richText, video, optional richText). */
export function isTextVideoLayoutBlock(block: BlockLike): boolean {
  const components = sortedBlockComponents(block);
  if (components.length < 2 || components.length > 3) return false;

  const videos = components.filter((c) => c.type === "video");
  const richTexts = components.filter((c) => c.type === "richText");
  const others = components.filter((c) => c.type !== "video" && c.type !== "richText");

  return others.length === 0 && videos.length === 1 && richTexts.length >= 1 && richTexts.length <= 2;
}

function resolveRichTextRoles(
  richTexts: ComponentLike[],
  video: ComponentLike,
): { leftText: ComponentLike; bottomText: ComponentLike | null } {
  let leftText: ComponentLike | undefined;
  let bottomText: ComponentLike | null = null;

  for (const rt of richTexts) {
    if (rt.layoutRole === TEXT_VIDEO_BOTTOM_ROLE) bottomText = rt;
    else if (rt.layoutRole === TEXT_VIDEO_LEFT_ROLE) leftText = rt;
  }

  if (leftText && richTexts.length === 1) {
    return { leftText, bottomText };
  }

  if (!leftText || (richTexts.length === 2 && !bottomText)) {
    const videoOrder = Number(video.order ?? 0);
    const ordered = [...richTexts].sort(
      (a, b) => Number(a.order ?? 0) - Number(b.order ?? 0),
    );
    leftText = ordered.find((rt) => Number(rt.order ?? 0) <= videoOrder) ?? ordered[0];
    bottomText =
      ordered.length > 1 ? ordered.find((rt) => rt !== leftText) ?? null : bottomText;
  }

  return { leftText: leftText!, bottomText };
}

export function getTextVideoLayoutParts(block: BlockLike): TextVideoLayoutParts | null {
  if (!isTextVideoLayoutBlock(block)) return null;
  const components = sortedBlockComponents(block);
  const video = components.find((c) => c.type === "video");
  if (!video) return null;

  const richTexts = components.filter((c) => c.type === "richText");
  const { leftText, bottomText } = resolveRichTextRoles(richTexts, video);
  if (!leftText) return null;

  return { leftText, video, bottomText };
}

/** @deprecated Use getTextVideoLayoutParts — left column text exposed as richText. */
export function getTextVideoPair(block: BlockLike): {
  richText: ComponentLike;
  video: ComponentLike;
} | null {
  const parts = getTextVideoLayoutParts(block);
  if (!parts) return null;
  return { richText: parts.leftText, video: parts.video };
}

export function textVideoLayoutSummary(parts: TextVideoLayoutParts): string {
  const html = String(parts.leftText.html ?? "");
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const textPreview = text
    ? text.length > 50
      ? `${text.slice(0, 50)}…`
      : text
    : "Empty text";
  const videoLabel = parts.video.title
    ? String(parts.video.title)
    : parts.video.vimeoId
      ? `Video ${parts.video.vimeoId}`
      : "No video yet";
  const bottomNote =
    parts.bottomText && richTextHasVisibleContent(String(parts.bottomText.html ?? ""))
      ? " · + text below"
      : "";
  return `${textPreview} · ${videoLabel}${bottomNote}`;
}

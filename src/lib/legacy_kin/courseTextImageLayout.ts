/** Text + Image layout: one block with richText + image side by side. */

import {
  richTextHasVisibleContent,
  sortedBlockComponents,
  unwrapTextVideoColumnHtml,
} from "./courseTextVideoLayout";

import {
  linkUrlHasContent,
  normalizeLinkUrl,
} from "./courseImageLink";

export { richTextHasVisibleContent, unwrapTextVideoColumnHtml };

export const TEXT_IMAGE_LAYOUT_TYPE = "textImageLayout";
export const TEXT_IMAGE_TEXT_ROLE = "textImageText";
export const TEXT_IMAGE_IMAGE_ROLE = "textImageImage";

export type ImagePosition = "left" | "right";

type BlockLike = {
  slug?: string;
  components?: unknown[];
  legacy?: Record<string, unknown>;
  layoutOptions?: Record<string, unknown>;
};

type ComponentLike = Record<string, unknown>;

export type TextImageLayoutParts = {
  text: ComponentLike;
  image: ComponentLike;
};

export function isTextImageLayoutBlock(block: BlockLike): boolean {
  const legacy = block.legacy;
  if (legacy?.editorLayout === "textImage") return true;

  const components = sortedBlockComponents(block);
  if (components.length !== 2) return false;

  const richTexts = components.filter((c) => c.type === "richText");
  const images = components.filter((c) => c.type === "image");
  return richTexts.length === 1 && images.length === 1;
}

export function getImagePosition(block: BlockLike): ImagePosition {
  const position = block.layoutOptions?.imagePosition;
  return position === "left" ? "left" : "right";
}

export function getLayoutHeader(block: BlockLike): string | null {
  const header = block.layoutOptions?.header;
  if (header === null || header === undefined) return null;
  const trimmed = String(header).trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function layoutHeaderHasContent(header: unknown): boolean {
  return String(header ?? "").trim().length > 0;
}

export function getTextImageLayoutParts(block: BlockLike): TextImageLayoutParts | null {
  if (!isTextImageLayoutBlock(block)) return null;

  const components = sortedBlockComponents(block);
  const text = components.find(
    (c) => c.type === "richText" && c.layoutRole !== TEXT_IMAGE_IMAGE_ROLE,
  );
  const image = components.find(
    (c) => c.type === "image" || c.layoutRole === TEXT_IMAGE_IMAGE_ROLE,
  );
  const richText = components.find((c) => c.type === "richText");

  const resolvedText =
    text ??
    (richText && richText !== image ? richText : components.find((c) => c.type === "richText"));
  const resolvedImage =
    image?.type === "image"
      ? image
      : components.find((c) => c.type === "image");

  if (!resolvedText || !resolvedImage) return null;

  return { text: resolvedText, image: resolvedImage };
}

export function textImageLayoutSummary(
  parts: TextImageLayoutParts,
  imagePosition: ImagePosition = "right",
  header: string | null = null,
): string {
  const html = String(parts.text.html ?? "");
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const textPreview = text
    ? text.length > 50
      ? `${text.slice(0, 50)}…`
      : text
    : "Empty text";

  const src = String(parts.image.src ?? "").trim();
  const alt = String(parts.image.alt ?? "").trim();
  const imageLabel = alt || (src ? src.split("/").pop() ?? src : "No image yet");
  const positionNote = imagePosition === "left" ? " · image left" : " · image right";

  const caption = String(parts.image.caption ?? "").trim();
  const captionNote = caption ? " · caption" : "";
  const linkNote = linkUrlHasContent(parts.image.linkUrl) ? " · link" : "";
  const headerNote = header ? `${header} · ` : "";

  return `${headerNote}${textPreview} · ${imageLabel}${positionNote}${captionNote}${linkNote}`;
}

export function imageLinkUrlHasContent(linkUrl: unknown): boolean {
  return linkUrlHasContent(linkUrl);
}

export function normalizeImageLinkUrl(linkUrl: unknown): string | undefined {
  return normalizeLinkUrl(linkUrl);
}

export function imageCaptionHasContent(caption: unknown): boolean {
  return String(caption ?? "").trim().length > 0;
}

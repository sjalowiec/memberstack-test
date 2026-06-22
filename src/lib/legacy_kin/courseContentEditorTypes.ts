/** Friendly editor labels — never show schema names like richText in the main UI. */

/** Editor-only composite type; stored on disk as richText + video in one block. */
export const TEXT_VIDEO_LAYOUT_TYPE = "textVideoLayout";

/** Editor-only composite type; stored on disk as richText + image in one block. */
export const TEXT_IMAGE_LAYOUT_TYPE = "textImageLayout";

export type EditorContentKind =
  | "richText"
  | "video"
  | "textVideoLayout"
  | "textImageLayout"
  | "image"
  | "imageWithCaption"
  | "download"
  | "exerciseAccordion"
  | "imageGallery"
  | "imageCarousel"
  | "migrationPending";

export const EDITOR_TYPE_META: Record<
  EditorContentKind,
  { label: string; color: string; abbrev: string }
> = {
  richText: { label: "Text", color: "#5b6b8a", abbrev: "T" },
  video: { label: "Video", color: "#9a4b6b", abbrev: "V" },
  textVideoLayout: { label: "Text + Video Layout", color: "#4a6741", abbrev: "TV" },
  textImageLayout: { label: "Text + Image Layout", color: "#4a5568", abbrev: "TI" },
  image: { label: "Image", color: "#5a7080", abbrev: "I" },
  imageWithCaption: { label: "Image with Caption", color: "#5a7080", abbrev: "IC" },
  download: { label: "Download", color: "#3f7a6a", abbrev: "D" },
  exerciseAccordion: { label: "Accordion", color: "#a06a2c", abbrev: "A" },
  imageGallery: { label: "Gallery", color: "#6a5aa0", abbrev: "G" },
  imageCarousel: { label: "Image Carousel", color: "#7a4a8a", abbrev: "C" },
  migrationPending: { label: "Pending", color: "#64748b", abbrev: "?" },
};

export type ComponentRef = {
  blockSlug: string;
  legacyComponentId: number;
  type: string;
  /** Paired component id when type is textVideoLayout (video) or textImageLayout (image) */
  pairedLegacyComponentId?: number;
  /** Intro richText component id when accordion layout includes intro text */
  introLegacyComponentId?: number;
};

export type FlatContentItem = ComponentRef & {
  component: Record<string, unknown>;
};

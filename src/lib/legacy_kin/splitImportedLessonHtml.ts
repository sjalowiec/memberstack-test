import { slugifyLessonPart } from "./courseContentSplitIds";
import { richTextHasVisibleContent } from "./courseTextVideoLayout";
import type {
  CourseBlock,
  CourseComponent,
  CourseLesson,
  DownloadComponent,
  ExerciseAccordionComponent,
  ImageComponent,
  ImageGalleryComponent,
  RichTextComponent,
  VideoComponent,
} from "./coursePreviewPoc";
import { isLessonSplitAllowed } from "./courseLessonPublicRenderer";

export const CONTENT_SPLIT_CLEANUP_FLAG = "contentSplitCleanup";
export const MIN_SPLITTABLE_HTML_LENGTH = 280;
export const MIN_SPLIT_SEGMENTS = 2;

export type SplitBoundaryType =
  | "heading"
  | "blockquote"
  | "horizontalRule"
  | "videoEmbed"
  | "download"
  | "details"
  | "legacyDiv";

export type HtmlSegment = {
  html: string;
  boundaryType?: SplitBoundaryType;
  suggestedTitle?: string;
};

export type ClassifiedSegment = {
  components: CourseComponent[];
  blockTitle?: string;
  detectedTypes: string[];
  warnings: string[];
};

export type SplitBlockResult = {
  blocks: CourseBlock[];
  originalBlockCount: number;
  newBlockCount: number;
  detectedTypes: string[];
  warnings: string[];
  skipped: boolean;
  skipReason?: string;
};

export type SplitLessonAnalysis = {
  lessonSlug: string;
  lessonTitle: string;
  originalBlockCount: number;
  projectedBlockCount: number;
  splittableBlocks: number;
  detectedTypes: string[];
  warnings: string[];
  wouldChange: boolean;
  alreadyCleaned: boolean;
};

const HEADING_OPEN_RE = /<h([2-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi;
const BLOCKQUOTE_OPEN_RE = /<blockquote\b/gi;
const HR_RE = /<hr\b/gi;
const IFRAME_RE = /<iframe\b[^>]*(?:vimeo|player\.vimeo)[^>]*>/gi;
const EMBED_VIDEO_DIV_RE = /<div\b[^>]*class="[^"]*\bembed-video-container\b[^"]*"[^>]*>/gi;
const DETAILS_RE = /<details\b/gi;
const DOWNLOAD_LINK_RE =
  /<a\b[^>]*\bhref=(["'])([^"']+\.pdf[^"']*)\1[^>]*>([\s\S]*?)<\/a>/gi;
const DOWNLOAD_BTN_RE =
  /<a\b[^>]*\bclass="[^"]*\b(?:kbm-btn|btn)[^"]*"[^>]*\bhref=(["'])([^"']+\.pdf[^"']*)\1[^>]*>[\s\S]*?<\/a>/gi;
const IMG_RE = /<img\b[^>]*>/gi;
const LEGACY_DIV_RE =
  /<div\b[^>]*class="[^"]*\b(?:well_white|well\b|panel(?:-[a-z0-9_-]+)?|lesson-tip|lead\b|table-responsive)\b[^"]*"[^>]*>/gi;
const VIMEO_ID_RE = /player\.vimeo\.com\/video\/(\d+)/i;
const VIMEO_TITLE_RE = /<iframe\b[^>]*title=(["'])(.*?)\1/i;

const BOUNDARY_SCANNERS: {
  type: SplitBoundaryType;
  re: RegExp;
  titleFromHtml?: (html: string) => string | undefined;
}[] = [
  { type: "heading", re: /<h[2-4]\b/gi, titleFromHtml: titleFromHeadingTag },
  { type: "blockquote", re: BLOCKQUOTE_OPEN_RE },
  { type: "horizontalRule", re: HR_RE },
  { type: "videoEmbed", re: EMBED_VIDEO_DIV_RE },
  { type: "videoEmbed", re: IFRAME_RE },
  { type: "download", re: DOWNLOAD_BTN_RE },
  { type: "download", re: DOWNLOAD_LINK_RE },
  { type: "details", re: DETAILS_RE },
  { type: "legacyDiv", re: LEGACY_DIV_RE },
];

function titleFromHeadingTag(html: string): string | undefined {
  const match = html.match(/<h[2-4]\b[^>]*>([\s\S]*?)<\/h[2-4]>/i);
  if (!match) return undefined;
  const text = stripTags(match[1] ?? "").trim();
  return text || undefined;
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function cloneRegExp(re: RegExp): RegExp {
  return new RegExp(re.source, re.flags);
}

export function countSplitBoundaries(html: string): number {
  const indices = collectBoundaryIndices(html);
  return indices.length;
}

function collectBoundaryIndices(html: string): number[] {
  const indices = new Set<number>();

  for (const scanner of BOUNDARY_SCANNERS) {
    const re = cloneRegExp(scanner.re);
    let match: RegExpExecArray | null;
    while ((match = re.exec(html)) !== null) {
      const index = match.index;
      if (index <= 0) continue;
      indices.add(index);
    }
  }

  return [...indices].sort((a, b) => a - b);
}

function unwrapSingleOuterDiv(html: string): string {
  const trimmed = html.trim();
  const match = trimmed.match(/^<div\b[^>]*>([\s\S]*)<\/div>\s*$/i);
  if (!match) return trimmed;
  return match[1]?.trim() ?? trimmed;
}

export function splitHtmlIntoSegments(html: string): HtmlSegment[] {
  const normalized = unwrapSingleOuterDiv(html);
  if (!normalized) return [];

  const indices = collectBoundaryIndices(normalized);
  if (indices.length === 0) {
    return [{ html: normalized }];
  }

  const segments: HtmlSegment[] = [];
  let start = 0;

  for (const index of indices) {
    if (index <= start) continue;
    const chunk = normalized.slice(start, index).trim();
    if (chunk) {
      segments.push({ html: chunk });
    }
    start = index;
  }

  const tail = normalized.slice(start).trim();
  if (tail) {
    const boundary = boundaryAtIndex(normalized, start);
    segments.push({
      html: tail,
      boundaryType: boundary?.type,
      suggestedTitle: boundary?.titleFromHtml?.(tail),
    });
  }

  return segments.filter((segment) => richTextHasVisibleContent(segment.html) || segment.html.includes("<img"));
}

function boundaryAtIndex(html: string, index: number) {
  for (const scanner of BOUNDARY_SCANNERS) {
    const re = cloneRegExp(scanner.re);
    let match: RegExpExecArray | null;
    while ((match = re.exec(html)) !== null) {
      if (match.index === index) return scanner;
    }
  }
  return undefined;
}

function extractVimeo(html: string): { video: VideoComponent | null; remainingHtml: string } {
  const iframeMatch = html.match(/<iframe\b[^>]*(?:vimeo|player\.vimeo)[^>]*>[\s\S]*?<\/iframe>/i);
  if (!iframeMatch) {
    const embedMatch = html.match(
      /<div\b[^>]*class="[^"]*\bembed-video-container\b[^"]*"[^>]*>[\s\S]*?<\/div>/i,
    );
    if (!embedMatch) return { video: null, remainingHtml: html };
    const vimeoId = embedMatch[0].match(VIMEO_ID_RE)?.[1];
    if (!vimeoId) return { video: null, remainingHtml: html };
    const remainingHtml = html.replace(embedMatch[0], "").trim();
    return {
      video: {
        type: "video",
        vimeoId,
        title: embedMatch[0].match(VIMEO_TITLE_RE)?.[2] ?? null,
        legacyComponentId: 0,
        order: 0,
      },
      remainingHtml,
    };
  }

  const vimeoId = iframeMatch[0].match(VIMEO_ID_RE)?.[1];
  if (!vimeoId) return { video: null, remainingHtml: html };
  const remainingHtml = html.replace(iframeMatch[0], "").trim();
  return {
    video: {
      type: "video",
      vimeoId,
      title: iframeMatch[0].match(VIMEO_TITLE_RE)?.[2] ?? null,
      legacyComponentId: 0,
      order: 0,
    },
    remainingHtml,
  };
}

function extractDownload(html: string): {
  download: Omit<DownloadComponent, "legacyComponentId" | "order"> | null;
  remainingHtml: string;
} {
  const match =
    html.match(DOWNLOAD_BTN_RE)?.[0] ??
    html.match(
      /<a\b[^>]*\bhref=(["'])([^"']+\.pdf[^"']*)\1[^>]*>([\s\S]*?)<\/a>/i,
    )?.[0];
  if (!match) return { download: null, remainingHtml: html };

  const hrefMatch = match.match(/\bhref=(["'])([^"']+)\1/i);
  const label = stripTags(match).trim() || "Download";
  const filename = hrefMatch?.[2]?.trim() ?? "";
  if (!filename.toLowerCase().includes(".pdf")) {
    return { download: null, remainingHtml: html };
  }

  return {
    download: {
      type: "download",
      label,
      filename: filename.startsWith("/") ? filename : `/${filename}`,
      showInline: true,
    },
    remainingHtml: html.replace(match, "").trim(),
  };
}

function isImageOnlySegment(html: string): boolean {
  const withoutImages = html.replace(/<img\b[^>]*>/gi, "").trim();
  return /<img\b/i.test(html) && !richTextHasVisibleContent(withoutImages);
}

function extractImages(html: string): {
  images: Omit<ImageComponent, "legacyComponentId" | "order">[];
  remainingHtml: string;
} {
  if (!isImageOnlySegment(html)) {
    return { images: [], remainingHtml: html };
  }

  const images: Omit<ImageComponent, "legacyComponentId" | "order">[] = [];
  const re = /<img\b[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const tag = match[0];
    const src = tag.match(/\bsrc=(["'])([^"']+)\1/i)?.[2]?.trim();
    if (!src) continue;
    images.push({
      type: "image",
      src,
      alt: tag.match(/\balt=(["'])([^"']*)\1/i)?.[2] ?? undefined,
    });
  }

  return {
    images,
    remainingHtml: html.replace(re, "").trim(),
  };
}

function extractDetailsAccordion(
  html: string,
): Omit<ExerciseAccordionComponent, "legacyComponentId" | "order"> | null {
  const detailsBlocks = html.match(/<details\b[\s\S]*?<\/details>/gi);
  if (!detailsBlocks?.length) return null;

  const sections = detailsBlocks.map((block) => {
    const title =
      stripTags(block.match(/<summary\b[^>]*>([\s\S]*?)<\/summary>/i)?.[1] ?? "") ||
      "Section";
    const bodyHtml = block
      .replace(/<summary\b[^>]*>[\s\S]*?<\/summary>/i, "")
      .replace(/<\/?details\b[^>]*>/gi, "")
      .trim();
    return { title, bodyHtml };
  });

  if (sections.length === 0) return null;
  return { type: "exerciseAccordion", sections };
}

export function classifyHtmlSegment(html: string): ClassifiedSegment {
  const warnings: string[] = [];
  const detectedTypes: string[] = [];
  const components: CourseComponent[] = [];
  let blockTitle = titleFromHeadingTag(html);
  let workingHtml = html.trim();

  const accordion = extractDetailsAccordion(workingHtml);
  if (accordion) {
    detectedTypes.push("exerciseAccordion");
    components.push({ ...accordion, legacyComponentId: 0, order: 1 });
    workingHtml = workingHtml.replace(/<details\b[\s\S]*?<\/details>/gi, "").trim();
  }

  const { video, remainingHtml: afterVideo } = extractVimeo(workingHtml);
  if (video) {
    detectedTypes.push("video");
    components.push(video);
    workingHtml = afterVideo;
  }

  const { download, remainingHtml: afterDownload } = extractDownload(workingHtml);
  if (download) {
    detectedTypes.push("download");
    components.push({ ...download, legacyComponentId: 0, order: components.length + 1 });
    workingHtml = afterDownload;
  }

  const { images, remainingHtml: afterImages } = extractImages(workingHtml);
  if (images.length >= 2) {
    detectedTypes.push("imageGallery");
    const gallery: ImageGalleryComponent = {
      type: "imageGallery",
      slides: images.map((image) => ({ src: image.src, caption: image.caption ?? null })),
      legacyComponentId: 0,
      order: components.length + 1,
    };
    components.push(gallery);
    workingHtml = afterImages;
  } else if (images.length === 1) {
    detectedTypes.push("image");
    components.push({
      ...images[0]!,
      legacyComponentId: 0,
      order: components.length + 1,
    });
    workingHtml = afterImages;
  }

  if (richTextHasVisibleContent(workingHtml)) {
    detectedTypes.push("richText");
    const richText: RichTextComponent = {
      type: "richText",
      html: workingHtml,
      legacyComponentId: 0,
      order: components.length + 1,
    };
    components.push(richText);
  } else if (components.length === 0) {
    detectedTypes.push("richText");
    components.push({
      type: "richText",
      html: workingHtml || html,
      legacyComponentId: 0,
      order: 1,
    });
    warnings.push("Segment had no recognizable structure; kept as Text block.");
  }

  if (workingHtml.includes("onclick=\"$('#")) {
    warnings.push("Legacy jQuery toggle button kept as Text (not converted to Accordion).");
  }

  components.forEach((component, index) => {
    component.order = index + 1;
  });

  return { components, blockTitle, detectedTypes, warnings };
}

export function isBlockAlreadySplit(block: CourseBlock): boolean {
  const legacy = block.legacy as Record<string, unknown> | undefined;
  return Boolean(legacy?.[CONTENT_SPLIT_CLEANUP_FLAG] || legacy?.contentSplitFrom);
}

export function isLessonAlreadySplit(lesson: CourseLesson): boolean {
  const legacy = lesson.legacy as Record<string, unknown> | undefined;
  if (legacy?.[CONTENT_SPLIT_CLEANUP_FLAG]) return true;
  return lesson.blocks.some((block) => isBlockAlreadySplit(block));
}

export function isSplittableRichTextBlock(block: CourseBlock): boolean {
  if (isBlockAlreadySplit(block)) return false;

  const richTexts = block.components.filter((component) => component.type === "richText");
  if (richTexts.length !== 1) return false;

  const richText = richTexts[0] as RichTextComponent;
  const html = String(richText.html ?? "");
  if (html.length < MIN_SPLITTABLE_HTML_LENGTH) return false;

  const boundaries = countSplitBoundaries(html);
  if (boundaries < MIN_SPLIT_SEGMENTS - 1) return false;

  const segments = splitHtmlIntoSegments(html);
  return segments.length >= MIN_SPLIT_SEGMENTS;
}

export function htmlTextContent(html: string): string {
  return stripTags(html.replace(/&nbsp;/gi, " ")).replace(/\s+/g, " ").trim();
}

export function verifyHtmlPreservation(originalHtml: string, segmentHtmls: string[]): boolean {
  const combined = segmentHtmls.join(" ");
  return htmlTextContent(originalHtml) === htmlTextContent(combined);
}

export function splitCourseBlock(
  block: CourseBlock,
  options: {
    nextLegacyComponentId: () => number;
    nextAssignId: () => number;
    force?: boolean;
  },
): SplitBlockResult {
  if (!options.force && isBlockAlreadySplit(block)) {
    return {
      blocks: [block],
      originalBlockCount: 1,
      newBlockCount: 1,
      detectedTypes: [],
      warnings: [],
      skipped: true,
      skipReason: "Block already marked as split.",
    };
  }

  if (!isSplittableRichTextBlock(block)) {
    return {
      blocks: [block],
      originalBlockCount: 1,
      newBlockCount: 1,
      detectedTypes: [],
      warnings: [],
      skipped: true,
      skipReason: "Block does not match splittable richText criteria.",
    };
  }

  const richText = block.components.find((component) => component.type === "richText") as RichTextComponent;
  const trailingComponents = block.components.filter((component) => component.type !== "richText");
  const segments = splitHtmlIntoSegments(String(richText.html ?? ""));

  if (segments.length < MIN_SPLIT_SEGMENTS) {
    return {
      blocks: [block],
      originalBlockCount: 1,
      newBlockCount: 1,
      detectedTypes: [],
      warnings: [],
      skipped: true,
      skipReason: "Split produced fewer than two segments.",
    };
  }

  if (!verifyHtmlPreservation(String(richText.html ?? ""), segments.map((segment) => segment.html))) {
    return {
      blocks: [block],
      originalBlockCount: 1,
      newBlockCount: 1,
      detectedTypes: [],
      warnings: ["Content preservation check failed; block left unchanged."],
      skipped: true,
      skipReason: "Content preservation check failed.",
    };
  }

  const detectedTypes = new Set<string>();
  const warnings: string[] = [];
  const newBlocks: CourseBlock[] = [];

  segments.forEach((segment, index) => {
    const classified = classifyHtmlSegment(segment.html);
    classified.detectedTypes.forEach((type) => detectedTypes.add(type));
    warnings.push(...classified.warnings);

    const components = classified.components.map((component) => ({
      ...component,
      legacyComponentId:
        index === 0 && component.type === "richText"
          ? richText.legacyComponentId
          : options.nextLegacyComponentId(),
    }));

    const partNumber = index + 1;
    const title =
      classified.blockTitle ??
      segment.suggestedTitle ??
      (segments.length > 1 ? `${block.title} (${partNumber})` : block.title);

    newBlocks.push({
      title,
      slug:
        partNumber === 1
          ? block.slug
          : slugifyLessonPart(block.slug, partNumber, title),
      order: block.order + index,
      legacy: {
        ...block.legacy,
        assignId: partNumber === 1 ? block.legacy.assignId : options.nextAssignId(),
        contentSplitFrom: block.slug,
        contentSplitPart: partNumber,
        [CONTENT_SPLIT_CLEANUP_FLAG]: true,
      },
      components,
    });
  });

  if (trailingComponents.length > 0) {
    const lastBlock = newBlocks[newBlocks.length - 1]!;
    lastBlock.components = [
      ...lastBlock.components,
      ...trailingComponents.map((component, index) => ({
        ...component,
        order: lastBlock.components.length + index + 1,
      })),
    ];
  }

  return {
    blocks: newBlocks,
    originalBlockCount: 1,
    newBlockCount: newBlocks.length,
    detectedTypes: [...detectedTypes],
    warnings,
    skipped: false,
  };
}

export function analyzeLessonSplit(
  lesson: CourseLesson,
  options: { force?: boolean } = {},
): SplitLessonAnalysis {
  const originalBlockCount = lesson.blocks.length;
  let projectedBlockCount = originalBlockCount;
  let splittableBlocks = 0;
  const detectedTypes = new Set<string>();
  const warnings: string[] = [];
  const alreadyCleaned = isLessonAlreadySplit(lesson);

  if (!isLessonSplitAllowed(lesson)) {
    return {
      lessonSlug: lesson.slug,
      lessonTitle: lesson.title,
      originalBlockCount,
      projectedBlockCount: originalBlockCount,
      splittableBlocks: 0,
      detectedTypes: [],
      warnings: [`Lesson "${lesson.slug}" is blocklisted from automated splitting.`],
      wouldChange: false,
      alreadyCleaned,
    };
  }

  if (!options.force && alreadyCleaned) {
    return {
      lessonSlug: lesson.slug,
      lessonTitle: lesson.title,
      originalBlockCount,
      projectedBlockCount: originalBlockCount,
      splittableBlocks: 0,
      detectedTypes: [],
      warnings: [],
      wouldChange: false,
      alreadyCleaned: true,
    };
  }

  for (const block of lesson.blocks) {
    if (!isSplittableRichTextBlock(block)) continue;
    splittableBlocks += 1;
    const richText = block.components.find((component) => component.type === "richText") as RichTextComponent;
    const segments = splitHtmlIntoSegments(String(richText.html ?? ""));
    projectedBlockCount += segments.length - 1;
    for (const segment of segments) {
      const classified = classifyHtmlSegment(segment.html);
      classified.detectedTypes.forEach((type) => detectedTypes.add(type));
      warnings.push(...classified.warnings);
    }
  }

  return {
    lessonSlug: lesson.slug,
    lessonTitle: lesson.title,
    originalBlockCount,
    projectedBlockCount,
    splittableBlocks,
    detectedTypes: [...detectedTypes],
    warnings,
    wouldChange: splittableBlocks > 0,
    alreadyCleaned,
  };
}

export function splitLessonBlocks(
  lesson: CourseLesson,
  options: {
    nextLegacyComponentId: () => number;
    nextAssignId: () => number;
    force?: boolean;
  },
): { lesson: CourseLesson; reports: SplitBlockResult[] } {
  if (!isLessonSplitAllowed(lesson)) {
    return { lesson, reports: [] };
  }

  if (!options.force && isLessonAlreadySplit(lesson)) {
    return { lesson, reports: [] };
  }

  const reports: SplitBlockResult[] = [];
  const nextBlocks: CourseBlock[] = [];
  let orderCounter = 1;

  for (const block of [...lesson.blocks].sort((a, b) => a.order - b.order)) {
    const result = splitCourseBlock(block, options);
    reports.push(result);
    for (const newBlock of result.blocks) {
      nextBlocks.push({ ...newBlock, order: orderCounter++ });
    }
  }

  const lessonLegacy = lesson.legacy as Record<string, unknown>;
  return {
    lesson: {
      ...lesson,
      blocks: nextBlocks,
      legacy: {
        ...lesson.legacy,
        [CONTENT_SPLIT_CLEANUP_FLAG]: true,
        contentSplitCleanupAt: new Date().toISOString(),
        contentSplitOriginalBlockCount: lesson.blocks.length,
      } as CourseLesson["legacy"],
    },
    reports,
  };
}

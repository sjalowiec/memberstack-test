import { applyKinCourseSrcRewrites } from "./htmlPresent";
import type { KinCourseComponent, KinCoursePresentation } from "./types";

/** Percent of image height: spots this close are the same visual row. */
export const NUMBERED_HOTSPOT_ROW_THRESHOLD = 6;

export type NumberedHotspotItem = {
  number: number;
  originalIndex: number;
  label: string;
  top: number;
  left: number;
};

export type NumberedHotspotRule = {
  lessonId: number;
  componentId: number;
  /** When false (default), keep interactive hotspot rendering. */
  enabled?: boolean;
  numberedSrc: string;
  alt: string;
  imageWidth?: number;
  imageHeight?: number;
  items: NumberedHotspotItem[];
};

export type SpotPosition = {
  index: number;
  text?: string;
  style?: string;
  top: number;
  left: number;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function parseSpotPercent(style: string | undefined, property: "top" | "left"): number {
  const match = new RegExp(`${property}:\\s*([\\d.]+)%`, "i").exec(style || "");
  return Number(match?.[1] || "NaN");
}

export function visualHotspotOrder(
  spots: Array<{ index: number; text?: string; style?: string }>,
  rowThreshold = NUMBERED_HOTSPOT_ROW_THRESHOLD,
): NumberedHotspotItem[] {
  const parsed: SpotPosition[] = spots
    .map((spot) => ({
      index: spot.index,
      text: spot.text,
      style: spot.style,
      top: parseSpotPercent(spot.style, "top"),
      left: parseSpotPercent(spot.style, "left"),
    }))
    .filter((spot) => Number.isFinite(spot.top) && Number.isFinite(spot.left))
    .sort((a, b) => a.top - b.top || a.left - b.left);

  const rows: SpotPosition[][] = [];
  for (const spot of parsed) {
    const row = rows[rows.length - 1];
    if (!row || spot.top - row[0]!.top > rowThreshold) rows.push([spot]);
    else row.push(spot);
  }

  const ordered: NumberedHotspotItem[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.left - b.left);
    for (const spot of row) {
      ordered.push({
        number: ordered.length + 1,
        originalIndex: spot.index,
        label: String(spot.text || "").trim(),
        top: spot.top,
        left: spot.left,
      });
    }
  }
  return ordered;
}

export function numberedHotspotFilename(originalSrc: string): string {
  const filename = originalSrc.split("/").pop() || "";
  const stem = filename.replace(/\.[^.]+$/, "");
  return `${stem}-numbered.png`;
}

export function numberedHotspotPublicPath(originalSrc: string, courseId = 86): string {
  return `/images/course-content/${courseId}/${numberedHotspotFilename(originalSrc)}`;
}

export function findNumberedHotspotRule(
  lessonId: number,
  component: Pick<KinCourseComponent, "componentId">,
  presentation: KinCoursePresentation = {},
): NumberedHotspotRule | undefined {
  const componentId = Number(component.componentId);
  return presentation.numberedHotspots?.find(
    (rule) => rule.lessonId === lessonId && Number(rule.componentId) === componentId,
  );
}

/**
 * True when presentation data opts this hotspot into the static numbered layout.
 * Do not `existsSync` files under `public/` here: @vercel/nft traces that as the
 * entire public tree and copies it into the Netlify SSR function.
 */
export function numberedHotspotReady(
  lessonId: number,
  component: Pick<KinCourseComponent, "componentId">,
  presentation: KinCoursePresentation = {},
): boolean {
  const rule = findNumberedHotspotRule(lessonId, component, presentation);
  if (!rule || rule.enabled !== true) return false;
  return typeof rule.numberedSrc === "string" && rule.numberedSrc.trim().length > 0;
}

export function presentHotspotComponent(
  lessonId: number,
  component: Pick<KinCourseComponent, "componentId">,
  presentation: KinCoursePresentation = {},
): { mode: "static"; html: string } | { mode: "interactive" } {
  const rule = findNumberedHotspotRule(lessonId, component, presentation);
  if (!rule || !numberedHotspotReady(lessonId, component, presentation)) {
    return { mode: "interactive" };
  }
  return { mode: "static", html: buildNumberedHotspotHtml(rule, presentation) };
}

export function buildNumberedHotspotHtml(
  rule: NumberedHotspotRule,
  presentation: KinCoursePresentation = {},
): string {
  const src = applyKinCourseSrcRewrites(rule.numberedSrc, presentation);
  const items = [...rule.items].sort((a, b) => a.number - b.number);
  const list = items
    .map((item) => `<li>${escapeHtml(item.label)}</li>`)
    .join("\n");
  const width = rule.imageWidth ? ` width="${rule.imageWidth}"` : "";
  const height = rule.imageHeight ? ` height="${rule.imageHeight}"` : "";
  return [
    '<div class="sk840-parts-id">',
    '<div class="sk840-parts-id__layout">',
    '<figure class="sk840-parts-id__media">',
    `<img src="${escapeHtml(src)}" alt="${escapeHtml(rule.alt)}"${width}${height} loading="eager" decoding="async">`,
    "</figure>",
    '<div class="sk840-parts-id__list">',
    `<ol class="legacy-hotspot-labels sk840-parts-id__ol">`,
    list,
    "</ol>",
    "</div>",
    "</div>",
    "</div>",
  ].join("\n");
}

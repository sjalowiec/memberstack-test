/**
 * Tip of the Week row ↔ DTO mapping and display helpers.
 */
import type { TipCatalogVideo } from "../tipOfTheWeek";
import { resolveTipCatalogVideo } from "../tipOfTheWeek";
import {
  TIP_DEFAULT_AVAILABILITY_NOTICE,
  TIP_DEFAULT_EYEBROW,
  TIP_DEFAULT_FOOTER_TEMPLATE,
  TIP_RELATED_LABEL_MAX,
  TIP_RELATED_NOTE_MAX,
  isTipOfTheWeekStatus,
  type TipOfTheWeekRecord,
  type TipOfTheWeekRow,
  type TipRelatedPublicLink,
  type TipRelatedResource,
} from "./types";

function toIsoDateOnly(value: string | Date | null | undefined): string {
  if (value == null) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
    return trimmed;
  }
  try {
    return value.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function toIsoTimestamp(value: string | Date | null | undefined): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  try {
    return value.toISOString();
  } catch {
    return "";
  }
}

function parseJsonArray(raw: string | null | undefined): unknown[] {
  if (!raw || typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parseLearnPointsJson(raw: string | null | undefined): string[] {
  return parseJsonArray(raw)
    .filter((item): item is string => typeof item === "string")
    .map((s) => s.trim())
    .filter(Boolean);
}

function optionalNote(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > TIP_RELATED_NOTE_MAX) return undefined;
  return trimmed;
}

function optionalTitle(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().slice(0, TIP_RELATED_LABEL_MAX);
}

function parseVideoContentIdLoose(raw: unknown): string {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return String(Math.trunc(raw));
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (/^\d{1,12}$/.test(trimmed)) return trimmed;
  }
  return "";
}

/** Build the gated Learning Library video page path from a content_id. */
export function tipRelatedVideoHref(videoId: string): string {
  return `/videos/${String(videoId).trim()}`;
}

const LEGACY_VIDEO_HREF =
  /^\/videos\/(\d{1,12})\/?(?:[?#].*)?$/i;

/**
 * Normalize a Related Help entry from typed or legacy JSON.
 * Preserves legacy labels, destinations, and notes.
 */
export function normalizeRelatedResource(
  item: unknown,
): TipRelatedResource | null {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const row = item as Record<string, unknown>;
  const note = optionalNote(row.note ?? row.description);
  const typeRaw =
    typeof row.type === "string" ? row.type.trim().toLowerCase() : "";

  if (typeRaw === "video") {
    const videoId = parseVideoContentIdLoose(
      row.videoId ?? row.video_id ?? row.contentId ?? row.content_id ?? row.videoContentId,
    );
    const title = optionalTitle(row.title ?? row.label);
    if (!videoId || !title) return null;
    return note
      ? { type: "video", videoId, title, note }
      : { type: "video", videoId, title };
  }

  if (typeRaw === "link" || typeRaw === "document") {
    const title = optionalTitle(row.title ?? row.label);
    const urlRaw = row.url ?? row.href ?? row.destinationUrl;
    const url = typeof urlRaw === "string" ? urlRaw.trim() : "";
    if (!title || !url) return null;
    if (url.startsWith("//")) return null;
    if (!(url.startsWith("/") || /^https:\/\//i.test(url))) return null;
    return note
      ? { type: "link", title, url, note }
      : { type: "link", title, url };
  }

  // Legacy { label, href, note? } — no type field.
  const label = optionalTitle(row.label ?? row.title);
  const hrefRaw = row.href ?? row.url ?? row.destinationUrl;
  const href = typeof hrefRaw === "string" ? hrefRaw.trim() : "";
  if (!label || !href || href.startsWith("//")) return null;

  const videoMatch = LEGACY_VIDEO_HREF.exec(href);
  if (videoMatch) {
    return note
      ? {
          type: "video",
          videoId: videoMatch[1],
          title: label,
          note,
        }
      : {
          type: "video",
          videoId: videoMatch[1],
          title: label,
        };
  }

  if (href.startsWith("/") || /^https:\/\//i.test(href)) {
    return note
      ? { type: "link", title: label, url: href, note }
      : { type: "link", title: label, url: href };
  }

  return null;
}

export function parseRelatedLinksJson(
  raw: string | null | undefined,
): TipRelatedResource[] {
  const links: TipRelatedResource[] = [];
  for (const item of parseJsonArray(raw)) {
    const normalized = normalizeRelatedResource(item);
    if (normalized) links.push(normalized);
  }
  return links;
}

/** Normalize an in-memory related-links array (e.g. from dev JSON). */
export function normalizeRelatedResources(
  items: unknown[] | null | undefined,
): TipRelatedResource[] {
  if (!Array.isArray(items)) return [];
  const links: TipRelatedResource[] = [];
  for (const item of items) {
    const normalized = normalizeRelatedResource(item);
    if (normalized) links.push(normalized);
  }
  return links;
}

export function relatedResourceHref(resource: TipRelatedResource): string {
  return resource.type === "video"
    ? tipRelatedVideoHref(resource.videoId)
    : resource.url;
}

export function relatedResourceLabel(resource: TipRelatedResource): string {
  if (resource.type === "video") {
    const live = resolveVideoForTip({ videoContentId: resource.videoId });
    return (live?.catalogTitle || resource.title).trim();
  }
  return resource.title.trim();
}

export function isExternalRelatedHref(href: string): boolean {
  return /^https:\/\//i.test(String(href || "").trim());
}

export function toPublicRelatedLink(
  resource: TipRelatedResource,
): TipRelatedPublicLink | null {
  const label = relatedResourceLabel(resource);
  const href = relatedResourceHref(resource);
  if (!label || !href) return null;
  if (href.startsWith("//")) return null;
  if (!(href.startsWith("/") || isExternalRelatedHref(href))) return null;
  if (href.includes("example.com") || href.includes("#todo")) return null;

  const link: TipRelatedPublicLink = {
    type: resource.type,
    label,
    href,
    external: isExternalRelatedHref(href),
  };
  if (resource.note) link.note = resource.note;
  return link;
}

export function buildTipOfTheWeekRecord(
  row: TipOfTheWeekRow,
): TipOfTheWeekRecord | null {
  if (!row || !isTipOfTheWeekStatus(row.status)) return null;
  const tipId = String(row.tip_id || "").trim();
  const title = String(row.title || "").trim();
  if (!tipId || !title) return null;

  return {
    id: String(row.id),
    tipId,
    title,
    intro: String(row.intro || "").trim(),
    videoContentId: String(row.video_content_id || "").trim(),
    availableFrom: toIsoDateOnly(row.available_from),
    availableThrough: toIsoDateOnly(row.available_through),
    status: row.status,
    availabilityNotice:
      String(row.availability_notice || "").trim() || TIP_DEFAULT_AVAILABILITY_NOTICE,
    availabilityFooterTemplate:
      String(row.availability_footer_template || "").trim() ||
      TIP_DEFAULT_FOOTER_TEMPLATE,
    tryCopy: String(row.try_copy || "").trim(),
    sueTipCopy: String(row.sue_tip_copy || "").trim(),
    learnPoints: parseLearnPointsJson(row.learn_points_json),
    relatedLinks: parseRelatedLinksJson(row.related_links_json),
    eyebrow: String(row.eyebrow || "").trim() || TIP_DEFAULT_EYEBROW,
    createdAt: toIsoTimestamp(row.created_at),
    updatedAt: toIsoTimestamp(row.updated_at),
  };
}

/** Format YYYY-MM-DD for display (UTC calendar components → long US date). */
export function formatTipAvailabilityDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate || "").trim());
  if (!match) return String(isoDate || "").trim();
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return String(isoDate).trim();
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function tipAvailabilityFooterFromRecord(
  tip: Pick<TipOfTheWeekRecord, "availableThrough" | "availabilityFooterTemplate">,
): string {
  const date = formatTipAvailabilityDate(tip.availableThrough);
  return tip.availabilityFooterTemplate.replace("{date}", date);
}

export function resolveVideoForTip(
  tip: Pick<TipOfTheWeekRecord, "videoContentId">,
): TipCatalogVideo | null {
  return resolveTipCatalogVideo({
    tipId: "",
    eyebrow: "",
    title: "",
    intro: "",
    availabilityNotice: "",
    availableThrough: "",
    videoContentId: tip.videoContentId,
    videoTitle: "",
    learnHeading: "",
    learnPoints: [],
    tryHeading: "",
    tryCopy: "",
    sueTipHeading: "",
    sueTipCopy: "",
    relatedHeading: "",
    relatedLinks: [],
    availabilityFooterTemplate: "{date}",
  });
}

export function filterPublicRelatedLinks(
  links: TipRelatedResource[],
): TipRelatedPublicLink[] {
  const out: TipRelatedPublicLink[] = [];
  for (const resource of links || []) {
    const publicLink = toPublicRelatedLink(resource);
    if (publicLink) out.push(publicLink);
  }
  return out;
}

import { videoContentIdKey } from "./videoPosterOverrides";

export type VideoAdminSearchRow = {
  content_id?: unknown;
  title?: unknown;
  slug?: unknown;
  vimeo_id?: unknown;
};

export type VideoAdminQuery =
  | { kind: "empty" }
  | { kind: "exact-id"; id: string }
  | { kind: "text"; text: string };

/** "707", "KIN video 707", and "video #707" are exact video-number or Vimeo ID lookups. */
export function parseVideoAdminQuery(raw: string): VideoAdminQuery {
  const text = raw.trim().toLowerCase();
  if (!text) return { kind: "empty" };
  const exact = text.match(/^(?:kin\s+)?(?:video\s+)?#?\s*(\d+)$/i);
  if (exact) return { kind: "exact-id", id: String(parseInt(exact[1], 10)) };
  return { kind: "text", text };
}

export function vimeoIdKey(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return String(Math.trunc(value));
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return "";
  return String(parseInt(trimmed, 10));
}

export function videoMatchesAdminSearch(video: VideoAdminSearchRow, rawQuery: string): boolean {
  const query = parseVideoAdminQuery(rawQuery);
  if (query.kind === "empty") return true;
  const contentId = videoContentIdKey(video.content_id);
  const vimeoId = vimeoIdKey(video.vimeo_id);
  if (query.kind === "exact-id") return contentId === query.id || vimeoId === query.id;
  const title = typeof video.title === "string" ? video.title.toLowerCase() : "";
  const slug = typeof video.slug === "string" ? video.slug.toLowerCase() : "";
  return (
    title.includes(query.text) ||
    slug.includes(query.text) ||
    contentId.toLowerCase().includes(query.text) ||
    vimeoId.includes(query.text)
  );
}

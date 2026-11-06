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

/**
 * "707", "249-1", "KIN video 707", and "video #249-1" are exact KIN or Vimeo ID lookups.
 * A suffixed KIN ID stays a string so "249-1" is not read as 249.
 */
export function parseVideoAdminQuery(raw: string): VideoAdminQuery {
  const text = raw.trim().toLowerCase();
  if (!text) return { kind: "empty" };
  const exact = text.match(/^(?:kin\s+)?(?:video\s+)?#?\s*(\d+(?:-\d+)?)$/i);
  if (!exact) return { kind: "text", text };
  const token = exact[1];
  if (token.includes("-")) return { kind: "exact-id", id: token };
  return { kind: "exact-id", id: String(parseInt(token, 10)) };
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

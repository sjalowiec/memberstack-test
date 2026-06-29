import { stableVideoKey, type PublicVideoRow } from "./lessonVideo";

export type VideoUsageRef = {
  type: "lesson" | "help-hub";
  label: string;
};

function trimStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function lessonTitle(raw: Record<string, unknown>): string {
  const title = trimStr(raw.title);
  return title || trimStr(raw.slug) || "Lesson";
}

function helpHubTitle(raw: Record<string, unknown>): string {
  const question = trimStr(raw.question);
  const title = trimStr(raw.title);
  return question || title || trimStr(raw.slug) || "Help Hub tip";
}

function addUsage(
  map: Map<string, VideoUsageRef[]>,
  key: string,
  ref: VideoUsageRef,
): void {
  const k = key.trim();
  if (!k) return;
  const list = map.get(k) ?? [];
  const dup = list.some((x) => x.type === ref.type && x.label === ref.label);
  if (!dup) list.push(ref);
  map.set(k, list);
}

/** Map stable video key (slug or content_id) ? where the video is referenced. */
export function buildVideoUsageIndex(
  lessons: unknown[],
  helpHub: unknown[],
  videos: PublicVideoRow[],
): Map<string, VideoUsageRef[]> {
  const map = new Map<string, VideoUsageRef[]>();

  const contentIdToKey = new Map<string, string>();
  for (const v of videos) {
    const key = stableVideoKey(v);
    if (!key) continue;
    const cid = trimStr(v.content_id);
    if (cid) contentIdToKey.set(cid, key);
  }

  for (const item of lessons) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const label = lessonTitle(row);

    const videoSlug = trimStr(row.videoSlug);
    if (videoSlug) {
      addUsage(map, videoSlug, { type: "lesson", label });
    }

    if (Array.isArray(row.videos)) {
      for (const entry of row.videos) {
        const vk = trimStr(entry);
        if (vk) addUsage(map, vk, { type: "lesson", label });
      }
    }
  }

  for (const item of helpHub) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as Record<string, unknown>;
    const label = helpHubTitle(row);
    const videoId = trimStr(row.videoId);
    if (!videoId) continue;
    const key = contentIdToKey.get(videoId) ?? videoId;
    addUsage(map, key, { type: "help-hub", label });
  }

  return map;
}

export function formatVideoUsageList(refs: VideoUsageRef[] | undefined): string {
  if (!refs?.length) return "";
  return refs.map((r) => `${r.type === "lesson" ? "Lesson" : "Help Hub"}: ${r.label}`).join("; ");
}

import { extractVimeoId } from "../vimeo";
export {
  PUBLIC_VIDEO_ID_MESSAGE,
  publicVideoEntryProblem,
  publicVideoValueToStore,
} from "./publicVideoField";

/** Free Help Hub video. Separate from member Related Lessons. */
export type HelpHubPublicVideo = {
  vimeoId: string;
  title: string;
  embedUrl: string;
};

/** Numeric Vimeo ID, or a vimeo.com / player.vimeo.com URL already saved on the entry. */
export function vimeoIdFromPublicVideoField(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return raw;
  return extractVimeoId(raw);
}

export function resolveHelpHubPublicVideo(tip: {
  publicVideoUrl?: unknown;
  publicVideoTitle?: unknown;
}): HelpHubPublicVideo | null {
  const vimeoId = vimeoIdFromPublicVideoField(tip.publicVideoUrl);
  if (!vimeoId) return null;
  const title = typeof tip.publicVideoTitle === "string" ? tip.publicVideoTitle.trim() : "";
  return {
    vimeoId,
    title,
    embedUrl: `https://player.vimeo.com/video/${vimeoId}`,
  };
}

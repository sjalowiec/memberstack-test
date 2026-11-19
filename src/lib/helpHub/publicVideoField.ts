/** Shown when a new Public video value is a page address or anything other than a Vimeo ID. */
export const PUBLIC_VIDEO_ID_MESSAGE =
  "This field needs the Vimeo video ID. Enter the number from Vimeo, not the page address.";

/**
 * New Public video values must be a numeric Vimeo ID.
 * A value already saved on the entry stays valid so existing videos keep playing.
 */
export function publicVideoEntryProblem(value: string, savedValue = ""): string | null {
  const next = value.trim();
  if (!next) return null;
  if (next === savedValue.trim()) return null;
  if (/^\d+$/.test(next)) return null;
  return PUBLIC_VIDEO_ID_MESSAGE;
}

/** Blank clears the video. An unchanged saved URL or ID is kept. A new value must be a Vimeo ID. */
export function publicVideoValueToStore(value: string, savedValue: unknown): string | null {
  const next = value.trim();
  const saved = typeof savedValue === "string" ? savedValue.trim() : "";
  if (!next) return null;
  if (publicVideoEntryProblem(next, saved)) return saved || null;
  return next;
}

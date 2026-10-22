/** Same key in Memberstack JSON (signed-in) and browser storage (signed-out). */
export const WHATS_NEW_ANNOUNCEMENT_SEEN_KEY = "kbmWhatsNewAnnouncementsSeen";

const ID_MAX = 80;

export function readAnnouncementSeenMap(value: unknown): Record<string, string> {
  let source = value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return {};
    try {
      source = JSON.parse(trimmed) as unknown;
    } catch {
      return {};
    }
  }
  if (!source || typeof source !== "object" || Array.isArray(source)) return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(source as Record<string, unknown>)) {
    const id = key.trim();
    if (!id || id.length > ID_MAX) continue;
    if (typeof raw !== "string" || !raw.trim()) continue;
    out[id] = raw.trim();
  }
  return out;
}

export function hasSeenAnnouncement(map: Record<string, string>, id: string): boolean {
  const trimmed = id.trim();
  return Boolean(trimmed && typeof map[trimmed] === "string");
}

export function rememberAnnouncementSeen(
  map: Record<string, string>,
  id: string,
  seenAt: string,
): Record<string, string> {
  const trimmed = id.trim();
  const when = seenAt.trim();
  if (!trimmed || !when) return { ...map };
  return { ...map, [trimmed]: when };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

/**
 * Memberstack's getMemberJSON result is `{ data: storedJson }`.
 * Stored JSON is written back without that envelope.
 */
export function unwrapMemberJson(value: unknown): Record<string, unknown> {
  const root = asRecord(value);
  if ("data" in root) {
    return asRecord(root.data);
  }
  return root;
}

export function readSeenMapFromMemberJson(value: unknown): Record<string, string> {
  const json = unwrapMemberJson(value);
  return readAnnouncementSeenMap(json[WHATS_NEW_ANNOUNCEMENT_SEEN_KEY]);
}

/** Copies every other account JSON field and records this announcement as seen. */
export function mergeAnnouncementSeenIntoMemberJson(
  value: unknown,
  id: string,
  seenAt: string,
): Record<string, unknown> {
  const json = unwrapMemberJson(value);
  const seen = rememberAnnouncementSeen(
    readAnnouncementSeenMap(json[WHATS_NEW_ANNOUNCEMENT_SEEN_KEY]),
    id,
    seenAt,
  );
  return {
    ...json,
    [WHATS_NEW_ANNOUNCEMENT_SEEN_KEY]: seen,
  };
}

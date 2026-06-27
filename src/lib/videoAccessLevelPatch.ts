import { validatePendingAccessLevel } from "./videoAccessLevel";

export type VideoAccessLevelUpdate = {
  content_id: string | number;
  access_level: string;
};

export type ApplyVideoAccessPatchesResult =
  | {
      ok: true;
      updated: Array<{ content_id: string | number; access_level: string }>;
      notFound: string[];
    }
  | { ok: false; error: string };

function contentIdKey(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  return String(raw).trim();
}

/**
 * Patch `access_level` on existing catalog rows by unique `content_id` only.
 * Preserves array order and every other field.
 */
export function applyVideoAccessLevelPatches(
  videos: unknown[],
  updates: VideoAccessLevelUpdate[],
): ApplyVideoAccessPatchesResult {
  if (!Array.isArray(videos)) {
    return { ok: false, error: "Catalog must be a JSON array." };
  }
  if (!Array.isArray(updates) || updates.length === 0) {
    return { ok: false, error: "At least one access level update is required." };
  }

  const indexById = new Map<string, number>();
  for (let i = 0; i < videos.length; i++) {
    const row = videos[i];
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const id = contentIdKey((row as Record<string, unknown>).content_id);
    if (id) indexById.set(id, i);
  }

  const updated: Array<{ content_id: string | number; access_level: string }> = [];
  const notFound: string[] = [];
  const touched = new Set<number>();

  for (let i = 0; i < updates.length; i++) {
    const item = updates[i];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { ok: false, error: `Update ${i + 1} must be an object.` };
    }

    const id = contentIdKey(item.content_id);
    if (!id) {
      return { ok: false, error: `Update ${i + 1}: content_id is required.` };
    }

    const validated = validatePendingAccessLevel(item.access_level);
    if (!validated.ok) {
      return { ok: false, error: `Video ${id}: ${validated.error}` };
    }

    const rowIndex = indexById.get(id);
    if (rowIndex === undefined) {
      notFound.push(id);
      continue;
    }

    const row = videos[rowIndex];
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return { ok: false, error: `Video ${id}: catalog row is invalid.` };
    }

    (row as Record<string, unknown>).access_level = validated.access_level;
    touched.add(rowIndex);
    updated.push({ content_id: (row as Record<string, unknown>).content_id as string | number, access_level: validated.access_level });
  }

  if (updated.length === 0) {
    return {
      ok: false,
      error:
        notFound.length > 0
          ? `No matching videos found for content_id: ${notFound.join(", ")}.`
          : "No videos were updated.",
    };
  }

  return { ok: true, updated, notFound };
}

export function describeVideoAccessPatchSuccess(
  updated: Array<{ content_id: string | number; access_level: string }>,
  titleByContentId: Map<string, string>,
): string {
  if (updated.length === 1) {
    const row = updated[0]!;
    const id = contentIdKey(row.content_id);
    const title = titleByContentId.get(id);
    const label = title ? `${id} — ${title}` : id;
    return `Saved access level for ${label} (${row.access_level}).`;
  }
  return `Saved access levels for ${updated.length} videos.`;
}

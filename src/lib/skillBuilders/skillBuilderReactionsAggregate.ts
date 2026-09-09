/**
 * Aggregate Skill Builder reactions from Netlify Blobs (Watson-only).
 * Never returns visitor IDs. Uses a separate store from Tip of the Week.
 */
import { getStore, type Store } from "@netlify/blobs";
import {
  SKILL_BUILDER_FEEDBACK_CATALOG,
  SKILL_BUILDER_REACTIONS,
  isSkillBuilderReactionId,
  type SkillBuilderReactionId,
} from "./skillBuilderFeedback";

export const SKILL_BUILDER_REACTION_BLOB_STORE = "skill-builder-reactions";
export const SKILL_BUILDER_REACTION_KEY_PREFIX = "reactions/";
export const TIP_REACTION_BLOB_STORE_NAME = "tip-of-the-week-reactions";

export type SkillBuilderReactionTotals = {
  skillBuilderId: string;
  title: string;
  total: number;
  byReaction: Record<SkillBuilderReactionId, number>;
};

type BlobStoreLike = Pick<Store, "get" | "list">;

function emptyCounts(): Record<SkillBuilderReactionId, number> {
  return {
    did_it: 0,
    will_try: 0,
    need_help: 0,
  };
}

export function sanitizeSkillBuilderReactionKeySegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

export function getSkillBuilderReactionBlobStore(): BlobStoreLike {
  return getStore({ name: SKILL_BUILDER_REACTION_BLOB_STORE, consistency: "strong" });
}

export function aggregateSkillBuilderReactionRecords(
  skillBuilderId: string,
  records: Array<{ reaction?: unknown; contentType?: unknown }>,
): Omit<SkillBuilderReactionTotals, "title"> {
  const byReaction = emptyCounts();
  let total = 0;
  for (const record of records) {
    if (record.contentType && record.contentType !== "skill-builder") continue;
    if (!isSkillBuilderReactionId(record.reaction)) continue;
    byReaction[record.reaction] += 1;
    total += 1;
  }
  return { skillBuilderId, total, byReaction };
}

export async function loadSkillBuilderReactionTotals(
  skillBuilderId: string,
  store: BlobStoreLike = getSkillBuilderReactionBlobStore(),
): Promise<Omit<SkillBuilderReactionTotals, "title">> {
  const safeId = sanitizeSkillBuilderReactionKeySegment(String(skillBuilderId || "").trim());
  if (!safeId) {
    return { skillBuilderId: "", total: 0, byReaction: emptyCounts() };
  }

  const prefix = `${SKILL_BUILDER_REACTION_KEY_PREFIX}${safeId}/`;
  const { blobs } = await store.list({ prefix });
  const records: Array<{ reaction?: unknown; contentType?: unknown }> = [];

  for (const blob of blobs) {
    const key = blob?.key;
    if (typeof key !== "string" || !key.endsWith(".json")) continue;
    const raw = await store.get(key, { type: "text" });
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as {
        reaction?: unknown;
        contentType?: unknown;
        visitorId?: unknown;
      };
      records.push({ reaction: parsed.reaction, contentType: parsed.contentType });
    } catch {
      /* skip */
    }
  }

  return aggregateSkillBuilderReactionRecords(safeId, records);
}

export async function loadAllSkillBuilderReactionTotals(
  store: BlobStoreLike = getSkillBuilderReactionBlobStore(),
): Promise<SkillBuilderReactionTotals[]> {
  const rows: SkillBuilderReactionTotals[] = [];
  for (const item of SKILL_BUILDER_FEEDBACK_CATALOG) {
    try {
      const totals = await loadSkillBuilderReactionTotals(item.id, store);
      rows.push({
        skillBuilderId: item.id,
        title: item.title,
        total: totals.total,
        byReaction: totals.byReaction,
      });
    } catch {
      rows.push({
        skillBuilderId: item.id,
        title: item.title,
        total: 0,
        byReaction: emptyCounts(),
      });
    }
  }
  return rows;
}

export function skillBuilderReactionDisplayRows(
  totals: Omit<SkillBuilderReactionTotals, "title"> | SkillBuilderReactionTotals,
) {
  return SKILL_BUILDER_REACTIONS.map((reaction) => ({
    id: reaction.id,
    label: `${reaction.emoji} ${reaction.label}`,
    count: totals.byReaction[reaction.id] ?? 0,
  }));
}

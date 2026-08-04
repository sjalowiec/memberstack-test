/**
 * Aggregate Tip of the Week reactions from Netlify Blobs (Watson-only).
 * Never returns visitor IDs.
 */
import { getStore, type Store } from "@netlify/blobs";
import {
  TIP_REACTIONS,
  type TipReactionId,
  isTipReactionId,
} from "../tipOfTheWeekReactions";

export const TIP_REACTION_BLOB_STORE = "tip-of-the-week-reactions";
export const TIP_REACTION_KEY_PREFIX = "reactions/";

export type TipReactionTotals = {
  tipId: string;
  total: number;
  byReaction: Record<TipReactionId, number>;
};

type BlobStoreLike = Pick<Store, "get" | "list">;

function emptyCounts(): Record<TipReactionId, number> {
  return {
    helped: 0,
    will_try: 0,
    more_like_this: 0,
  };
}

export function sanitizeTipReactionKeySegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

export function getTipReactionBlobStore(): BlobStoreLike {
  return getStore({ name: TIP_REACTION_BLOB_STORE, consistency: "strong" });
}

/**
 * Pure aggregator: one blob record per visitor; counts by reaction id.
 * Input records must already exclude visitor identifiers from the output path.
 */
export function aggregateTipReactionRecords(
  tipId: string,
  records: Array<{ reaction?: unknown }>,
): TipReactionTotals {
  const byReaction = emptyCounts();
  let total = 0;
  for (const record of records) {
    if (!isTipReactionId(record.reaction)) continue;
    byReaction[record.reaction] += 1;
    total += 1;
  }
  return { tipId, total, byReaction };
}

export async function loadTipReactionTotals(
  tipId: string,
  store: BlobStoreLike = getTipReactionBlobStore(),
): Promise<TipReactionTotals> {
  const safeTipId = sanitizeTipReactionKeySegment(String(tipId || "").trim());
  if (!safeTipId) {
    return { tipId: "", total: 0, byReaction: emptyCounts() };
  }

  const prefix = `${TIP_REACTION_KEY_PREFIX}${safeTipId}/`;
  const { blobs } = await store.list({ prefix });
  const records: Array<{ reaction?: unknown }> = [];

  for (const blob of blobs) {
    const key = blob?.key;
    if (typeof key !== "string" || !key.endsWith(".json")) continue;
    const raw = await store.get(key, { type: "text" });
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as { reaction?: unknown; visitorId?: unknown };
      // Intentionally drop visitorId — never expose it to Watson UI callers.
      records.push({ reaction: parsed.reaction });
    } catch {
      /* skip */
    }
  }

  return aggregateTipReactionRecords(safeTipId, records);
}

export function tipReactionDisplayRows(totals: TipReactionTotals) {
  return TIP_REACTIONS.map((reaction) => ({
    id: reaction.id,
    label: `${reaction.emoji} ${reaction.label}`,
    count: totals.byReaction[reaction.id] ?? 0,
  }));
}

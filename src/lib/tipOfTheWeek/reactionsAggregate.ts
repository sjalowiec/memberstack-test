/**
 * Aggregate Tip of the Week reactions from Netlify Blobs (Watson-only).
 * Never returns visitor IDs.
 */
import { getStore, type Store } from "@netlify/blobs";
import {
  TIP_FEEDBACK_CHOICES,
  TIP_REACTION_HISTORY,
  type TipReactionId,
  isTipReactionId,
} from "../tipOfTheWeekReactions";

export const TIP_REACTION_BLOB_STORE = "tip-of-the-week-reactions";
export const TIP_REACTION_KEY_PREFIX = "reactions/";
export const TIP_TOPIC_KEY_PREFIX = "topics/";

export type TipReactionTotals = {
  tipId: string;
  total: number;
  byReaction: Record<TipReactionId, number>;
  topicCount: number;
  topicSuggestions: string[];
};

type BlobStoreLike = Pick<Store, "get" | "list">;

type TopicRecord = {
  topicSuggestion?: unknown;
  topicSubmittedAt?: unknown;
  visitorId?: unknown;
  memberId?: unknown;
};

function emptyCounts(): Record<TipReactionId, number> {
  return {
    helped: 0,
    not_for_me: 0,
    will_try: 0,
    more_like_this: 0,
  };
}

function emptyTotals(tipId: string): TipReactionTotals {
  return {
    tipId,
    total: 0,
    byReaction: emptyCounts(),
    topicCount: 0,
    topicSuggestions: [],
  };
}

export function sanitizeTipReactionKeySegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

export function getTipReactionBlobStore(): BlobStoreLike {
  return getStore({ name: TIP_REACTION_BLOB_STORE, consistency: "strong" });
}

function topicText(record: TopicRecord): string {
  if (typeof record.topicSuggestion !== "string") return "";
  return record.topicSuggestion.trim();
}

/**
 * Pure aggregator: one reaction record per visitor, counted by reaction id.
 * Topic suggestions are counted separately and never include visitor ids.
 */
export function aggregateTipReactionRecords(
  tipId: string,
  records: Array<{ reaction?: unknown; visitorId?: unknown; memberId?: unknown }>,
  topics: TopicRecord[] = [],
): TipReactionTotals {
  const byReaction = emptyCounts();
  let total = 0;
  for (const record of records) {
    if (!isTipReactionId(record.reaction)) continue;
    byReaction[record.reaction] += 1;
    total += 1;
  }

  const topicSuggestions = [...topics]
    .sort((a, b) =>
      String(b.topicSubmittedAt || "").localeCompare(String(a.topicSubmittedAt || "")),
    )
    .map(topicText)
    .filter(Boolean);

  return {
    tipId,
    total,
    byReaction,
    topicCount: topicSuggestions.length,
    topicSuggestions,
  };
}

export async function loadTipReactionTotals(
  tipId: string,
  store: BlobStoreLike = getTipReactionBlobStore(),
): Promise<TipReactionTotals> {
  const safeTipId = sanitizeTipReactionKeySegment(String(tipId || "").trim());
  if (!safeTipId) return emptyTotals("");

  const records: Array<{ reaction?: unknown }> = [];
  const reactionPrefix = `${TIP_REACTION_KEY_PREFIX}${safeTipId}/`;
  const { blobs } = await store.list({ prefix: reactionPrefix });

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

  const topics: TopicRecord[] = [];
  const topicPrefix = `${TIP_TOPIC_KEY_PREFIX}${safeTipId}/`;
  const topicList = await store.list({ prefix: topicPrefix });
  for (const blob of topicList.blobs) {
    const key = blob?.key;
    if (typeof key !== "string" || !key.endsWith(".json")) continue;
    const raw = await store.get(key, { type: "text" });
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as TopicRecord;
      topics.push({
        topicSuggestion: parsed.topicSuggestion,
        topicSubmittedAt: parsed.topicSubmittedAt,
      });
    } catch {
      /* skip */
    }
  }

  return aggregateTipReactionRecords(safeTipId, records, topics);
}

function reactionLabel(reaction: { label: string; emoji?: string }): string {
  return reaction.emoji ? `${reaction.emoji} ${reaction.label}` : reaction.label;
}

/**
 * Current choices always appear. Retired choices appear only when someone
 * already saved that response, so historical totals stay visible.
 */
export function tipReactionDisplayRows(totals: TipReactionTotals) {
  const current = TIP_FEEDBACK_CHOICES.map((reaction) => ({
    id: reaction.id,
    label: reactionLabel(reaction),
    count: totals.byReaction[reaction.id] ?? 0,
  }));
  const historical = TIP_REACTION_HISTORY.filter(
    (reaction) => (totals.byReaction[reaction.id] ?? 0) > 0,
  ).map((reaction) => ({
    id: reaction.id,
    label: reactionLabel(reaction),
    count: totals.byReaction[reaction.id] ?? 0,
  }));
  return [...current, ...historical];
}

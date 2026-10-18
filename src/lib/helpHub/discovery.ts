/**
 * One published Help Hub question and its saved quick answer for the landing conversation.
 * The quick answer is the stored `bubbleAnswer` field (admin label "Quick answer").
 * Drafts, reviews, and entries without that saved reply are left out. Nothing is invented.
 */

import { stripHtmlToText } from "../helpHubFaqSchema";
import {
  filterPublicHelpHubTips,
  type HelpHubTipRecord,
} from "../helpHubPublic";

export type HelpHubDiscoveryEntry = {
  slug: string;
  question: string;
  /** Plain text of the stored quick answer. */
  answer: string;
};

function helpHubTipId(item: { id?: unknown }): number {
  const value = item.id;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function helpHubTipCreatedAtMs(item: { createdAt?: unknown }): number | null {
  const raw = item.createdAt;
  if (raw instanceof Date) {
    const time = raw.getTime();
    return Number.isFinite(time) ? time : null;
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    const time = Date.parse(raw.trim());
    return Number.isFinite(time) ? time : null;
  }
  return null;
}

/** Newest published entry first. Dated rows win; missing dates fall back to a higher id. */
function compareHelpHubDiscoveryNewest(a: HelpHubTipRecord, b: HelpHubTipRecord): number {
  const aTime = helpHubTipCreatedAtMs(a);
  const bTime = helpHubTipCreatedAtMs(b);
  if (aTime != null && bTime != null && aTime !== bTime) return bTime - aTime;
  if (aTime != null && bTime == null) return -1;
  if (aTime == null && bTime != null) return 1;
  return helpHubTipId(b) - helpHubTipId(a);
}

export function helpHubFavoriteContentId(slug: string): string {
  const trimmed = slug.trim();
  return trimmed ? `/help-hub/${trimmed}` : "";
}

export function helpHubSlugFromFavoriteContentId(contentId: string): string | null {
  const trimmed = contentId.trim().replace(/\/+$/, "");
  const match = trimmed.match(/^\/help-hub\/([a-z0-9-]+)$/i);
  return match?.[1] ? match[1].toLowerCase() : null;
}

/**
 * Published tips that already have a question and a saved quick answer.
 * Newest first, so the landing conversation starts on a recent published entry.
 */
export function helpHubDiscoveryEntries(tips: HelpHubTipRecord[]): HelpHubDiscoveryEntry[] {
  const entries: HelpHubDiscoveryEntry[] = [];
  for (const tip of filterPublicHelpHubTips(tips).sort(compareHelpHubDiscoveryNewest)) {
    const slug = typeof tip.slug === "string" ? tip.slug.trim() : "";
    const question = typeof tip.question === "string" ? tip.question.trim() : "";
    const answer = stripHtmlToText(tip.bubbleAnswer);
    if (!slug || !question || !answer) continue;
    entries.push({ slug, question, answer });
  }
  return entries;
}

/**
 * Pick another discovery entry without repeating one already shown.
 * When every entry has been shown, start a new pass and still skip the one on screen.
 */
export function nextDiscoveryIndex(
  count: number,
  current: number,
  seen: ReadonlySet<number>,
  random: () => number = Math.random,
): { index: number; seen: Set<number> } | null {
  if (count <= 1 || current < 0 || current >= count) return null;
  const unseen: number[] = [];
  for (let index = 0; index < count; index += 1) {
    if (index !== current && !seen.has(index)) unseen.push(index);
  }
  let pool = unseen;
  const nextSeen = new Set(seen);
  nextSeen.add(current);
  if (pool.length === 0) {
    pool = [];
    for (let index = 0; index < count; index += 1) {
      if (index !== current) pool.push(index);
    }
    nextSeen.clear();
  }
  if (pool.length === 0) return null;
  const roll = random();
  const safeRoll = Number.isFinite(roll) ? Math.min(0.999999, Math.max(0, roll)) : 0;
  const index = pool[Math.floor(safeRoll * pool.length)] ?? pool[0];
  nextSeen.add(index);
  return { index, seen: nextSeen };
}

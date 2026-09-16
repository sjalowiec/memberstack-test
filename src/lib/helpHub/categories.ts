import helpHubCategories from "../../data/help-hub-categories.json";
import {
  activeHelpHubCategories,
  helpHubCategoryChoice,
  sortHelpHubManagedCategories,
  type HelpHubCategoryChoice,
  type HelpHubManagedCategory,
} from "./categoryTypes";

export type { HelpHubCategoryChoice, HelpHubManagedCategory } from "./categoryTypes";
export {
  HELP_HUB_LK150_KEY,
  HELP_HUB_RETIRED_LOOK_RIGHT_KEY,
  HELP_HUB_SOMETHING_NOT_WORKING_KEY,
} from "./categoryTypes";

function asTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = parseInt(value.trim(), 10);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function asSortOrder(value: unknown, fallback: number): number {
  const n = asId(value);
  return n != null ? n : fallback;
}

export function parseHelpHubCategoryRecords(raw: unknown): HelpHubManagedCategory[] {
  if (!Array.isArray(raw)) return [];
  const parsed: HelpHubManagedCategory[] = [];
  raw.forEach((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return;
    const rec = item as Record<string, unknown>;
    const key = asTrimmed(rec.key);
    if (!key) return;
    const id = asId(rec.id);
    if (id == null) return;
    const label = asTrimmed(rec.label) || key;
    const retiredFlag = rec.retired === true;
    const retiredAtRaw = asTrimmed(rec.retiredAt);
    const retiredAt = retiredFlag
      ? retiredAtRaw || "1970-01-01T00:00:00.000Z"
      : retiredAtRaw || null;
    parsed.push({
      id,
      key,
      label,
      sortOrder: asSortOrder(rec.sortOrder ?? rec.sort_order, (index + 1) * 10),
      retiredAt,
    });
  });
  return sortHelpHubManagedCategories(parsed);
}

/** JSON seed/fallback, including retired categories so stored keys stay resolvable. */
export function helpHubJsonSeedCategories(): HelpHubManagedCategory[] {
  return parseHelpHubCategoryRecords(helpHubCategories);
}

export function helpHubCategoryChoicesFrom(
  categories: HelpHubManagedCategory[],
): HelpHubCategoryChoice[] {
  return activeHelpHubCategories(categories).map(helpHubCategoryChoice);
}

/** Active authoring/public choices. Defaults to the JSON seed (retired rows omitted). */
export function helpHubCategoryChoices(
  categories: HelpHubManagedCategory[] = helpHubJsonSeedCategories(),
): HelpHubCategoryChoice[] {
  return helpHubCategoryChoicesFrom(categories);
}

export function helpHubCategoryLabel(
  key: string,
  categories: HelpHubManagedCategory[] = helpHubJsonSeedCategories(),
): string {
  const normalized = key.trim();
  if (!normalized) return "";
  const found = categories.find((choice) => choice.key === normalized);
  return found?.label ?? normalized;
}

export function helpHubTipsInCategory<T extends { category?: unknown }>(
  tips: T[],
  categoryKey: string,
): T[] {
  const key = categoryKey.trim();
  if (!key) return [];
  return tips.filter((tip) => typeof tip.category === "string" && tip.category.trim() === key);
}

export function helpHubCategoryUsageCounts(
  tips: { category?: unknown }[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const tip of tips) {
    const key = typeof tip.category === "string" ? tip.category.trim() : "";
    if (!key) continue;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

export function helpHubCategoriesToJsonSeed(categories: HelpHubManagedCategory[]): unknown[] {
  return sortHelpHubManagedCategories(categories).map((category) => {
    const row: Record<string, unknown> = {
      id: category.id,
      key: category.key,
      label: category.label,
      sortOrder: category.sortOrder,
    };
    if (category.retiredAt) row.retired = true;
    return row;
  });
}

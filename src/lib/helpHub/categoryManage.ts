import {
  helpHubCategoryUsageCounts,
  helpHubJsonSeedCategories,
  helpHubTipsInCategory,
} from "./categories";
import {
  HELP_HUB_LK150_KEY,
  HELP_HUB_RETIRED_LOOK_RIGHT_KEY,
  HelpHubCategoryError,
  activeHelpHubCategories,
  isHelpHubCategoryRetired,
  sortHelpHubManagedCategories,
  type HelpHubManagedCategory,
} from "./categoryTypes";

export { HelpHubCategoryError };

export function nextHelpHubCategoryId(categories: { id: number }[]): number {
  const max = categories.reduce((m, category) => Math.max(m, category.id), 9);
  return max + 1;
}

function nextCategorySortOrder(categories: HelpHubManagedCategory[]): number {
  const max = categories.reduce((m, category) => Math.max(m, category.sortOrder), 0);
  return max + 10;
}

export function helpHubCategoryKeyFromLabel(label: string): string {
  const key = label
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return key;
}

export function uniqueHelpHubCategoryKey(
  label: string,
  categories: HelpHubManagedCategory[],
  options: { reserved?: string } = {},
): string {
  const base = helpHubCategoryKeyFromLabel(label);
  if (!base) {
    throw new HelpHubCategoryError("INVALID_LABEL", "Category name is required.");
  }
  const taken = new Set(categories.map((category) => category.key));
  if (options.reserved) taken.delete(options.reserved);
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export function createHelpHubCategory(
  categories: HelpHubManagedCategory[],
  input: { label: string; key?: string },
): { categories: HelpHubManagedCategory[]; created: HelpHubManagedCategory } {
  const label = input.label.trim();
  if (!label) {
    throw new HelpHubCategoryError("INVALID_LABEL", "Category name is required.");
  }
  const key = input.key?.trim()
    ? input.key.trim()
    : uniqueHelpHubCategoryKey(label, categories);
  if (categories.some((category) => category.key === key)) {
    throw new HelpHubCategoryError("KEY_TAKEN", `Category key "${key}" is already in use.`);
  }
  const created: HelpHubManagedCategory = {
    id: nextHelpHubCategoryId(categories),
    key,
    label,
    sortOrder: nextCategorySortOrder(categories),
    retiredAt: null,
  };
  return {
    categories: sortHelpHubManagedCategories([...categories, created]),
    created,
  };
}

export function renameHelpHubCategory(
  categories: HelpHubManagedCategory[],
  id: number,
  label: string,
): HelpHubManagedCategory[] {
  const nextLabel = label.trim();
  if (!nextLabel) {
    throw new HelpHubCategoryError("INVALID_LABEL", "Category name is required.");
  }
  const found = categories.find((category) => category.id === id);
  if (!found) {
    throw new HelpHubCategoryError("NOT_FOUND", `No category with id ${id}.`);
  }
  return categories.map((category) =>
    category.id === id ? { ...category, label: nextLabel } : category,
  );
}

export function reorderHelpHubCategories(
  categories: HelpHubManagedCategory[],
  orderedIds: number[],
): HelpHubManagedCategory[] {
  if (orderedIds.length !== categories.length) {
    throw new HelpHubCategoryError("INVALID_ORDER", "Category order must include every category.");
  }
  const byId = new Map(categories.map((category) => [category.id, category]));
  const seen = new Set<number>();
  const next: HelpHubManagedCategory[] = [];
  orderedIds.forEach((id, index) => {
    const category = byId.get(id);
    if (!category || seen.has(id)) {
      throw new HelpHubCategoryError("INVALID_ORDER", "Category order is invalid.");
    }
    seen.add(id);
    next.push({ ...category, sortOrder: (index + 1) * 10 });
  });
  return next;
}

export function assertHelpHubCategoryCanDelete(
  category: HelpHubManagedCategory,
  usageCount: number,
): void {
  if (usageCount > 0) {
    throw new HelpHubCategoryError(
      "IN_USE",
      `“${category.label}” is used by ${usageCount} Help Hub ${usageCount === 1 ? "entry" : "entries"} and cannot be deleted. Retire it and reassign those entries first.`,
    );
  }
}

export function deleteHelpHubCategory(
  categories: HelpHubManagedCategory[],
  tips: { category?: unknown }[],
  id: number,
): HelpHubManagedCategory[] {
  const found = categories.find((category) => category.id === id);
  if (!found) {
    throw new HelpHubCategoryError("NOT_FOUND", `No category with id ${id}.`);
  }
  const usage = helpHubCategoryUsageCounts(tips)[found.key] ?? 0;
  assertHelpHubCategoryCanDelete(found, usage);
  return retireHelpHubCategory(categories, tips, { id }).categories;
}

export function restoreHelpHubCategory(
  categories: HelpHubManagedCategory[],
  id: number,
): HelpHubManagedCategory[] {
  const found = categories.find((category) => category.id === id);
  if (!found) {
    throw new HelpHubCategoryError("NOT_FOUND", `No category with id ${id}.`);
  }
  if (!isHelpHubCategoryRetired(found)) return categories;
  return categories.map((category) =>
    category.id === id ? { ...category, retiredAt: null } : category,
  );
}

export function reassignHelpHubTipCategories<T extends { category?: unknown }>(
  tips: T[],
  fromKey: string,
  toKey: string,
): T[] {
  const from = fromKey.trim();
  const to = toKey.trim();
  if (!from || !to) {
    throw new HelpHubCategoryError("NEEDS_REPLACEMENT", "A replacement category is required.");
  }
  if (from === to) {
    throw new HelpHubCategoryError(
      "INVALID_REPLACEMENT",
      "Replacement category must be different from the retired category.",
    );
  }
  return tips.map((tip) => {
    if (typeof tip.category !== "string" || tip.category.trim() !== from) return tip;
    return { ...tip, category: to };
  });
}

export function retireHelpHubCategory<T extends { category?: unknown }>(
  categories: HelpHubManagedCategory[],
  tips: T[],
  input: { id: number; replacementKey?: string; confirm?: boolean; retiredAt?: string },
): { categories: HelpHubManagedCategory[]; tips: T[]; retired: HelpHubManagedCategory; reassigned: number } {
  const found = categories.find((category) => category.id === input.id);
  if (!found) {
    throw new HelpHubCategoryError("NOT_FOUND", `No category with id ${input.id}.`);
  }
  const assigned = helpHubTipsInCategory(tips, found.key);
  let nextTips = tips;
  if (assigned.length > 0) {
    if (input.confirm !== true) {
      throw new HelpHubCategoryError(
        "NEEDS_CONFIRM",
        `Confirm reassignment of ${assigned.length} Help Hub ${assigned.length === 1 ? "entry" : "entries"} before retiring “${found.label}”.`,
      );
    }
    const replacementKey = input.replacementKey?.trim() ?? "";
    const replacement = activeHelpHubCategories(categories).find(
      (category) => category.key === replacementKey && category.id !== found.id,
    );
    if (!replacement) {
      throw new HelpHubCategoryError(
        "INVALID_REPLACEMENT",
        "Choose an active replacement category so no entries are orphaned.",
      );
    }
    nextTips = reassignHelpHubTipCategories(tips, found.key, replacement.key);
  }
  if (helpHubTipsInCategory(nextTips, found.key).length > 0) {
    throw new HelpHubCategoryError(
      "ORPHAN_PREVENTED",
      "Entries still use this category; retirement was blocked.",
    );
  }
  const retiredAt = input.retiredAt ?? new Date().toISOString();
  const retired = { ...found, retiredAt };
  return {
    categories: categories.map((category) => (category.id === found.id ? retired : category)),
    tips: nextTips,
    retired,
    reassigned: assigned.length,
  };
}

/**
 * Insert missing seed rows without changing existing IDs/keys.
 * Ensures LK150 exists and retires My Knitting Doesn’t Look Right without touching tips.
 */
export function mergeSeededHelpHubCategories(
  existing: HelpHubManagedCategory[],
  seed: HelpHubManagedCategory[] = helpHubJsonSeedCategories(),
): HelpHubManagedCategory[] {
  if (existing.length === 0) return sortHelpHubManagedCategories(seed);
  const usedIds = new Set(existing.map((category) => category.id));
  const byKey = new Map(existing.map((category) => [category.key, category]));
  const next = [...existing];
  for (const seeded of seed) {
    if (byKey.has(seeded.key)) continue;
    let id = seeded.id;
    if (usedIds.has(id)) id = nextHelpHubCategoryId(next);
    const row = { ...seeded, id };
    next.push(row);
    usedIds.add(id);
    byKey.set(row.key, row);
  }
  const withLk150 = byKey.has(HELP_HUB_LK150_KEY)
    ? next
    : createHelpHubCategory(next, { label: "LK150", key: HELP_HUB_LK150_KEY }).categories;
  return sortHelpHubManagedCategories(
    withLk150.map((category) =>
      category.key === HELP_HUB_RETIRED_LOOK_RIGHT_KEY && !isHelpHubCategoryRetired(category)
        ? { ...category, retiredAt: "1970-01-01T00:00:00.000Z" }
        : category,
    ),
  );
}

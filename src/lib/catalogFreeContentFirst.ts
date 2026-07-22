/**
 * Shared catalog ordering: non-members see free/open items first.
 * Used by Videos and Courses listing pages for consistent UX.
 */

export type FreeContentFirstSortOptions<T> = {
  /** True when the item is free/public (unlocked without membership). */
  isFree: (item: T) => boolean;
  /**
   * When true, free items sort before member-only items.
   * When false, only the secondary compare (or original order) applies.
   */
  preferFreeFirst: boolean;
  /**
   * Secondary compare within the free group and within the member-only group.
   * When omitted, original relative order is preserved (stable).
   */
  compare?: (a: T, b: T) => number;
};

/**
 * Sort a catalog list, optionally placing free/public items before member-only
 * items while preserving each group's secondary order.
 */
export function sortWithFreeContentFirst<T>(
  items: readonly T[],
  options: FreeContentFirstSortOptions<T>,
): T[] {
  const decorated = items.map((item, index) => ({ item, index }));

  decorated.sort((a, b) => {
    if (options.preferFreeFirst) {
      const aFree = options.isFree(a.item);
      const bFree = options.isFree(b.item);
      if (aFree !== bFree) return aFree ? -1 : 1;
    }

    if (options.compare) {
      const secondary = options.compare(a.item, b.item);
      if (secondary !== 0) return secondary;
    }

    return a.index - b.index;
  });

  return decorated.map((entry) => entry.item);
}

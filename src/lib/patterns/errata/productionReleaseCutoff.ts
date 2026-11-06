/**
 * Compare a saved pattern with the production release of one correction.
 * `releasedAt` stays null until that production release. While it is null,
 * every saved pattern is before the release, including one with no creation date.
 * After the release instant is set, a missing date stays undated.
 */
export function productionReleaseTiming(
  createdAtMs: number | null,
  releasedAt: string | null,
): "before-release" | "after-release" | "undated" {
  if (releasedAt == null) return "before-release";
  const releasedMs = Date.parse(releasedAt);
  if (!Number.isFinite(releasedMs)) return "before-release";
  if (createdAtMs == null) return "undated";
  return createdAtMs >= releasedMs ? "after-release" : "before-release";
}

/** A production cutoff is either unset or a real instant. A blank string is not a cutoff. */
export function isProductionReleaseCutoff(value: unknown): value is string | null {
  if (value === null) return true;
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

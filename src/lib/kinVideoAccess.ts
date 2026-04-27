/**
 * Memberstack custom field `kin_access` (mixed types from API).
 * Video catalog, embeds, and related gates must only unlock for explicit affirmative values.
 */
export function hasKinVideoAccess(rawKinAccess: unknown): boolean {
  return (
    rawKinAccess === true ||
    rawKinAccess === "true" ||
    rawKinAccess === 1 ||
    rawKinAccess === "1"
  );
}

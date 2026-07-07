/**
 * Server-side mirror of pattern system resolution (see `patternSystemId.ts`).
 */

export const DROP_SHOULDER_CONSTRUCTION = "drop-shoulder";
export const CONSTRUCTION_AUTHORED_KEY = "constructionAuthored";
export const CONSTRUCTION_FAMILY_OVERRIDE_KEY = "constructionFamily";

/** @param {unknown} value */
function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? /** @type {Record<string, unknown>} */ (value)
    : {};
}

/**
 * @param {Record<string, unknown> | undefined} style
 * @param {Record<string, unknown> | undefined} customOverrides
 */
export function hasAuthoritativeDropShoulderConstruction(style, customOverrides) {
  const st = asRecord(style);
  if (st.construction !== DROP_SHOULDER_CONSTRUCTION) return false;
  if (st[CONSTRUCTION_AUTHORED_KEY] === DROP_SHOULDER_CONSTRUCTION) return true;
  if (asRecord(customOverrides)[CONSTRUCTION_FAMILY_OVERRIDE_KEY] === DROP_SHOULDER_CONSTRUCTION) {
    return true;
  }
  return false;
}

/**
 * @param {{ pattern?: unknown, customOverrides?: unknown }} project
 * @returns {"sleeveless" | "drop-shoulder"}
 */
export function resolvePatternSystemFromProject(project) {
  const pattern = asRecord(project?.pattern);
  const style = asRecord(pattern.style);
  const customOverrides = asRecord(project?.customOverrides);
  if (hasAuthoritativeDropShoulderConstruction(style, customOverrides)) {
    return "drop-shoulder";
  }
  return "sleeveless";
}

/** User-facing names for error messages. */
export const PATTERN_SYSTEM_DISPLAY_NAMES = {
  sleeveless: "Sleeveless",
  "drop-shoulder": "Drop Shoulder",
  blanket: "Blanket",
  hat: "Hat",
  raglan: "Raglan",
};

/** @param {string} systemId */
export function patternSystemDisplayName(systemId) {
  return PATTERN_SYSTEM_DISPLAY_NAMES[systemId] ?? systemId;
}

/**
 * Server-side mirror of pattern system resolution (see `patternSystemId.ts`).
 */

export const DROP_SHOULDER_CONSTRUCTION = "drop-shoulder";
export const SIDEWAYS_CARDIGAN_CONSTRUCTION = "sideways-cardigan";
export const CONSTRUCTION_AUTHORED_KEY = "constructionAuthored";
export const CONSTRUCTION_FAMILY_OVERRIDE_KEY = "constructionFamily";

/** @param {unknown} value */
function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? /** @type {Record<string, unknown>} */ (value)
    : {};
}

/**
 * Mirrors `hasAuthoritativeSidewaysCardiganConstruction` in sidewaysCardiganConstructionIdentity.ts.
 * @param {Record<string, unknown> | undefined} style
 * @param {Record<string, unknown> | undefined} customOverrides
 */
export function hasAuthoritativeSidewaysCardiganConstruction(style, customOverrides) {
  const st = asRecord(style);
  if (st.construction !== SIDEWAYS_CARDIGAN_CONSTRUCTION) return false;
  if (st[CONSTRUCTION_AUTHORED_KEY] === SIDEWAYS_CARDIGAN_CONSTRUCTION) return true;
  if (asRecord(customOverrides)[CONSTRUCTION_FAMILY_OVERRIDE_KEY] === SIDEWAYS_CARDIGAN_CONSTRUCTION) {
    return true;
  }
  return false;
}

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
 * @param {unknown} pattern
 */
function isHatPatternBlob(pattern) {
  const o = asRecord(pattern);
  return o.patternType === "hat" || o.patternSystem === "hat";
}

/**
 * @param {unknown} pattern
 */
function isSockPatternBlob(pattern) {
  const o = asRecord(pattern);
  return o.patternType === "socks" || o.patternType === "sock" || o.patternSystem === "socks";
}

/**
 * @param {{ pattern?: unknown, customOverrides?: unknown }} project
 * @returns {"sleeveless" | "drop-shoulder" | "sideways-cardigan" | "hat" | "socks"}
 */
export function resolvePatternSystemFromProject(project) {
  const pattern = asRecord(project?.pattern);
  if (isHatPatternBlob(pattern)) {
    return "hat";
  }
  if (isSockPatternBlob(pattern)) {
    return "socks";
  }
  const style = asRecord(pattern.style);
  const customOverrides = asRecord(project?.customOverrides);
  if (hasAuthoritativeSidewaysCardiganConstruction(style, customOverrides)) {
    return "sideways-cardigan";
  }
  if (hasAuthoritativeDropShoulderConstruction(style, customOverrides)) {
    return "drop-shoulder";
  }
  return "sleeveless";
}

/** User-facing names for error messages. */
export const PATTERN_SYSTEM_DISPLAY_NAMES = {
  sleeveless: "Sleeveless",
  "drop-shoulder": "Drop Shoulder",
  "sideways-cardigan": "Sideways V-Neck",
  blanket: "Blanket",
  hat: "Hat",
  raglan: "Raglan",
  socks: "Socks",
};

/** @param {string} systemId */
export function patternSystemDisplayName(systemId) {
  return PATTERN_SYSTEM_DISPLAY_NAMES[systemId] ?? systemId;
}

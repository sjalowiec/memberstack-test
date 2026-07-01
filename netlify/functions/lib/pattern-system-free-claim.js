/**
 * Server-side mirror of per-system free claim storage (see `patternSystemFreeClaim.ts`).
 */
import {
  FREE_SLEEVELESS_CLAIMED_JSON_KEY,
  FREE_SLEEVELESS_CLAIMED_PATTERN_ID_JSON_KEY,
} from "./sleeveless-free-claim.js";

export const FREE_PATTERN_CLAIMS_BY_SYSTEM_JSON_KEY = "freePatternClaimsBySystem";

/** @param {unknown} value */
function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? /** @type {Record<string, unknown>} */ (value)
    : {};
}

/** @param {unknown} raw */
function normalizePatternId(raw) {
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

/** @param {unknown} raw */
function normalizeClaim(raw) {
  const rec = asRecord(raw);
  if (rec.claimed !== true) return undefined;
  const patternId = normalizePatternId(rec.patternId);
  return patternId ? { claimed: true, patternId } : { claimed: true };
}

/** @param {unknown} json */
export function readFreeClaimsBySystemFromMemberJson(json) {
  const record = asRecord(json);
  /** @type {Record<string, { claimed: boolean, patternId?: string }>} */
  const claims = {};

  const bySystem = asRecord(record[FREE_PATTERN_CLAIMS_BY_SYSTEM_JSON_KEY]);
  for (const [key, value] of Object.entries(bySystem)) {
    const claim = normalizeClaim(value);
    if (claim) claims[key] = claim;
  }

  const legacyClaimed = record[FREE_SLEEVELESS_CLAIMED_JSON_KEY] === true;
  const legacyPatternId = normalizePatternId(record[FREE_SLEEVELESS_CLAIMED_PATTERN_ID_JSON_KEY]);
  if (legacyClaimed && !claims.sleeveless?.claimed && !claims["drop-shoulder"]?.claimed) {
    claims.sleeveless = {
      claimed: true,
      ...(legacyPatternId ? { patternId: legacyPatternId } : {}),
    };
  }

  return claims;
}

/** @param {Record<string, { claimed?: boolean, patternId?: string }>} claims @param {string} systemId */
export function isFreeClaimedForSystem(claims, systemId) {
  return claims[systemId]?.claimed === true;
}

/** @param {Record<string, { claimed?: boolean, patternId?: string }>} claims @param {string} systemId */
export function freeClaimedPatternIdForSystem(claims, systemId) {
  return normalizePatternId(claims[systemId]?.patternId);
}

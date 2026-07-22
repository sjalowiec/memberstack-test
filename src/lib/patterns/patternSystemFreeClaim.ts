/**
 * Per-pattern-system free claim storage in Memberstack member JSON.
 *
 * Historical: logged-in non-members once received one free saved pattern per system.
 * Dynamic Patterns now require active membership; these helpers remain for admin/migration
 * and for reading legacy claim metadata. They must not grant create/edit access.
 */
import type { PatternSystemId } from "./patternSystemId";
import {
  FREE_SLEEVELESS_CLAIMED_JSON_KEY,
  FREE_SLEEVELESS_CLAIMED_PATTERN_ID_JSON_KEY,
} from "./sleevelessPatternSystemAccess";

/** Member JSON key for per-system free pattern claims. */
export const FREE_PATTERN_CLAIMS_BY_SYSTEM_JSON_KEY = "freePatternClaimsBySystem";

export interface PatternSystemFreeClaim {
  claimed: boolean;
  patternId?: string;
}

export type FreeClaimsBySystem = Partial<Record<PatternSystemId, PatternSystemFreeClaim>>;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function normalizePatternId(raw: unknown): string | undefined {
  return typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
}

function normalizeClaim(raw: unknown): PatternSystemFreeClaim | undefined {
  const rec = asRecord(raw);
  if (rec.claimed !== true) return undefined;
  const patternId = normalizePatternId(rec.patternId);
  return patternId ? { claimed: true, patternId } : { claimed: true };
}

/** Reads per-system claims from member JSON, migrating legacy sleeveless keys when needed. */
export function readFreeClaimsBySystemFromMemberJson(json: unknown): FreeClaimsBySystem {
  const record = asRecord(json);
  const claims: FreeClaimsBySystem = {};

  const bySystem = asRecord(record[FREE_PATTERN_CLAIMS_BY_SYSTEM_JSON_KEY]);
  for (const [key, value] of Object.entries(bySystem)) {
    const claim = normalizeClaim(value);
    if (claim) {
      claims[key as PatternSystemId] = claim;
    }
  }

  // Legacy account-global sleeveless keys ? sleeveless system only (when not already migrated).
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

export function isFreeClaimedForSystem(
  claims: FreeClaimsBySystem | undefined,
  systemId: PatternSystemId,
): boolean {
  return claims?.[systemId]?.claimed === true;
}

export function freeClaimedPatternIdForSystem(
  claims: FreeClaimsBySystem | undefined,
  systemId: PatternSystemId,
): string | undefined {
  return normalizePatternId(claims?.[systemId]?.patternId);
}

/** Returns a new member-JSON object with one system's claim merged in (preserves other keys). */
export function mergeFreeClaimForSystemIntoMemberJson(
  json: unknown,
  systemId: PatternSystemId,
  patternId: string,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...asRecord(json) };
  const existing = readFreeClaimsBySystemFromMemberJson(json);
  const nextBySystem: Record<string, unknown> = {
    ...asRecord(merged[FREE_PATTERN_CLAIMS_BY_SYSTEM_JSON_KEY]),
    [systemId]: { claimed: true, patternId: patternId.trim() },
  };
  merged[FREE_PATTERN_CLAIMS_BY_SYSTEM_JSON_KEY] = nextBySystem;

  // Keep legacy keys in sync for sleeveless so older tooling still sees a claim.
  if (systemId === "sleeveless" && !existing.sleeveless?.claimed) {
    merged[FREE_SLEEVELESS_CLAIMED_JSON_KEY] = true;
    merged[FREE_SLEEVELESS_CLAIMED_PATTERN_ID_JSON_KEY] = patternId.trim();
  }

  return merged;
}

/** Admin reset - clears one system's claim; legacy keys cleared when sleeveless is reset. */
export function mergeFreeClaimResetForSystemIntoMemberJson(
  json: unknown,
  systemId: PatternSystemId,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...asRecord(json) };
  const nextBySystem: Record<string, unknown> = {
    ...asRecord(merged[FREE_PATTERN_CLAIMS_BY_SYSTEM_JSON_KEY]),
  };
  nextBySystem[systemId] = { claimed: false, patternId: null };
  merged[FREE_PATTERN_CLAIMS_BY_SYSTEM_JSON_KEY] = nextBySystem;

  if (systemId === "sleeveless") {
    merged[FREE_SLEEVELESS_CLAIMED_JSON_KEY] = false;
    merged[FREE_SLEEVELESS_CLAIMED_PATTERN_ID_JSON_KEY] = null;
  }

  return merged;
}

/** Clears all per-system claims and legacy keys (admin reset-all path). */
export function mergeAllFreeClaimsResetIntoMemberJson(json: unknown): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...asRecord(json) };
  merged[FREE_PATTERN_CLAIMS_BY_SYSTEM_JSON_KEY] = {};
  merged[FREE_SLEEVELESS_CLAIMED_JSON_KEY] = false;
  merged[FREE_SLEEVELESS_CLAIMED_PATTERN_ID_JSON_KEY] = null;
  return merged;
}

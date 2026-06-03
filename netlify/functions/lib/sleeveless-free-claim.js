/**
 * Server-side (Netlify functions) helpers for the one-time free Sleeveless Pattern claim.
 *
 * This is the JS mirror of the canonical, unit-tested pure rules in
 * `src/lib/patterns/sleevelessPatternSystemAccess.ts`. Netlify functions run as plain ESM JS and
 * cannot import the TypeScript source at runtime, so — exactly like
 * `isFreeSleevelessPatternDeleteBlocked` in `custom-pattern-projects-store.js` — the small pure
 * logic is reimplemented here. The key names MUST stay identical to the TS module so reads/writes
 * line up with what the browser DOM SDK stores.
 */

/** Member JSON keys for the one-time free pattern claim (account-tied, not localStorage). */
export const FREE_SLEEVELESS_CLAIMED_JSON_KEY = "freeSleevelessPatternClaimed";
export const FREE_SLEEVELESS_CLAIMED_PATTERN_ID_JSON_KEY = "freeSleevelessPatternId";

/** @param {unknown} value */
function asRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? /** @type {Record<string, unknown>} */ (value)
    : {};
}

/**
 * Reads the one-time free claim from a Memberstack member JSON object.
 * @param {unknown} json
 * @returns {{ freeSleevelessPatternClaimed: boolean, freeSleevelessPatternId: string | null }}
 */
export function readFreeClaimFromMemberJson(json) {
  const record = asRecord(json);
  const claimed = record[FREE_SLEEVELESS_CLAIMED_JSON_KEY] === true;
  const rawId = record[FREE_SLEEVELESS_CLAIMED_PATTERN_ID_JSON_KEY];
  const id = typeof rawId === "string" && rawId.trim() ? rawId.trim() : null;
  return { freeSleevelessPatternClaimed: claimed, freeSleevelessPatternId: id };
}

/**
 * Returns a NEW member-JSON object with the one-time free claim cleared:
 * `freeSleevelessPatternClaimed: false` and `freeSleevelessPatternId: null`.
 *
 * All other keys are preserved so we never clobber unrelated account metadata. The id is set to
 * `null` (rather than deleted) so the cleared state is explicit in the stored JSON. Mirror of
 * `mergeFreeClaimResetIntoMemberJson` in `sleevelessPatternSystemAccess.ts`.
 * @param {unknown} json
 * @returns {Record<string, unknown>}
 */
export function mergeFreeClaimResetIntoMemberJson(json) {
  const merged = { ...asRecord(json) };
  merged[FREE_SLEEVELESS_CLAIMED_JSON_KEY] = false;
  merged[FREE_SLEEVELESS_CLAIMED_PATTERN_ID_JSON_KEY] = null;
  return merged;
}

/** @param {Record<string, unknown>} customFields */
function nameFromCustomFields(customFields) {
  const cf = asRecord(customFields);
  const pick = (key) => (typeof cf[key] === "string" ? String(cf[key]).trim() : "");

  const direct = pick("name") || pick("full-name") || pick("fullName");
  if (direct) return direct;

  const first = pick("first-name") || pick("firstName");
  const last = pick("last-name") || pick("lastName");
  const combined = [first, last].filter(Boolean).join(" ").trim();
  return combined || null;
}

/**
 * Extracts ONLY safe support fields from a Memberstack admin member object. Never returns the full
 * member JSON blob — just the claim status plus identity needed to confirm the right account.
 *
 * @param {Record<string, unknown>} member Memberstack admin `member` object (`data` from the API).
 * @returns {{
 *   memberId: string | null,
 *   email: string | null,
 *   name: string | null,
 *   freeSleevelessPatternClaimed: boolean,
 *   freeSleevelessPatternId: string | null,
 *   hasMemberJson: boolean,
 * }}
 */
export function extractMemberSupportData(member) {
  const rec = asRecord(member);
  const auth = asRecord(rec.auth);

  const memberId = typeof rec.id === "string" && rec.id.trim() ? rec.id.trim() : null;
  const rawEmail =
    (typeof auth.email === "string" && auth.email) ||
    (typeof rec.email === "string" && rec.email) ||
    "";
  const email = rawEmail.trim() ? rawEmail.trim() : null;

  const json = rec.json;
  const hasMemberJson =
    !!json &&
    typeof json === "object" &&
    !Array.isArray(json) &&
    Object.keys(json).length > 0;

  const claim = readFreeClaimFromMemberJson(json);

  return {
    memberId,
    email,
    name: nameFromCustomFields(rec.customFields),
    freeSleevelessPatternClaimed: claim.freeSleevelessPatternClaimed,
    freeSleevelessPatternId: claim.freeSleevelessPatternId,
    hasMemberJson,
  };
}

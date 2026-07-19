/**
 * Pure helpers for matching saved custom-pattern project blob keys.
 * Shared by Watson Saved Pattern Inspector and the local owner CLI.
 */

/** @param {string} value */
export function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value ?? "").trim(),
  );
}

/**
 * @param {string} key
 * @param {string} projectId
 */
export function keyEndsWithProjectJson(key, projectId) {
  const id = String(projectId ?? "").trim();
  if (!id) return false;
  return String(key ?? "").endsWith(`/${id}.json`);
}

/**
 * Filter listed blob keys for the requested project id.
 * Ignores summary index files (`index.json`).
 *
 * @param {string[]} keys
 * @param {string} projectId
 * @returns {string[]}
 */
export function findMatchingProjectKeys(keys, projectId) {
  const list = Array.isArray(keys) ? keys : [];
  return list.filter((key) => {
    if (typeof key !== "string" || !key) return false;
    if (key.endsWith("/index.json") || key === "index.json") return false;
    return keyEndsWithProjectJson(key, projectId);
  });
}

/**
 * Parse owning Memberstack user id from
 * `{family}/{userId}/{projectId}.json`.
 *
 * @param {string} key
 * @returns {string | null}
 */
export function parseMemberstackUserIdFromKey(key) {
  const parts = String(key ?? "")
    .split("/")
    .filter(Boolean);
  if (parts.length < 3) return null;
  const userId = parts[parts.length - 2];
  return userId || null;
}

/**
 * @param {{ matchingKeys: string[] }} input
 * @returns {"one" | "none" | "many"}
 */
export function matchOutcome(input) {
  const n = Array.isArray(input?.matchingKeys) ? input.matchingKeys.length : 0;
  if (n === 0) return "none";
  if (n === 1) return "one";
  return "many";
}

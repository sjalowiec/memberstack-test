/**
 * Non-production helper: read a single KEY=value from the project-root `.env`.
 *
 * Astro `npm run dev` may not inject `.env` into Netlify function `process.env`.
 * Production must never read `.env` from disk — only `process.env` is authoritative there.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** @type {Map<string, string | null> | null} */
let cachedValues = null;

function isProductionNodeEnv() {
  return process.env.NODE_ENV === "production";
}

/**
 * Parse project-root `.env` into a map (non-production only). Cached per process.
 * @returns {Map<string, string | null>}
 */
function loadDotEnvMap() {
  if (cachedValues) return cachedValues;
  cachedValues = new Map();
  if (isProductionNodeEnv()) return cachedValues;

  try {
    const envPath = resolve(process.cwd(), ".env");
    if (!existsSync(envPath)) return cachedValues;
    const text = readFileSync(envPath, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) continue;
      let value = match[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      cachedValues.set(match[1], value);
    }
  } catch {
    /* unreadable .env — treat as unset */
  }
  return cachedValues;
}

/** Test helper: clear the in-memory `.env` cache. */
export function clearLocalDotEnvCache() {
  cachedValues = null;
}

/**
 * Read one variable from project-root `.env` outside production.
 * Returns null in production, or when the key is missing/empty.
 *
 * @param {string} name
 * @returns {string | null}
 */
export function readDotEnvValue(name) {
  if (isProductionNodeEnv()) return null;
  if (typeof name !== "string" || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) return null;
  const value = loadDotEnvMap().get(name);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

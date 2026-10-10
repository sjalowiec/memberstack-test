/**
 * Anonymous Set-In Sleeve testing on the hosted kin-dev site.
 *
 * This is not a membership bypass flag. It turns on only when Netlify's own
 * site identity is kin-dev AND the request host is kin-dev AND the Set-In
 * Sleeve client sent its fixed test header. Environment variables, URL query
 * parameters, and a client-chosen user id cannot turn it on. Production's
 * site id never matches, even if Host is spoofed or ALLOW_DEV_PATTERN_USER is
 * true.
 */
import { isKinDevMemberstackRuntime } from "./memberstack-admin.js";
import { resolvePatternSystemFromProject } from "./pattern-system-id.js";

/** Isolated blob owner. Not a Memberstack id, so it cannot collide with a member. */
export const KIN_DEV_SET_IN_SLEEVE_TEST_USER_ID = "kin-dev-set-in-sleeve-testing";

export const SET_IN_DEV_TEST_HEADER = "x-kbm-set-in-dev-test";

const KIN_DEV_HOST = "kin-dev.netlify.app";

/**
 * @param {string} hostname
 */
export function isKinDevRequestHost(hostname) {
  const host = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, "");
  return host === KIN_DEV_HOST || host.endsWith(`--${KIN_DEV_HOST}`);
}

/**
 * @param {Request} req
 */
export function requestHostname(req) {
  const forwarded = req.headers.get("x-forwarded-host");
  const raw = String(forwarded || req.headers.get("host") || "")
    .split(",")[0]
    .trim();
  return raw.split(":")[0].toLowerCase();
}

/**
 * True only for the hosted kin-dev Set-In Sleeve test client.
 * Ignores the request URL query string and every environment flag.
 *
 * @param {Request} req
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isKinDevSetInSleeveTestRequest(req, env = process.env) {
  if (!isKinDevMemberstackRuntime(env)) return false;
  if (!isKinDevRequestHost(requestHostname(req))) return false;
  return req.headers.get(SET_IN_DEV_TEST_HEADER)?.trim() === "1";
}

/**
 * @param {Request} req
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {{ ok: true, userId: string, mode: "dev", devTest: "set-in-sleeve" } | null}
 */
export function kinDevSetInSleeveTestIdentity(req, env = process.env) {
  if (!isKinDevSetInSleeveTestRequest(req, env)) return null;
  return {
    ok: true,
    userId: KIN_DEV_SET_IN_SLEEVE_TEST_USER_ID,
    mode: "dev",
    devTest: "set-in-sleeve",
  };
}

/**
 * @param {unknown} project
 */
export function isSetInSleeveProjectRecord(project) {
  if (!project || typeof project !== "object") return false;
  return resolvePatternSystemFromProject(project) === "set-in-sleeve";
}

export const SET_IN_DEV_TEST_TYPE_ERROR =
  "This development test identity can only open Set-In Sleeve patterns.";

/**
 * @param {{ devTest?: string } | null | undefined} access
 * @param {unknown} project
 * @returns {string | null}
 */
export function setInSleeveDevTestWriteError(access, project) {
  if (access?.devTest !== "set-in-sleeve") return null;
  if (isSetInSleeveProjectRecord(project)) return null;
  return SET_IN_DEV_TEST_TYPE_ERROR;
}

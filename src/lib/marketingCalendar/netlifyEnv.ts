import { spawnSync } from "node:child_process";

import { PRODUCTION_CAMPAIGN_SITE_ID } from "../watson/complimentaryCampaignSync";
import { MarketingCalendarError } from "./errors";

/** Production site variables the dry run may read. Values are never logged. */
export const NETLIFY_ACTIVE_CAMPAIGN_ENV_NAMES = [
  "ACTIVECAMPAIGN_API_KEY",
  "ACTIVECAMPAIGN_BASE_URL",
] as const;

export interface NetlifyCommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

export type NetlifyRunner = (args: string[]) => NetlifyCommandResult;

/**
 * Netlify's API and CLI return a short preview for a secret: asterisks plus
 * the last few characters. That preview is not the API key.
 */
export function isMaskedNetlifySecret(value: string): boolean {
  return value.trim().includes("*");
}

export const MASKED_SECRET_MESSAGE =
  "Netlify returned a masked ActiveCampaign API key, not the real secret. The dry run will not call ActiveCampaign. Run it from the Netlify function, where the unmasked secret is available. The production key was not changed.";

/**
 * Accept a real env:get value. The logged-out CLI exits 0 and prints
 * "No value set...", which must never be stored as a credential.
 * A masked secret preview is not a credential either.
 */
export function valueFromEnvGet(stdout: string): string | null {
  const trimmed = stdout.replace(/^\uFEFF/, "").trim();
  if (!trimmed || trimmed === "{}" || /no value set/i.test(trimmed)) return null;
  if (/not logged in|unauthorized/i.test(trimmed)) return null;
  if (isMaskedNetlifySecret(trimmed)) return null;
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      const values = Object.values(parsed).filter((value) => typeof value === "string" && value.trim());
      if (values.length !== 1) return null;
      const value = String(values[0]).trim();
      if (isMaskedNetlifySecret(value)) return null;
      return value;
    } catch {
      return null;
    }
  }
  return trimmed;
}

export function netlifyLoginRequired(statusText: string): boolean {
  return /not logged in/i.test(statusText);
}

export function publicCliText(text: string): string {
  return text
    .replace(/https?:\/\/[^\s"']+/g, "[redacted-url]")
    .replace(/[A-Za-z0-9_+/=-]{20,}/g, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}

export function applyNetlifyActiveCampaignEnv(
  env: NodeJS.ProcessEnv,
  input: { statusText: string; values: Record<string, string | null> },
): string[] {
  if (netlifyLoginRequired(input.statusText)) {
    throw new MarketingCalendarError(
      "Netlify CLI is not logged in, so the production ActiveCampaign variables were not read. Run npx netlify login in this project, then run the dry run again. Do not copy the API key into .env.",
      { code: "netlify-login" },
    );
  }
  const filled: string[] = [];
  for (const name of NETLIFY_ACTIVE_CAMPAIGN_ENV_NAMES) {
    if ((env[name] || "").trim()) continue;
    const value = input.values[name];
    if (!value) continue;
    if (name === "ACTIVECAMPAIGN_API_KEY" && isMaskedNetlifySecret(value)) {
      throw new MarketingCalendarError(MASKED_SECRET_MESSAGE, { code: "masked-secret" });
    }
    env[name] = value;
    filled.push(name);
  }
  return filled;
}

function defaultRunner(args: string[]): NetlifyCommandResult {
  const result = spawnSync("npx", ["netlify", ...args], {
    encoding: "utf8",
    shell: true,
    env: {
      ...process.env,
      NETLIFY_SITE_ID: PRODUCTION_CAMPAIGN_SITE_ID,
    },
  });
  return {
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

export interface ActiveCampaignEnvLoad {
  filled: string[];
  source: "already-set" | "netlify" | "environment";
}

/** Use ACTIVECAMPAIGN_API_URL only when the production Netlify value is unavailable. */
export function fillActiveCampaignBaseUrlFromApiUrl(env: NodeJS.ProcessEnv): boolean {
  if (!(env.ACTIVECAMPAIGN_API_KEY || "").trim()) return false;
  if (!(env.ACTIVECAMPAIGN_BASE_URL || "").trim()) {
    const raw = (env.ACTIVECAMPAIGN_API_URL || "").trim();
    if (!raw) return false;
    try {
      const url = new URL(raw);
      if (url.protocol !== "https:") return false;
      env.ACTIVECAMPAIGN_BASE_URL = url.origin;
    } catch {
      return false;
    }
  }
  return Boolean((env.ACTIVECAMPAIGN_BASE_URL || "").trim());
}

/**
 * Fill missing ActiveCampaign variables from the production Netlify site.
 * Values stay in the process environment and are not written to disk.
 */
export function loadNetlifyActiveCampaignEnv(
  env: NodeJS.ProcessEnv = process.env,
  run: NetlifyRunner = defaultRunner,
): ActiveCampaignEnvLoad {
  const missing = NETLIFY_ACTIVE_CAMPAIGN_ENV_NAMES.filter((name) => !(env[name] || "").trim());
  if (missing.length === 0) return { filled: [], source: "already-set" };

  const status = run(["status"]);
  const statusText = `${status.stdout}\n${status.stderr}`;
  const values: Record<string, string | null> = {};
  if (!netlifyLoginRequired(statusText)) {
    for (const name of missing) {
      const result = run(["env:get", name, "--context", "production"]);
      const raw = result.stdout.replace(/^\uFEFF/, "").trim();
      if (name === "ACTIVECAMPAIGN_API_KEY" && isMaskedNetlifySecret(raw)) {
        throw new MarketingCalendarError(MASKED_SECRET_MESSAGE, { code: "masked-secret" });
      }
      const value = valueFromEnvGet(result.stdout);
      if (name === "ACTIVECAMPAIGN_API_KEY" && value && isMaskedNetlifySecret(value)) {
        throw new MarketingCalendarError(MASKED_SECRET_MESSAGE, { code: "masked-secret" });
      }
      values[name] = value;
    }
  }
  try {
    return {
      filled: applyNetlifyActiveCampaignEnv(env, { statusText, values }),
      source: "netlify" as const,
    };
  } catch (error) {
    if (
      error instanceof MarketingCalendarError &&
      error.code === "netlify-login" &&
      fillActiveCampaignBaseUrlFromApiUrl(env)
    ) {
      return { filled: [], source: "environment" };
    }
    throw error;
  }
}

/**
 * Prefer the production Netlify values. A key already in the process
 * environment is used only when the Netlify CLI cannot read the site.
 */
export function loadPreferredActiveCampaignEnv(
  env: NodeJS.ProcessEnv = process.env,
  run: NetlifyRunner = defaultRunner,
): ActiveCampaignEnvLoad {
  const savedKey = env.ACTIVECAMPAIGN_API_KEY;
  const savedBase = env.ACTIVECAMPAIGN_BASE_URL;
  delete env.ACTIVECAMPAIGN_API_KEY;
  delete env.ACTIVECAMPAIGN_BASE_URL;
  try {
    const loaded = loadNetlifyActiveCampaignEnv(env, run);
    if ((env.ACTIVECAMPAIGN_API_KEY || "").trim() && (env.ACTIVECAMPAIGN_BASE_URL || "").trim()) {
      return loaded.source === "already-set" ? { filled: loaded.filled, source: "netlify" } : loaded;
    }
  } catch (error) {
    if (!(error instanceof MarketingCalendarError) || error.code !== "netlify-login") {
      if (savedKey) env.ACTIVECAMPAIGN_API_KEY = savedKey;
      if (savedBase) env.ACTIVECAMPAIGN_BASE_URL = savedBase;
      throw error;
    }
  }
  if (savedKey) env.ACTIVECAMPAIGN_API_KEY = savedKey;
  else delete env.ACTIVECAMPAIGN_API_KEY;
  if (savedBase) env.ACTIVECAMPAIGN_BASE_URL = savedBase;
  else delete env.ACTIVECAMPAIGN_BASE_URL;
  return loadNetlifyActiveCampaignEnv(env, run);
}

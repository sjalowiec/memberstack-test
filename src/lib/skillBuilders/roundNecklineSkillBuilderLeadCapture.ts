/**
 * Server-only lead capture for the free Round Neckline Skill Builder.
 * Reuses the shared ActiveCampaign Admin API client. The browser never talks to AC.
 *
 * Contact upsert + tag apply follow the same sequence as
 * `netlify/functions/memberstack-created.ts` (the proven working path).
 */

import {
  createActiveCampaignClient,
  getActiveCampaignConfig,
  type ActiveCampaignClient,
  type ActiveCampaignConfig,
} from "../activecampaign/client";
import { EMAIL_LIST_SIGNUP_EXPECTED_HOST } from "../email/emailListSignup";
import { safeActiveCampaignErrorSummary } from "../email/emailSignupRecord";
import {
  isValidEmailAddress,
  normalizeEmailAddress,
} from "../email/validateEmailAddress";
import {
  checkIpRateLimit,
  type IpRateLimitStore,
} from "../security/ipRateLimit";
import {
  ROUND_NECKLINE_SKILL_BUILDER_LEAD_MAX_EMAIL,
  ROUND_NECKLINE_SKILL_BUILDER_LEAD_MAX_FIRST_NAME,
  ROUND_NECKLINE_SKILL_BUILDER_LEAD_MESSAGES,
  ROUND_NECKLINE_SKILL_BUILDER_LEAD_TAG,
} from "./roundNecklineSkillBuilderLeadShared";

export {
  ROUND_NECKLINE_SKILL_BUILDER_LEAD_MESSAGES,
  ROUND_NECKLINE_SKILL_BUILDER_LEAD_TAG,
} from "./roundNecklineSkillBuilderLeadShared";

/** Current Knit It Now Admin API host, from the existing email-list-signup integration. */
export const ROUND_NECKLINE_SKILL_BUILDER_AC_DEFAULT_HOST =
  EMAIL_LIST_SIGNUP_EXPECTED_HOST;

export type RoundNecklineLeadRequestBody = {
  email?: unknown;
  firstName?: unknown;
  /** Honeypot — must be empty for humans. */
  "bot-field"?: unknown;
  botField?: unknown;
};

export type RoundNecklineLeadOutcome =
  | "created_and_tagged"
  | "already_tagged"
  | "honeypot"
  | "rate_limited"
  | "ac_unavailable";

export type RoundNecklineLeadHandlerResult =
  | {
      ok: true;
      status: 200;
      message: string;
      /** Server-only outcome; never returned to the browser. */
      outcome: RoundNecklineLeadOutcome;
    }
  | { ok: false; status: 400 | 429; error: string };

type HandlerOptions = {
  env?: NodeJS.ProcessEnv;
  createClient?: (
    config: { baseUrl: string; apiKey: string },
  ) => ActiveCampaignClient;
  rateLimitStore?: IpRateLimitStore;
  clientIp?: string;
  now?: number;
};

type AcEnvSource = "astro" | "process" | "default" | "missing";

function normalizeFirstName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readHoneypot(body: RoundNecklineLeadRequestBody): string {
  const raw = body["bot-field"] ?? body.botField ?? "";
  return typeof raw === "string" ? raw.trim() : "";
}

function success(outcome: RoundNecklineLeadOutcome): RoundNecklineLeadHandlerResult {
  return {
    ok: true,
    status: 200,
    message: ROUND_NECKLINE_SKILL_BUILDER_LEAD_MESSAGES.success,
    outcome,
  };
}

/** Astro inlines only literal import.meta.env.* access at build time. */
function readAstroActiveCampaignValue(
  name: "ACTIVECAMPAIGN_API_KEY" | "ACTIVECAMPAIGN_BASE_URL",
): string {
  if (typeof import.meta === "undefined" || !import.meta.env) return "";
  if (name === "ACTIVECAMPAIGN_API_KEY") {
    return String(import.meta.env.ACTIVECAMPAIGN_API_KEY ?? "").trim();
  }
  return String(import.meta.env.ACTIVECAMPAIGN_BASE_URL ?? "").trim().replace(/\/$/, "");
}

function hostnameOf(baseUrl: string): string | null {
  try {
    return new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Resolve AC credentials the same way other Astro server features do:
 * `import.meta.env` first (Vite/.env), then `process.env` (Netlify).
 * If the API key is present but BASE_URL is not, use the known Admin API host.
 */
export function resolveRoundNecklineLeadActiveCampaignConfig(
  env: NodeJS.ProcessEnv = process.env,
  options: { readAstroEnv?: boolean } = {},
): {
  config: ActiveCampaignConfig | null;
  apiKeySource: AcEnvSource;
  baseUrlSource: AcEnvSource;
  hostname: string | null;
} {
  const readAstro = options.readAstroEnv !== false;
  const astroKey = readAstro ? readAstroActiveCampaignValue("ACTIVECAMPAIGN_API_KEY") : "";
  const astroUrl = readAstro ? readAstroActiveCampaignValue("ACTIVECAMPAIGN_BASE_URL") : "";
  const processKey = (env.ACTIVECAMPAIGN_API_KEY || "").trim();
  const processUrl = (env.ACTIVECAMPAIGN_BASE_URL || "").trim().replace(/\/$/, "");

  const apiKey = astroKey || processKey;
  const apiKeySource: AcEnvSource = astroKey ? "astro" : processKey ? "process" : "missing";

  let baseUrl = astroUrl || processUrl;
  let baseUrlSource: AcEnvSource = astroUrl ? "astro" : processUrl ? "process" : "missing";
  if (apiKey && !baseUrl) {
    baseUrl = `https://${ROUND_NECKLINE_SKILL_BUILDER_AC_DEFAULT_HOST}`;
    baseUrlSource = "default";
  }

  const merged = getActiveCampaignConfig({
    ...env,
    ACTIVECAMPAIGN_API_KEY: apiKey,
    ACTIVECAMPAIGN_BASE_URL: baseUrl,
  });

  return {
    config: merged,
    apiKeySource,
    baseUrlSource,
    hostname: merged ? hostnameOf(merged.baseUrl) : hostnameOf(baseUrl),
  };
}

function logAcStep(
  step: string,
  extra: Record<string, unknown> = {},
): void {
  console.info("[skill-builder-round-neckline-lead]", { step, ...extra });
}

function safeErrorCauseCode(err: unknown): string | null {
  if (!err || typeof err !== "object" || !("cause" in err)) return null;
  const cause = err.cause;
  if (!cause || typeof cause !== "object" || !("code" in cause)) return null;
  return typeof cause.code === "string" ? cause.code : null;
}

function logAcFailure(
  step: string,
  err: unknown,
  extra: Record<string, unknown> = {},
): void {
  const raw = err instanceof Error ? err.message : "";
  const httpMatch = raw.match(/HTTP\s+(\d+)/i);
  console.error("[skill-builder-round-neckline-lead] ActiveCampaign step failed", {
    step,
    httpStatus: httpMatch?.[1] ?? null,
    causeCode: safeErrorCauseCode(err),
    summary: safeActiveCampaignErrorSummary(err),
    ...extra,
  });
}

async function applyLeadTag(
  ac: ActiveCampaignClient,
  contactId: string,
): Promise<"added" | "already"> {
  const tagId = await ac.resolveTagId(ROUND_NECKLINE_SKILL_BUILDER_LEAD_TAG, {
    create: true,
  });
  if (!tagId) {
    throw new Error("ActiveCampaign lead tag resolve failed");
  }
  if (await ac.contactHasTag(contactId, tagId)) {
    return "already";
  }
  await ac.addTag(contactId, tagId);
  return "added";
}

/**
 * Upsert the contact and apply the Round Neckline Skill Builder lead tag.
 * Invalid email / honeypot / rate-limit still reject or decoy as before.
 * ActiveCampaign integration failures are logged and do not block practice.
 */
export async function handleRoundNecklineSkillBuilderLeadRequest(
  body: RoundNecklineLeadRequestBody,
  options: HandlerOptions = {},
): Promise<RoundNecklineLeadHandlerResult> {
  const env = options.env ?? process.env;

  if (readHoneypot(body)) {
    console.info("[skill-builder-round-neckline-lead] Honeypot triggered — decoy success");
    return success("honeypot");
  }

  const rateCheck = checkIpRateLimit({
    ip: options.clientIp ?? "unknown",
    store: options.rateLimitStore,
    now: options.now,
  });
  if (!rateCheck.allowed) {
    console.warn("[skill-builder-round-neckline-lead] Rate limit exceeded — decoy success");
    return success("rate_limited");
  }

  const email = normalizeEmailAddress(body.email);
  const firstName = normalizeFirstName(body.firstName);

  if (email.length > ROUND_NECKLINE_SKILL_BUILDER_LEAD_MAX_EMAIL) {
    return {
      ok: false,
      status: 400,
      error: ROUND_NECKLINE_SKILL_BUILDER_LEAD_MESSAGES.fieldTooLong,
    };
  }
  if (firstName.length > ROUND_NECKLINE_SKILL_BUILDER_LEAD_MAX_FIRST_NAME) {
    return {
      ok: false,
      status: 400,
      error: ROUND_NECKLINE_SKILL_BUILDER_LEAD_MESSAGES.fieldTooLong,
    };
  }
  if (!isValidEmailAddress(email)) {
    return {
      ok: false,
      status: 400,
      error: ROUND_NECKLINE_SKILL_BUILDER_LEAD_MESSAGES.invalidEmail,
    };
  }

  const resolved = resolveRoundNecklineLeadActiveCampaignConfig(env, {
    readAstroEnv: options.env === undefined,
  });
  logAcStep("config", {
    hasApiKey: resolved.apiKeySource !== "missing",
    hasBaseUrl: resolved.baseUrlSource !== "missing",
    apiKeySource: resolved.apiKeySource,
    baseUrlSource: resolved.baseUrlSource,
    hostname: resolved.hostname,
  });

  if (!resolved.config) {
    console.error("[skill-builder-round-neckline-lead] Missing ActiveCampaign API key");
    return success("ac_unavailable");
  }

  const createClient = options.createClient ?? ((cfg) => createActiveCampaignClient(cfg));
  const ac = createClient(resolved.config);
  let step = "syncContact";

  try {
    // Same sequence as memberstack-created: sync upserts by email, then apply the tag.
    logAcStep(step);
    const synced = await ac.syncContact(
      firstName ? { email, firstName } : { email },
    );

    step = "resolveAndApplyTag";
    logAcStep(step, { tagName: ROUND_NECKLINE_SKILL_BUILDER_LEAD_TAG });
    const tagResult = await applyLeadTag(ac, synced.id);
    logAcStep("tagApplied", { tagResult });

    return success(tagResult === "added" ? "created_and_tagged" : "already_tagged");
  } catch (err) {
    logAcFailure(step, err);
    return success("ac_unavailable");
  }
}

/** Shape returned to the browser (no outcome / AC status fields). */
export function toPublicRoundNecklineLeadResponse(
  result: RoundNecklineLeadHandlerResult,
): { ok: true; message: string } | { ok: false; error: string } {
  if (result.ok) {
    return { ok: true, message: result.message };
  }
  return { ok: false, error: result.error };
}

/**
 * Shared server-only tagged lead capture (contact upsert + one AC tag).
 * The browser never talks to ActiveCampaign. Callers supply the tag name —
 * clients cannot choose an arbitrary tag.
 *
 * Fail-open: after a syntactically valid email, AC/config failures still
 * return success so a free product is not blocked.
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
  TAGGED_LEAD_MAX_EMAIL,
  TAGGED_LEAD_MAX_FIRST_NAME,
} from "./taggedLeadCaptureLimits";

export { TAGGED_LEAD_MAX_EMAIL, TAGGED_LEAD_MAX_FIRST_NAME } from "./taggedLeadCaptureLimits";

export const TAGGED_LEAD_AC_DEFAULT_HOST = EMAIL_LIST_SIGNUP_EXPECTED_HOST;

export type TaggedLeadRequestBody = {
  email?: unknown;
  firstName?: unknown;
  /** Honeypot — must be empty for humans. */
  "bot-field"?: unknown;
  botField?: unknown;
};

export type TaggedLeadOutcome =
  | "created_and_tagged"
  | "already_tagged"
  | "honeypot"
  | "rate_limited"
  | "ac_unavailable";

export type TaggedLeadMessages = {
  success: string;
  genericFailure: string;
  invalidEmail: string;
  fieldTooLong: string;
};

export type TaggedLeadHandlerResult =
  | {
      ok: true;
      status: 200;
      message: string;
      /** Server-only outcome; never returned to the browser. */
      outcome: TaggedLeadOutcome;
    }
  | { ok: false; status: 400 | 429; error: string };

export type TaggedLeadHandlerOptions = {
  tag: string;
  messages: TaggedLeadMessages;
  logPrefix: string;
  maxEmail?: number;
  maxFirstName?: number;
  env?: NodeJS.ProcessEnv;
  createClient?: (
    config: { baseUrl: string; apiKey: string },
  ) => ActiveCampaignClient;
  rateLimitStore?: IpRateLimitStore;
  clientIp?: string;
  now?: number;
  readAstroEnv?: boolean;
};

type AcEnvSource = "astro" | "process" | "default" | "missing";

function normalizeFirstName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readHoneypot(body: TaggedLeadRequestBody): string {
  const raw = body["bot-field"] ?? body.botField ?? "";
  return typeof raw === "string" ? raw.trim() : "";
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
export function resolveLeadActiveCampaignConfig(
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
    baseUrl = `https://${TAGGED_LEAD_AC_DEFAULT_HOST}`;
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
  logPrefix: string,
  step: string,
  extra: Record<string, unknown> = {},
): void {
  console.info(`[${logPrefix}]`, { step, ...extra });
}

function safeErrorCauseCode(err: unknown): string | null {
  if (!err || typeof err !== "object" || !("cause" in err)) return null;
  const cause = err.cause;
  if (!cause || typeof cause !== "object" || !("code" in cause)) return null;
  return typeof cause.code === "string" ? cause.code : null;
}

function logAcFailure(
  logPrefix: string,
  step: string,
  err: unknown,
  extra: Record<string, unknown> = {},
): void {
  const raw = err instanceof Error ? err.message : "";
  const httpMatch = raw.match(/HTTP\s+(\d+)/i);
  console.error(`[${logPrefix}] ActiveCampaign step failed`, {
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
  tagName: string,
): Promise<"added" | "already"> {
  const tagId = await ac.resolveTagId(tagName, {
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
 * Upsert the contact and apply the caller-supplied lead tag.
 * Invalid email still rejects. Honeypot / rate-limit return decoy success.
 * ActiveCampaign integration failures are logged and do not block the product.
 */
export async function handleTaggedLeadCaptureRequest(
  body: TaggedLeadRequestBody,
  options: TaggedLeadHandlerOptions,
): Promise<TaggedLeadHandlerResult> {
  const env = options.env ?? process.env;
  const messages = options.messages;
  const logPrefix = options.logPrefix;
  const maxEmail = options.maxEmail ?? TAGGED_LEAD_MAX_EMAIL;
  const maxFirstName = options.maxFirstName ?? TAGGED_LEAD_MAX_FIRST_NAME;

  const success = (outcome: TaggedLeadOutcome): TaggedLeadHandlerResult => ({
    ok: true,
    status: 200,
    message: messages.success,
    outcome,
  });

  if (readHoneypot(body)) {
    console.info(`[${logPrefix}] Honeypot triggered — decoy success`);
    return success("honeypot");
  }

  const rateCheck = checkIpRateLimit({
    ip: options.clientIp ?? "unknown",
    store: options.rateLimitStore,
    now: options.now,
  });
  if (!rateCheck.allowed) {
    console.warn(`[${logPrefix}] Rate limit exceeded — decoy success`);
    return success("rate_limited");
  }

  const email = normalizeEmailAddress(body.email);
  const firstName = normalizeFirstName(body.firstName);

  if (email.length > maxEmail) {
    return {
      ok: false,
      status: 400,
      error: messages.fieldTooLong,
    };
  }
  if (firstName.length > maxFirstName) {
    return {
      ok: false,
      status: 400,
      error: messages.fieldTooLong,
    };
  }
  if (!isValidEmailAddress(email)) {
    return {
      ok: false,
      status: 400,
      error: messages.invalidEmail,
    };
  }

  const resolved = resolveLeadActiveCampaignConfig(env, {
    readAstroEnv: options.readAstroEnv ?? options.env === undefined,
  });
  logAcStep(logPrefix, "config", {
    hasApiKey: resolved.apiKeySource !== "missing",
    hasBaseUrl: resolved.baseUrlSource !== "missing",
    apiKeySource: resolved.apiKeySource,
    baseUrlSource: resolved.baseUrlSource,
    hostname: resolved.hostname,
  });

  if (!resolved.config) {
    console.error(`[${logPrefix}] Missing ActiveCampaign API key`);
    return success("ac_unavailable");
  }

  const createClient = options.createClient ?? ((cfg) => createActiveCampaignClient(cfg));
  const ac = createClient(resolved.config);
  let step = "syncContact";

  try {
    logAcStep(logPrefix, step);
    const synced = await ac.syncContact(
      firstName ? { email, firstName } : { email },
    );

    step = "resolveAndApplyTag";
    logAcStep(logPrefix, step, { tagName: options.tag });
    const tagResult = await applyLeadTag(ac, synced.id, options.tag);
    logAcStep(logPrefix, "tagApplied", { tagResult });

    return success(tagResult === "added" ? "created_and_tagged" : "already_tagged");
  } catch (err) {
    logAcFailure(logPrefix, step, err);
    return success("ac_unavailable");
  }
}

/** Shape returned to the browser (no outcome / AC status fields). */
export function toPublicLeadResponse(
  result: TaggedLeadHandlerResult,
): { ok: true; message: string } | { ok: false; error: string } {
  if (result.ok) {
    return { ok: true, message: result.message };
  }
  return { ok: false, error: result.error };
}

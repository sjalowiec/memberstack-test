/**
 * First-party email list signup (Tip of the Week lead magnet).
 * ActiveCampaign Admin API is the source of truth; browser never talks to AC.
 */

import {
  createActiveCampaignClient,
  getActiveCampaignConfig,
  type ActiveCampaignClient,
  type ActiveCampaignListStatus,
} from "../activecampaign/client";
import {
  checkIpRateLimit,
  type IpRateLimitStore,
} from "../security/ipRateLimit";
import {
  isValidEmailAddress,
  normalizeEmailAddress,
} from "./validateEmailAddress";
import {
  EMAIL_LIST_SIGNUP_MAX_EMAIL,
  EMAIL_LIST_SIGNUP_MAX_FIRST_NAME,
  EMAIL_LIST_SIGNUP_MESSAGES,
  EMAIL_LIST_SIGNUP_SOURCE_TAG,
  EMAIL_SIGNUP_SOURCE_TIP_OF_THE_WEEK,
} from "./emailListSignupShared";
import {
  mapSignupResultToRecord,
  recordEmailSignupQuietly,
  safeActiveCampaignErrorSummary,
  type EmailListSignupOutcome,
  type EmailSignupRecorder,
} from "./emailSignupRecord";

export {
  EMAIL_LIST_SIGNUP_MAX_EMAIL,
  EMAIL_LIST_SIGNUP_MAX_FIRST_NAME,
  EMAIL_LIST_SIGNUP_MESSAGES,
  EMAIL_LIST_SIGNUP_SOURCE_TAG,
} from "./emailListSignupShared";

export type { EmailListSignupOutcome } from "./emailSignupRecord";

/** Admin API hostname (ACTIVECAMPAIGN_BASE_URL). Not the browser dashboard host. */
export const EMAIL_LIST_SIGNUP_EXPECTED_HOST = "knititnow.api-us1.com";
export const EMAIL_LIST_SIGNUP_RETIRED_HOST = "knitbymachine.activehosted.com";
/** Dashboard / marketing UI host — valid in the browser, not for Admin API calls. */
export const EMAIL_LIST_SIGNUP_DASHBOARD_HOST = "knititnow.activehosted.com";

/** List statuses that must never be overridden by subscribeToList. */
const CONSENT_PROTECTED_STATUSES: ReadonlySet<ActiveCampaignListStatus> =
  new Set(["unsubscribed", "bounced", "unconfirmed", "unknown"]);

export type EmailListSignupRequestBody = {
  firstName?: unknown;
  email?: unknown;
  /** Honeypot — must be empty for humans. */
  "bot-field"?: unknown;
  botField?: unknown;
  /** Reserved for a future Turnstile token. */
  turnstileToken?: unknown;
};

export type EmailListSignupPublicMessage = "subscribed" | "already";

export type EmailListSignupHandlerResult =
  | {
      ok: true;
      status: 200;
      message: string;
      messageKey: EmailListSignupPublicMessage;
      /** Server-only outcome; never returned to the browser. */
      outcome: EmailListSignupOutcome;
    }
  | { ok: false; status: 400 | 429 | 500 | 502; error: string };

type HandlerOptions = {
  env?: NodeJS.ProcessEnv;
  createClient?: (
    config: { baseUrl: string; apiKey: string },
  ) => ActiveCampaignClient;
  listId?: string | null;
  rateLimitStore?: IpRateLimitStore;
  clientIp?: string;
  now?: number;
  /** Override hostname check (tests). */
  assertHostname?: (baseUrl: string) => HostnameCheckResult;
  /** Persist signup results for Watson reporting (defaults to Watson DB). */
  recordSignup?: EmailSignupRecorder;
  /** Signup source label for reporting; defaults to tip-of-the-week. */
  signupSource?: string;
};

export type HostnameCheckResult =
  | { ok: true; hostname: string }
  | {
      ok: false;
      hostname: string | null;
      reason: "invalid_url" | "retired_host" | "unexpected_host";
    };

export function normalizeFirstName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function getEmailListSignupListId(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  return (env.ACTIVECAMPAIGN_KIN_LIST_ID || "").trim() || null;
}

/**
 * ActiveCampaign Admin API must target the current Knit It Now account host.
 * Does not log or return the full URL (may contain path/query noise); hostname only.
 */
export function checkActiveCampaignSignupHostname(
  baseUrl: string,
): HostnameCheckResult {
  let hostname: string | null = null;
  try {
    hostname = new URL(baseUrl).hostname.toLowerCase();
  } catch {
    return { ok: false, hostname: null, reason: "invalid_url" };
  }

  if (hostname === EMAIL_LIST_SIGNUP_RETIRED_HOST) {
    return { ok: false, hostname, reason: "retired_host" };
  }
  if (hostname !== EMAIL_LIST_SIGNUP_EXPECTED_HOST) {
    return { ok: false, hostname, reason: "unexpected_host" };
  }
  return { ok: true, hostname };
}

function readHoneypot(body: EmailListSignupRequestBody): string {
  const raw = body["bot-field"] ?? body.botField ?? "";
  return typeof raw === "string" ? raw.trim() : "";
}

function publicMessage(key: EmailListSignupPublicMessage): string {
  return EMAIL_LIST_SIGNUP_MESSAGES[key];
}

function success(
  messageKey: EmailListSignupPublicMessage,
  outcome: EmailListSignupOutcome,
): EmailListSignupHandlerResult {
  return {
    ok: true,
    status: 200,
    message: publicMessage(messageKey),
    messageKey,
    outcome,
  };
}

async function ensureSourceTag(
  ac: ActiveCampaignClient,
  contactId: string,
): Promise<void> {
  const tagId = await ac.resolveTagId(EMAIL_LIST_SIGNUP_SOURCE_TAG, {
    create: true,
  });
  if (!tagId) {
    throw new Error("ActiveCampaign source tag resolve failed");
  }
  if (!(await ac.contactHasTag(contactId, tagId))) {
    await ac.addTag(contactId, tagId);
  }
}

function outcomeForProtectedStatus(
  status: ActiveCampaignListStatus,
): EmailListSignupOutcome {
  switch (status) {
    case "unsubscribed":
      return "skipped_unsubscribed";
    case "bounced":
      return "skipped_bounced";
    case "unconfirmed":
      return "skipped_unconfirmed";
    default:
      return "skipped_unknown_status";
  }
}

async function persistSignupResult(input: {
  email: string;
  source: string;
  result: EmailListSignupHandlerResult;
  recordSignup?: EmailSignupRecorder;
  failureOutcome?: string | null;
  errorSummary?: string | null;
}): Promise<void> {
  const record = mapSignupResultToRecord({
    email: input.email,
    source: input.source,
    result: input.result,
    failureOutcome: input.failureOutcome,
    errorSummary: input.errorSummary,
  });
  await recordEmailSignupQuietly(record, { recorder: input.recordSignup });
}

/**
 * Process a public email-list signup. Never includes list/contact status
 * details in the public message — only generic subscribed / already copy.
 */
export async function handleEmailListSignupRequest(
  body: EmailListSignupRequestBody,
  options: HandlerOptions = {},
): Promise<EmailListSignupHandlerResult> {
  const env = options.env ?? process.env;
  const signupSource =
    options.signupSource ?? EMAIL_SIGNUP_SOURCE_TIP_OF_THE_WEEK;

  // Honeypot: decoy success (same idea as contact form).
  if (readHoneypot(body)) {
    console.info("[email-list-signup] Honeypot triggered — decoy success");
    return success("already", "honeypot");
  }

  const rateCheck = checkIpRateLimit({
    ip: options.clientIp ?? "unknown",
    store: options.rateLimitStore,
    now: options.now,
  });
  if (!rateCheck.allowed) {
    console.warn("[email-list-signup] Rate limit exceeded — decoy success");
    return success("already", "rate_limited");
  }

  const firstName = normalizeFirstName(body.firstName);
  const email = normalizeEmailAddress(body.email);

  if (!firstName) {
    return {
      ok: false,
      status: 400,
      error: EMAIL_LIST_SIGNUP_MESSAGES.invalidFirstName,
    };
  }
  if (
    firstName.length > EMAIL_LIST_SIGNUP_MAX_FIRST_NAME ||
    email.length > EMAIL_LIST_SIGNUP_MAX_EMAIL
  ) {
    return {
      ok: false,
      status: 400,
      error: EMAIL_LIST_SIGNUP_MESSAGES.fieldTooLong,
    };
  }
  if (!isValidEmailAddress(email)) {
    return {
      ok: false,
      status: 400,
      error: EMAIL_LIST_SIGNUP_MESSAGES.invalidEmail,
    };
  }

  const config = getActiveCampaignConfig(env);
  const listId = options.listId ?? getEmailListSignupListId(env);

  if (!config || !listId) {
    console.error(
      "[email-list-signup] Missing ActiveCampaign config or KIN list id",
    );
    const result: EmailListSignupHandlerResult = {
      ok: false,
      status: 500,
      error: EMAIL_LIST_SIGNUP_MESSAGES.genericFailure,
    };
    await persistSignupResult({
      email,
      source: signupSource,
      result,
      recordSignup: options.recordSignup,
      failureOutcome: "config_missing",
      errorSummary: "Missing ActiveCampaign configuration",
    });
    return result;
  }

  const hostnameCheck = (options.assertHostname ?? checkActiveCampaignSignupHostname)(
    config.baseUrl,
  );
  if (!hostnameCheck.ok) {
    console.error(
      "[email-list-signup] ActiveCampaign base URL hostname is not compatible",
      {
        reason: hostnameCheck.reason,
        hostname: hostnameCheck.hostname,
        expected: EMAIL_LIST_SIGNUP_EXPECTED_HOST,
      },
    );
    const result: EmailListSignupHandlerResult = {
      ok: false,
      status: 500,
      error: EMAIL_LIST_SIGNUP_MESSAGES.genericFailure,
    };
    await persistSignupResult({
      email,
      source: signupSource,
      result,
      recordSignup: options.recordSignup,
      failureOutcome: "hostname_invalid",
      errorSummary: "ActiveCampaign hostname is not compatible",
    });
    return result;
  }

  const createClient =
    options.createClient ??
    ((cfg) => createActiveCampaignClient(cfg));
  const ac = createClient(config);

  try {
    const listOk = await ac.listExists(listId);
    if (!listOk) {
      console.error("[email-list-signup] Configured KIN list id was not found");
      const result: EmailListSignupHandlerResult = {
        ok: false,
        status: 500,
        error: EMAIL_LIST_SIGNUP_MESSAGES.genericFailure,
      };
      await persistSignupResult({
        email,
        source: signupSource,
        result,
        recordSignup: options.recordSignup,
        failureOutcome: "list_not_found",
        errorSummary: "Configured mailing list was not found",
      });
      return result;
    }

    const existing = await ac.findContactByEmail(email);

    if (!existing) {
      const synced = await ac.syncContact({ email, firstName });
      await ac.subscribeToList(synced.id, listId);
      await ensureSourceTag(ac, synced.id);
      const result = success("subscribed", "created_and_subscribed");
      await persistSignupResult({
        email,
        source: signupSource,
        result,
        recordSignup: options.recordSignup,
      });
      return result;
    }

    const contactId = existing.id;
    const listStatus = await ac.getListStatus(contactId, listId);

    if (CONSENT_PROTECTED_STATUSES.has(listStatus)) {
      // Consent remains authoritative: update name only, never subscribeToList.
      await ac.syncContact({ email, firstName });
      const result = success("already", outcomeForProtectedStatus(listStatus));
      await persistSignupResult({
        email,
        source: signupSource,
        result,
        recordSignup: options.recordSignup,
      });
      return result;
    }

    // Refresh first name on existing contacts when they submit the form.
    await ac.syncContact({ email, firstName });

    if (listStatus === "not_on_list") {
      await ac.subscribeToList(contactId, listId);
      await ensureSourceTag(ac, contactId);
      const result = success("subscribed", "subscribed_existing");
      await persistSignupResult({
        email,
        source: signupSource,
        result,
        recordSignup: options.recordSignup,
      });
      return result;
    }

    // Already active on the list — tag only, no re-subscribe.
    await ensureSourceTag(ac, contactId);
    const result = success("already", "already_subscribed");
    await persistSignupResult({
      email,
      source: signupSource,
      result,
      recordSignup: options.recordSignup,
    });
    return result;
  } catch (err) {
    // Never log emails, names, API keys, or AC response bodies.
    const raw = err instanceof Error ? err.message : "";
    const httpMatch = raw.match(/HTTP\s+(\d+)/i);
    console.error("[email-list-signup] ActiveCampaign request failed", {
      httpStatus: httpMatch?.[1] ?? null,
    });
    const result: EmailListSignupHandlerResult = {
      ok: false,
      status: 502,
      error: EMAIL_LIST_SIGNUP_MESSAGES.genericFailure,
    };
    await persistSignupResult({
      email,
      source: signupSource,
      result,
      recordSignup: options.recordSignup,
      failureOutcome: "ac_request_failed",
      errorSummary: safeActiveCampaignErrorSummary(err),
    });
    return result;
  }
}

/** Shape returned to the browser (no outcome / AC status fields). */
export function toPublicEmailListSignupResponse(
  result: EmailListSignupHandlerResult,
): { ok: true; message: string } | { ok: false; error: string } {
  if (result.ok) {
    return { ok: true, message: result.message };
  }
  return { ok: false, error: result.error };
}

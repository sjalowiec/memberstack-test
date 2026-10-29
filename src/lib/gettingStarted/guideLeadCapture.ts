/**
 * Getting Started Guide signup.
 * Adds the contact to the existing Knit It Now list
 * (`ACTIVECAMPAIGN_KIN_LIST_ID`) and applies the lead tag by name.
 * contact/sync updates the same contact; it does not create a second one.
 *
 * Unsubscribe, bounce, and unconfirmed statuses are left alone: no list
 * subscribe and no tag. A tag add can start an automation, so those contacts
 * are not tagged.
 *
 * Repeat signup does not call subscribeToList for someone already active, and
 * does not call addTag when the lead tag is already present. Those two calls
 * are what restart "subscribed to list" and "tag added" automations.
 * syncContact still runs, so an automation triggered by a contact update could
 * run again. This repo cannot see that automation configuration.
 *
 * ActiveCampaign failures do not unlock the guide.
 */

import {
  createActiveCampaignClient,
  getActiveCampaignConfig,
  getActiveCampaignKinListId,
  type ActiveCampaignClient,
  type ActiveCampaignListStatus,
} from "../activecampaign/client";
import {
  checkActiveCampaignSignupHostname,
  EMAIL_LIST_SIGNUP_EXPECTED_HOST,
} from "../email/emailListSignup";
import {
  mapSignupResultToRecord,
  recordEmailSignupQuietly,
  safeActiveCampaignErrorSummary,
  type EmailListSignupOutcome,
  type EmailSignupRecorder,
} from "../email/emailSignupRecord";
import {
  EMAIL_LIST_SIGNUP_MAX_EMAIL,
  EMAIL_LIST_SIGNUP_MAX_FIRST_NAME,
} from "../email/emailListSignupShared";
import {
  isValidEmailAddress,
  normalizeEmailAddress,
} from "../email/validateEmailAddress";
import {
  checkIpRateLimit,
  type IpRateLimitStore,
} from "../security/ipRateLimit";
import {
  GETTING_STARTED_GUIDE_LEAD_TAG,
  GETTING_STARTED_GUIDE_MESSAGES,
  GETTING_STARTED_GUIDE_SIGNUP_SOURCE,
} from "./guideLeadShared";

export {
  GETTING_STARTED_GUIDE_LEAD_TAG,
  GETTING_STARTED_GUIDE_MESSAGES,
  GETTING_STARTED_GUIDE_SIGNUP_SOURCE,
} from "./guideLeadShared";

const CONSENT_PROTECTED_STATUSES: ReadonlySet<ActiveCampaignListStatus> = new Set([
  "unsubscribed",
  "bounced",
  "unconfirmed",
  "unknown",
]);

export type GettingStartedGuideLeadBody = {
  firstName?: unknown;
  email?: unknown;
  "bot-field"?: unknown;
  botField?: unknown;
};

export type GettingStartedGuideLeadResult =
  | {
      ok: true;
      status: 200;
      message: string;
      outcome: EmailListSignupOutcome;
    }
  | { ok: false; status: 400 | 429 | 500 | 502; error: string };

type HandlerOptions = {
  env?: NodeJS.ProcessEnv;
  createClient?: (config: { baseUrl: string; apiKey: string }) => ActiveCampaignClient;
  listId?: string | null;
  rateLimitStore?: IpRateLimitStore;
  clientIp?: string;
  now?: number;
  recordSignup?: EmailSignupRecorder;
};

function normalizeFirstName(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readHoneypot(body: GettingStartedGuideLeadBody): string {
  const raw = body["bot-field"] ?? body.botField ?? "";
  return typeof raw === "string" ? raw.trim() : "";
}

function failure(
  status: 400 | 429 | 500 | 502,
  error: string,
): GettingStartedGuideLeadResult {
  return { ok: false, status, error };
}

async function persist(input: {
  email: string;
  result: GettingStartedGuideLeadResult;
  recordSignup?: EmailSignupRecorder;
  failureOutcome?: string | null;
  errorSummary?: string | null;
}): Promise<void> {
  const record = mapSignupResultToRecord({
    email: input.email,
    source: GETTING_STARTED_GUIDE_SIGNUP_SOURCE,
    result: input.result,
    failureOutcome: input.failureOutcome,
    errorSummary: input.errorSummary,
  });
  await recordEmailSignupQuietly(record, { recorder: input.recordSignup });
}

function protectedOutcome(status: ActiveCampaignListStatus): EmailListSignupOutcome {
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

async function ensureLeadTag(
  ac: ActiveCampaignClient,
  contactId: string,
): Promise<"added" | "already"> {
  const tagId = await ac.resolveTagId(GETTING_STARTED_GUIDE_LEAD_TAG, {
    create: true,
  });
  if (!tagId) {
    throw new Error("ActiveCampaign lead tag resolve failed");
  }
  if (await ac.contactHasTag(contactId, tagId)) return "already";
  await ac.addTag(contactId, tagId);
  return "added";
}

export async function handleGettingStartedGuideLeadRequest(
  body: GettingStartedGuideLeadBody,
  options: HandlerOptions = {},
): Promise<GettingStartedGuideLeadResult> {
  const env = options.env ?? process.env;

  if (readHoneypot(body)) {
    console.info("[getting-started-guide-lead] Honeypot triggered");
    return failure(400, GETTING_STARTED_GUIDE_MESSAGES.genericFailure);
  }

  const rateCheck = checkIpRateLimit({
    ip: options.clientIp ?? "unknown",
    store: options.rateLimitStore,
    now: options.now,
  });
  if (!rateCheck.allowed) {
    console.warn("[getting-started-guide-lead] Rate limit exceeded");
    return failure(429, GETTING_STARTED_GUIDE_MESSAGES.genericFailure);
  }

  const firstName = normalizeFirstName(body.firstName);
  const email = normalizeEmailAddress(body.email);

  if (!firstName) {
    return failure(400, GETTING_STARTED_GUIDE_MESSAGES.invalidFirstName);
  }
  if (
    firstName.length > EMAIL_LIST_SIGNUP_MAX_FIRST_NAME ||
    email.length > EMAIL_LIST_SIGNUP_MAX_EMAIL
  ) {
    return failure(400, GETTING_STARTED_GUIDE_MESSAGES.fieldTooLong);
  }
  if (!isValidEmailAddress(email)) {
    return failure(400, GETTING_STARTED_GUIDE_MESSAGES.invalidEmail);
  }

  const config = getActiveCampaignConfig(env);
  const listId = options.listId ?? getActiveCampaignKinListId(env);
  if (!config || !listId) {
    console.error("[getting-started-guide-lead] Missing ActiveCampaign config or KIN list id");
    const result = failure(500, GETTING_STARTED_GUIDE_MESSAGES.genericFailure);
    await persist({
      email,
      result,
      recordSignup: options.recordSignup,
      failureOutcome: "config_missing",
      errorSummary: "Missing ActiveCampaign configuration",
    });
    return result;
  }

  const hostnameCheck = checkActiveCampaignSignupHostname(config.baseUrl);
  if (!hostnameCheck.ok) {
    console.error("[getting-started-guide-lead] ActiveCampaign hostname is not compatible", {
      reason: hostnameCheck.reason,
      hostname: hostnameCheck.hostname,
      expected: EMAIL_LIST_SIGNUP_EXPECTED_HOST,
    });
    const result = failure(500, GETTING_STARTED_GUIDE_MESSAGES.genericFailure);
    await persist({
      email,
      result,
      recordSignup: options.recordSignup,
      failureOutcome: "hostname_invalid",
      errorSummary: "ActiveCampaign hostname is not compatible",
    });
    return result;
  }

  const ac = (options.createClient ?? createActiveCampaignClient)(config);

  try {
    const listOk = await ac.listExists(listId);
    if (!listOk) {
      console.error("[getting-started-guide-lead] Configured KIN list id was not found");
      const result = failure(500, GETTING_STARTED_GUIDE_MESSAGES.genericFailure);
      await persist({
        email,
        result,
        recordSignup: options.recordSignup,
        failureOutcome: "list_not_found",
        errorSummary: "Configured mailing list was not found",
      });
      return result;
    }

    const existing = await ac.findContactByEmail(email);
    const synced = await ac.syncContact({ email, firstName });
    const listStatus = await ac.getListStatus(synced.id, listId);

    if (CONSENT_PROTECTED_STATUSES.has(listStatus)) {
      const result: GettingStartedGuideLeadResult = {
        ok: true,
        status: 200,
        message: GETTING_STARTED_GUIDE_MESSAGES.success,
        outcome: protectedOutcome(listStatus),
      };
      await persist({ email, result, recordSignup: options.recordSignup });
      return result;
    }

    if (listStatus === "not_on_list") {
      await ac.subscribeToList(synced.id, listId);
    }
    await ensureLeadTag(ac, synced.id);

    const result: GettingStartedGuideLeadResult = {
      ok: true,
      status: 200,
      message: GETTING_STARTED_GUIDE_MESSAGES.success,
      outcome:
        listStatus === "not_on_list"
          ? existing
            ? "subscribed_existing"
            : "created_and_subscribed"
          : "already_subscribed",
    };
    await persist({ email, result, recordSignup: options.recordSignup });
    return result;
  } catch (err) {
    const raw = err instanceof Error ? err.message : "";
    const httpMatch = raw.match(/HTTP\s+(\d+)/i);
    console.error("[getting-started-guide-lead] ActiveCampaign request failed", {
      httpStatus: httpMatch?.[1] ?? null,
    });
    const result = failure(502, GETTING_STARTED_GUIDE_MESSAGES.genericFailure);
    await persist({
      email,
      result,
      recordSignup: options.recordSignup,
      failureOutcome: "ac_request_failed",
      errorSummary: safeActiveCampaignErrorSummary(err),
    });
    return result;
  }
}

export function toPublicGettingStartedGuideLeadResponse(
  result: GettingStartedGuideLeadResult,
): { ok: true; message: string } | { ok: false; error: string } {
  if (result.ok) return { ok: true, message: result.message };
  return { ok: false, error: result.error };
}

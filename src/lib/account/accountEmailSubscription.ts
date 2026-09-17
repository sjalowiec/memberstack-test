/**
 * Authenticated Account-page marketing-list status and explicit resubscribe.
 * ActiveCampaign Admin API stays server-side. Email is taken only from the
 * verified Memberstack session — never from the browser body/query.
 */

import {
  createActiveCampaignClient,
  getActiveCampaignConfig,
  getActiveCampaignKinListId,
  type ActiveCampaignClient,
  type ActiveCampaignListStatus,
} from "../activecampaign/client";
import { safeActiveCampaignErrorSummary } from "../email/emailSignupRecord";
import {
  isValidEmailAddress,
  normalizeEmailAddress,
} from "../email/validateEmailAddress";
import {
  ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES,
  ACCOUNT_EMAIL_SUBSCRIPTION_TAG,
  canResubscribeFromState,
  type AccountEmailSubscriptionState,
} from "./accountEmailSubscriptionShared";

export {
  ACCOUNT_EMAIL_SUBSCRIPTION_BUTTON_LABEL,
  ACCOUNT_EMAIL_SUBSCRIPTION_CONSENT,
  ACCOUNT_EMAIL_SUBSCRIPTION_HEADING,
  ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES,
  ACCOUNT_EMAIL_SUBSCRIPTION_TAG,
  canResubscribeFromState,
  type AccountEmailSubscriptionState,
} from "./accountEmailSubscriptionShared";

const LOG_PREFIX = "[account-email-subscription]";

/** List statuses that ActiveCampaign will not treat as eligible for a status=1 subscribe. */
const BOUNCED_OR_SUPPRESSED: ReadonlySet<AccountEmailSubscriptionState> = new Set([
  "bounced",
]);

export type AccountEmailSubscriptionMemberNames = {
  firstName?: string;
  lastName?: string;
};

export type AccountEmailSubscriptionCheckResult =
  | {
      ok: true;
      status: 200;
      state: Exclude<AccountEmailSubscriptionState, "unavailable">;
      canResubscribe: boolean;
    }
  | {
      ok: false;
      status: 401 | 503 | 502;
      state: "unavailable";
      error: string;
    };

export type AccountEmailSubscriptionResubscribeResult =
  | {
      ok: true;
      status: 200;
      state: "active";
      message: string;
    }
  | {
      ok: false;
      status: 400 | 401 | 409 | 502 | 503;
      state: AccountEmailSubscriptionState;
      error: string;
    };

type HandlerOptions = {
  env?: NodeJS.ProcessEnv;
  createClient?: (
    config: { baseUrl: string; apiKey: string },
  ) => ActiveCampaignClient;
};

function mapListStatusToState(
  listStatus: ActiveCampaignListStatus,
): Exclude<AccountEmailSubscriptionState, "unavailable" | "not_found"> {
  switch (listStatus) {
    case "active":
      return "active";
    case "unsubscribed":
      return "unsubscribed";
    case "unconfirmed":
      return "unconfirmed";
    case "bounced":
      return "bounced";
    case "not_on_list":
      return "not_on_list";
    default:
      return "unknown";
  }
}

function logAcFailure(step: string, err: unknown): void {
  const raw = err instanceof Error ? err.message : "";
  const httpMatch = raw.match(/HTTP\s+(\d+)/i);
  console.error(`${LOG_PREFIX} ActiveCampaign request failed`, {
    step,
    httpStatus: httpMatch?.[1] ?? null,
    summary: safeActiveCampaignErrorSummary(err),
  });
}

function trimmedName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function customFieldName(
  customFields: unknown,
  ...keys: string[]
): string | undefined {
  if (!customFields || typeof customFields !== "object" || Array.isArray(customFields)) {
    return undefined;
  }
  const fields = customFields as Record<string, unknown>;
  for (const key of keys) {
    const value = trimmedName(fields[key]);
    if (value) return value;
  }
  return undefined;
}

/** First/last name from a Memberstack Admin member record. */
export function namesFromMemberstackRecord(
  record: unknown,
): AccountEmailSubscriptionMemberNames {
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return {};
  }
  const member = record as Record<string, unknown>;
  const auth =
    member.auth && typeof member.auth === "object" && !Array.isArray(member.auth)
      ? (member.auth as Record<string, unknown>)
      : null;

  const firstName =
    customFieldName(member.customFields, "first-name", "firstName") ||
    trimmedName(auth?.firstName);
  const lastName =
    customFieldName(member.customFields, "last-name", "lastName") ||
    trimmedName(auth?.lastName);

  return {
    ...(firstName ? { firstName } : {}),
    ...(lastName ? { lastName } : {}),
  };
}

function resolveSessionEmail(email: unknown): string | null {
  const normalized = normalizeEmailAddress(email).toLowerCase();
  if (!normalized || !isValidEmailAddress(normalized)) return null;
  return normalized;
}

async function getConfiguredClient(
  options: HandlerOptions,
): Promise<
  | { ok: true; ac: ActiveCampaignClient; listId: string }
  | { ok: false; status: 503; error: string }
> {
  const env = options.env ?? process.env;
  const config = getActiveCampaignConfig(env);
  const listId = getActiveCampaignKinListId(env);
  if (!config || !listId) {
    console.error(`${LOG_PREFIX} Missing ActiveCampaign config or KIN list id`);
    return {
      ok: false,
      status: 503,
      error: ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.unavailable,
    };
  }

  const createClient =
    options.createClient ?? ((cfg) => createActiveCampaignClient(cfg));
  return { ok: true, ac: createClient(config), listId };
}

async function applyResubscribeTag(
  ac: ActiveCampaignClient,
  contactId: string,
): Promise<void> {
  const tagId = await ac.resolveTagId(ACCOUNT_EMAIL_SUBSCRIPTION_TAG, {
    create: true,
  });
  if (!tagId) {
    console.error(`${LOG_PREFIX} Could not resolve resubscribe tag`);
    return;
  }
  if (await ac.contactHasTag(contactId, tagId)) return;
  await ac.addTag(contactId, tagId);
}

/**
 * Read-only list status for the authenticated member's email.
 * Never subscribes, resubscribes, syncs, or tags.
 */
export async function checkAccountEmailSubscription(
  email: unknown,
  options: HandlerOptions = {},
): Promise<AccountEmailSubscriptionCheckResult> {
  const sessionEmail = resolveSessionEmail(email);
  if (!sessionEmail) {
    return {
      ok: false,
      status: 503,
      state: "unavailable",
      error: ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.missingEmail,
    };
  }

  const configured = await getConfiguredClient(options);
  if (!configured.ok) {
    return {
      ok: false,
      status: configured.status,
      state: "unavailable",
      error: ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.unavailable,
    };
  }

  const { ac, listId } = configured;

  try {
    const existing = await ac.findContactByEmail(sessionEmail);
    if (!existing) {
      return {
        ok: true,
        status: 200,
        state: "not_found",
        canResubscribe: true,
      };
    }

    const listStatus = await ac.getListStatus(existing.id, listId);
    const state = mapListStatusToState(listStatus);
    return {
      ok: true,
      status: 200,
      state,
      canResubscribe: canResubscribeFromState(state),
    };
  } catch (err) {
    logAcFailure("status", err);
    return {
      ok: false,
      status: 502,
      state: "unavailable",
      error: ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.unavailable,
    };
  }
}

/**
 * Explicit-consent resubscribe for the authenticated member's email.
 * Does not read or use a client-supplied email address.
 */
export async function resubscribeAccountEmailSubscription(
  email: unknown,
  names: AccountEmailSubscriptionMemberNames = {},
  options: HandlerOptions = {},
): Promise<AccountEmailSubscriptionResubscribeResult> {
  const sessionEmail = resolveSessionEmail(email);
  if (!sessionEmail) {
    return {
      ok: false,
      status: 503,
      state: "unavailable",
      error: ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.missingEmail,
    };
  }

  const configured = await getConfiguredClient(options);
  if (!configured.ok) {
    return {
      ok: false,
      status: configured.status,
      state: "unavailable",
      error: ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.genericFailure,
    };
  }

  const { ac, listId } = configured;
  const firstName = trimmedName(names.firstName);
  const lastName = trimmedName(names.lastName);

  try {
    const listOk = await ac.listExists(listId);
    if (!listOk) {
      console.error(`${LOG_PREFIX} Configured KIN list id was not found`);
      return {
        ok: false,
        status: 503,
        state: "unavailable",
        error: ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.genericFailure,
      };
    }

    const existing = await ac.findContactByEmail(sessionEmail);

    if (!existing) {
      const synced = await ac.syncContact({
        email: sessionEmail,
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
      });
      await ac.subscribeToList(synced.id, listId);
      try {
        await applyResubscribeTag(ac, synced.id);
      } catch (err) {
        logAcFailure("tag", err);
      }
      return {
        ok: true,
        status: 200,
        state: "active",
        message: ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.nowSubscribed,
      };
    }

    const contactId = existing.id;
    const listStatus = await ac.getListStatus(contactId, listId);
    const state = mapListStatusToState(listStatus);

    if (BOUNCED_OR_SUPPRESSED.has(state)) {
      return {
        ok: false,
        status: 409,
        state,
        error: ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.bouncedBlocked,
      };
    }

    if (state !== "active") {
      await ac.subscribeToList(contactId, listId);
    }

    try {
      await applyResubscribeTag(ac, contactId);
    } catch (err) {
      logAcFailure("tag", err);
    }

    return {
      ok: true,
      status: 200,
      state: "active",
      message: ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.nowSubscribed,
    };
  } catch (err) {
    logAcFailure("resubscribe", err);
    return {
      ok: false,
      status: 502,
      state: "unavailable",
      error: ACCOUNT_EMAIL_SUBSCRIPTION_MESSAGES.genericFailure,
    };
  }
}

/** Public GET body — no email, list id, or contact id. */
export function toPublicAccountEmailSubscriptionStatus(
  result: AccountEmailSubscriptionCheckResult,
): {
  ok: boolean;
  state: AccountEmailSubscriptionState;
  canResubscribe?: boolean;
  error?: string;
} {
  if (result.ok) {
    return {
      ok: true,
      state: result.state,
      canResubscribe: result.canResubscribe,
    };
  }
  return {
    ok: false,
    state: result.state,
    error: result.error,
  };
}

/** Public POST body — no email, list id, or contact id. */
export function toPublicAccountEmailSubscriptionResubscribe(
  result: AccountEmailSubscriptionResubscribeResult,
): { ok: true; state: "active"; message: string } | { ok: false; error: string; state?: AccountEmailSubscriptionState } {
  if (result.ok) {
    return {
      ok: true,
      state: result.state,
      message: result.message,
    };
  }
  return {
    ok: false,
    error: result.error,
    state: result.state,
  };
}

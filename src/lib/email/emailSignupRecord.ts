/**
 * Map and optionally persist email-list signup results for Watson reporting.
 * Never logs or returns ActiveCampaign credentials or raw API bodies.
 *
 * This module has no database imports — callers inject a recorder (the API
 * route wires Watson Postgres). That keeps browser signup scripts free of `pg`.
 */

import { EMAIL_SIGNUP_SOURCE_TIP_OF_THE_WEEK } from "./emailListSignupShared";

export { EMAIL_SIGNUP_SOURCE_TIP_OF_THE_WEEK } from "./emailListSignupShared";

/** Outcomes produced by the email list signup handler (server-only). */
export type EmailListSignupOutcome =
  | "created_and_subscribed"
  | "subscribed_existing"
  | "already_subscribed"
  | "skipped_unsubscribed"
  | "skipped_bounced"
  | "skipped_unconfirmed"
  | "skipped_unknown_status"
  | "honeypot"
  | "rate_limited";

/** Minimal handler result shape needed for reporting (avoids circular imports). */
export type EmailListSignupResultForRecord =
  | {
      ok: true;
      outcome: EmailListSignupOutcome;
    }
  | { ok: false; status: number };

export type EmailSignupRecordStatus =
  | "added"
  | "already-subscribed"
  | "not-added"
  | "failed";

export type EmailSignupRecordInput = {
  email: string;
  source: string;
  status: EmailSignupRecordStatus;
  /** Server-only ActiveCampaign / handler outcome for troubleshooting. */
  outcome: string | null;
  /** Short safe failure summary; never secrets or AC response bodies. */
  errorSummary: string | null;
  createdAt?: Date;
};

export type EmailSignupRecorder = (
  input: EmailSignupRecordInput,
) => Promise<void>;

const ADDED_OUTCOMES: ReadonlySet<EmailListSignupOutcome> = new Set([
  "created_and_subscribed",
  "subscribed_existing",
]);

const NOT_ADDED_OUTCOMES: ReadonlySet<EmailListSignupOutcome> = new Set([
  "skipped_unsubscribed",
  "skipped_bounced",
  "skipped_unconfirmed",
  "skipped_unknown_status",
]);

const SKIP_RECORD_OUTCOMES: ReadonlySet<EmailListSignupOutcome> = new Set([
  "honeypot",
  "rate_limited",
]);

/**
 * Map a handler result to a DB record, or null when nothing should be stored
 * (validation failures, honeypot, rate-limit decoys).
 */
export function mapSignupResultToRecord(input: {
  email: string;
  source?: string;
  result: EmailListSignupResultForRecord;
  failureOutcome?: string | null;
  errorSummary?: string | null;
}): EmailSignupRecordInput | null {
  const email = input.email.trim().toLowerCase();
  if (!email) return null;

  const source = input.source ?? EMAIL_SIGNUP_SOURCE_TIP_OF_THE_WEEK;
  const { result } = input;

  if (result.ok) {
    if (SKIP_RECORD_OUTCOMES.has(result.outcome)) return null;

    if (ADDED_OUTCOMES.has(result.outcome)) {
      return {
        email,
        source,
        status: "added",
        outcome: result.outcome,
        errorSummary: null,
      };
    }

    if (result.outcome === "already_subscribed") {
      return {
        email,
        source,
        status: "already-subscribed",
        outcome: result.outcome,
        errorSummary: null,
      };
    }

    if (NOT_ADDED_OUTCOMES.has(result.outcome)) {
      return {
        email,
        source,
        status: "not-added",
        outcome: result.outcome,
        errorSummary: null,
      };
    }

    return null;
  }

  // Validation (400) — never reached ActiveCampaign; do not store.
  if (result.status === 400) return null;
  // Rate-limit as HTTP 429 if ever returned that way — do not store.
  if (result.status === 429) return null;

  return {
    email,
    source,
    status: "failed",
    outcome: input.failureOutcome ?? "failed",
    errorSummary: input.errorSummary ?? "Signup failed",
  };
}

export function safeActiveCampaignErrorSummary(err: unknown): string {
  const raw = err instanceof Error ? err.message : "";
  const httpMatch = raw.match(/HTTP\s+(\d+)/i);
  if (httpMatch) {
    return `ActiveCampaign request failed (HTTP ${httpMatch[1]})`;
  }
  return "ActiveCampaign request failed";
}

/**
 * Persist a mapped signup record when a recorder is provided. Swallows DB
 * errors so signup UX is never broken by reporting infrastructure.
 */
export async function recordEmailSignupQuietly(
  input: EmailSignupRecordInput | null,
  options: {
    recorder?: EmailSignupRecorder;
    onError?: (err: unknown) => void;
  } = {},
): Promise<void> {
  if (!input || !options.recorder) return;
  try {
    await options.recorder(input);
  } catch (err) {
    const log =
      options.onError ??
      ((e: unknown) => {
        console.error("[email-list-signup] Failed to record signup result", {
          status: input.status,
          outcome: input.outcome,
          message: e instanceof Error ? e.message : "unknown",
        });
      });
    log(err);
  }
}

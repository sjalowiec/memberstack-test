/**
 * Server-only loader for the Watson Email Signups report.
 */

import { EMAIL_SIGNUP_SOURCE_TIP_OF_THE_WEEK } from "../email/emailListSignupShared";
import type { WatsonQueryFn } from "./memberSearch";
import {
  addCivilDays,
  laCivilDateOf,
  laCivilMidnightUtc,
} from "./salesReportDates";
import {
  computeEmailSignupsReport,
  EMAIL_SIGNUP_SOURCE_LABELS,
  type EmailSignupEvent,
  type EmailSignupsReport,
} from "./emailSignupsReport";

type SignupRow = {
  created_at: Date | string;
  status: string;
  source: string;
};

/**
 * Load signup events spanning the report window (previous 30 + current 30 =
 * 60 LA days ending today) so comparisons and the daily table are complete.
 */
export async function loadEmailSignupsReport(options: {
  now?: Date;
  queryFn?: WatsonQueryFn;
  source?: string;
} = {}): Promise<EmailSignupsReport> {
  const now = options.now ?? new Date();
  const today = laCivilDateOf(now);
  const windowStart = laCivilMidnightUtc(addCivilDays(today, -59));
  const windowEnd = laCivilMidnightUtc(addCivilDays(today, 1));
  const source = options.source ?? EMAIL_SIGNUP_SOURCE_TIP_OF_THE_WEEK;

  const queryFn =
    options.queryFn ??
    (await import("./db")).queryWatson;

  const rows = await queryFn<SignupRow>(
    `SELECT created_at, status, source
     FROM watson_email_signups
     WHERE source = $1
       AND created_at >= $2::timestamptz
       AND created_at < $3::timestamptz
     ORDER BY created_at ASC`,
    [source, windowStart.toISOString(), windowEnd.toISOString()],
  );

  const events: EmailSignupEvent[] = rows.map((row) => ({
    createdAt:
      row.created_at instanceof Date
        ? row.created_at
        : new Date(row.created_at),
    status: row.status,
    source: row.source,
  }));

  return computeEmailSignupsReport({
    events,
    now,
    sourceLabel: EMAIL_SIGNUP_SOURCE_LABELS[source] ?? source,
  });
}

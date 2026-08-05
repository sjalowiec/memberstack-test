/**
 * Server-only Watson Postgres insert for email signup reporting rows.
 */

import { queryWatson } from "../watson/db";
import type { EmailSignupRecordInput } from "./emailSignupRecord";

export async function insertEmailSignupRecord(
  input: EmailSignupRecordInput,
): Promise<void> {
  await queryWatson(
    `INSERT INTO watson_email_signups
      (email, source, status, outcome, error_summary, created_at)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, NOW()))`,
    [
      input.email,
      input.source,
      input.status,
      input.outcome,
      input.errorSummary,
      input.createdAt ?? null,
    ],
  );
}

/**
 * Legacy annual renewal reminders.
 *
 * Legacy annual members were imported into Memberstack on the free legacy
 * membership plan. When they continue, they DO NOT advance their Watson
 * paid-through date (`legacy_members.subscriptionexpiring`); they buy a new paid
 * Knit It Now membership in Memberstack. Therefore the unchanged legacy date can
 * never prove they have not repurchased.
 *
 * This job sends renewal nudges by tagging the member in ActiveCampaign at 30, 7
 * and 1 day before the Watson paid-through date - but only after re-checking
 * Memberstack (authoritative for "has repurchased"). It never modifies Watson
 * dates and never touches the separate legacy annual expiration process.
 *
 * Source-of-truth split:
 *   - Watson  = WHEN to remind (subscriptionexpiring, America/Los_Angeles day).
 *   - Memberstack = WHETHER to remind (active paid plan? then skip).
 *   - ActiveCampaign = delivery only (date field + tag -> automation -> email).
 *
 * Safety: dry-run performs zero ActiveCampaign writes and writes no audit rows.
 */
import { memberHasActivePaidMembership } from "../membership/membershipCheckoutDecision";
import {
  calendarYmdForNow,
  MEMBERSHIP_STATUS_CALENDAR_TIMEZONE,
} from "../membership/membershipStatusSummary";
import {
  createActiveCampaignClient,
  getActiveCampaignConfig,
  type ActiveCampaignClient,
  type ActiveCampaignListStatus,
} from "../activecampaign/client";
import { normalizeCustomerEmail } from "./customerIdentifier";
import { queryWatson } from "./db";
import {
  buildMemberstackEmailIndex,
  defaultLoadMemberstackMembers,
  resolveMemberstackMemberFromIndex,
  type LoadMemberstackMembers,
  type MemberstackEmailResolution,
  type ResolveMemberstackMemberByEmail,
} from "./legacyAnnualExpiry";
import { isStaffOrTestEmail } from "./legacyMembershipReportsShared";
import type { WatsonQueryFn } from "./memberSearch";

export type ReminderTriggerSource = "manual" | "scheduled";

/** Reminder windows, in days before the Watson paid-through date. */
export const REMINDER_WINDOW_DAYS = [30, 7, 1] as const;
export type ReminderWindowDays = (typeof REMINDER_WINDOW_DAYS)[number];

/** The exact ActiveCampaign tag applied for each window. */
export const REMINDER_TAG_BY_WINDOW: Record<ReminderWindowDays, string> = {
  30: "legacy-renewal-30-day",
  7: "legacy-renewal-7-day",
  1: "legacy-renewal-1-day",
};

export type ReminderOutcome =
  | "tagged"
  | "would_tag"
  | "skipped_active_paid"
  | "skipped_ambiguous"
  | "skipped_missing_email"
  | "skipped_staff_or_test"
  | "skipped_already_tagged"
  | "skipped_unsubscribed"
  | "skipped_bounced"
  | "skipped_unconfirmed"
  | "failure";

export interface ReminderCandidateRow {
  memberid: string;
  fristname: string | null;
  email: string | null;
  subscriptionexpiring: Date | string | null;
}

export interface ReminderDetail {
  windowDays: ReminderWindowDays;
  tag: string;
  legacyMemberId: string;
  email: string | null;
  paidThrough: string | null;
  memberstackId: string | null;
  memberstackResolution: "unique" | "not_found" | "ambiguous" | "missing_email" | null;
  acContactId: string | null;
  listStatus: ActiveCampaignListStatus | null;
  created: boolean;
  subscribed: boolean;
  outcome: ReminderOutcome;
  reason?: string;
  error?: string;
}

export interface ReminderWindowSummary {
  windowDays: ReminderWindowDays;
  tagName: string;
  candidatesFound: number;
  tagged: number;
  wouldTag: number;
  skippedActivePaid: number;
  skippedAmbiguous: number;
  skippedMissingEmail: number;
  skippedStaffOrTest: number;
  skippedAlreadyTagged: number;
  skippedUnsubscribed: number;
  skippedBounced: number;
  skippedUnconfirmed: number;
  createdContacts: number;
  failures: number;
}

export interface ReminderTotals {
  candidatesFound: number;
  tagged: number;
  wouldTag: number;
  skippedActivePaid: number;
  skippedAmbiguous: number;
  skippedMissingEmail: number;
  skippedStaffOrTest: number;
  skippedAlreadyTagged: number;
  skippedUnsubscribed: number;
  skippedBounced: number;
  skippedUnconfirmed: number;
  createdContacts: number;
  failures: number;
}

export interface LegacyRenewalReminderResult {
  ok: boolean;
  dryRun: boolean;
  triggerSource: ReminderTriggerSource;
  todayLosAngeles: string;
  listId: string | null;
  paidThroughFieldId: string | null;
  windows: ReminderWindowSummary[];
  totals: ReminderTotals;
  details: ReminderDetail[];
  errorMessage: string | null;
  completedAt: string | null;
}

/** One durable audit row (live outcomes only). */
export interface ReminderAuditRow {
  asOfDate: string;
  windowDays: ReminderWindowDays;
  tagName: string;
  legacyMemberId: string;
  email: string | null;
  paidThrough: string | null;
  memberstackId: string | null;
  memberstackResolution: string | null;
  acContactId: string | null;
  listStatus: string | null;
  outcome: ReminderOutcome;
  triggerSource: ReminderTriggerSource;
  error: string | null;
}

/**
 * Members whose paid-through calendar day is exactly `windowDays` after the
 * supplied America/Los_Angeles day. Monthly subscribers are excluded (they
 * auto-renew via Stripe); beta rows are excluded (mirrors the current-member
 * universe). `$1::date` keeps the comparison on the business calendar.
 */
export const REMINDER_WINDOW_MEMBERS_SQL = `
  SELECT
    m.memberid,
    m.fristname,
    m.email,
    m.subscriptionexpiring
  FROM legacy_members m
  WHERE COALESCE(m.betaactive, 0) = 0
    AND m.subscriptionexpiring IS NOT NULL
    AND COALESCE(m.monthlysubscriber, 0) <> 1
    AND m.subscriptionexpiring::date = ($1::date + ($2 || ' days')::interval)::date
  ORDER BY m.subscriptionexpiring ASC NULLS LAST, m.memberid ASC
`;

export async function loadReminderCandidates(
  todayLosAngeles: string,
  windowDays: ReminderWindowDays,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<ReminderCandidateRow[]> {
  return queryFn<ReminderCandidateRow>(REMINDER_WINDOW_MEMBERS_SQL, [
    todayLosAngeles,
    windowDays,
  ]);
}

/** Add N days to a YYYY-MM-DD string, returning YYYY-MM-DD (UTC-based math). */
export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map((part) => Number.parseInt(part, 10));
  const base = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

/** Default durable audit reader: has this member already been tagged (live)? */
async function defaultHasTaggedRecord(
  legacyMemberId: string,
  tagName: string,
  queryFn: WatsonQueryFn,
): Promise<boolean> {
  const rows = await queryFn<{ one: number }>(
    `SELECT 1 AS one FROM watson_legacy_renewal_reminders
     WHERE legacy_memberid = $1 AND tag_name = $2 AND outcome = 'tagged'
     LIMIT 1`,
    [legacyMemberId, tagName],
  );
  return rows.length > 0;
}

/** Default durable audit writer (called for LIVE attempts only). */
async function defaultRecordAttempt(
  row: ReminderAuditRow,
  queryFn: WatsonQueryFn,
): Promise<void> {
  await queryFn(
    `INSERT INTO watson_legacy_renewal_reminders (
       as_of_date, window_days, tag_name, legacy_memberid, email, paid_through,
       memberstack_id, memberstack_resolution, ac_contact_id, list_status,
       outcome, dry_run, trigger_source, error
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, FALSE, $12, $13)`,
    [
      row.asOfDate,
      row.windowDays,
      row.tagName,
      row.legacyMemberId,
      row.email,
      row.paidThrough,
      row.memberstackId,
      row.memberstackResolution,
      row.acContactId,
      row.listStatus,
      row.outcome,
      row.triggerSource,
      row.error,
    ],
  );
}

export interface RunLegacyRenewalRemindersOptions {
  /** When true (default), report intended changes without any AC/audit writes. */
  dryRun?: boolean;
  triggerSource?: ReminderTriggerSource;
  /** Deterministic "now" for the LA calendar day (tests inject this). */
  now?: Date;
  queryFn?: WatsonQueryFn;
  /** Injected AC client (tests). Defaults to the real HTTP client from env. */
  activeCampaign?: ActiveCampaignClient;
  /** Existing KIN list id. Defaults to ACTIVECAMPAIGN_KIN_LIST_ID. */
  listId?: string;
  /** Date custom-field id. Defaults to ACTIVECAMPAIGN_PAID_THROUGH_FIELD_ID. */
  paidThroughFieldId?: string;
  /** Per-email Memberstack resolver (tests). */
  resolveMemberstackMemberByEmail?: ResolveMemberstackMemberByEmail;
  /** Bulk Memberstack loader (defaults to a single paged Admin scan). */
  loadMemberstackMembers?: LoadMemberstackMembers;
  /** Durable dedupe lookup (defaults to Watson audit query). */
  hasTaggedRecord?: (legacyMemberId: string, tagName: string) => Promise<boolean>;
  /** Durable audit writer for LIVE attempts (defaults to Watson insert). */
  recordAttempt?: (row: ReminderAuditRow) => Promise<void>;
  /** Skip validating that the AC list id exists (tests). */
  skipListValidation?: boolean;
}

function emptyWindowSummary(windowDays: ReminderWindowDays): ReminderWindowSummary {
  return {
    windowDays,
    tagName: REMINDER_TAG_BY_WINDOW[windowDays],
    candidatesFound: 0,
    tagged: 0,
    wouldTag: 0,
    skippedActivePaid: 0,
    skippedAmbiguous: 0,
    skippedMissingEmail: 0,
    skippedStaffOrTest: 0,
    skippedAlreadyTagged: 0,
    skippedUnsubscribed: 0,
    skippedBounced: 0,
    skippedUnconfirmed: 0,
    createdContacts: 0,
    failures: 0,
  };
}

function tallyOutcome(
  summary: ReminderWindowSummary,
  outcome: ReminderOutcome,
  created: boolean,
): void {
  switch (outcome) {
    case "tagged":
      summary.tagged += 1;
      break;
    case "would_tag":
      summary.wouldTag += 1;
      break;
    case "skipped_active_paid":
      summary.skippedActivePaid += 1;
      break;
    case "skipped_ambiguous":
      summary.skippedAmbiguous += 1;
      break;
    case "skipped_missing_email":
      summary.skippedMissingEmail += 1;
      break;
    case "skipped_staff_or_test":
      summary.skippedStaffOrTest += 1;
      break;
    case "skipped_already_tagged":
      summary.skippedAlreadyTagged += 1;
      break;
    case "skipped_unsubscribed":
      summary.skippedUnsubscribed += 1;
      break;
    case "skipped_bounced":
      summary.skippedBounced += 1;
      break;
    case "skipped_unconfirmed":
      summary.skippedUnconfirmed += 1;
      break;
    case "failure":
      summary.failures += 1;
      break;
  }
  if (created) summary.createdContacts += 1;
}

function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 300);
}

/**
 * Resolve (and dedupe) candidate emails once for the whole run. Multiple legacy
 * member rows sharing one normalized email are treated as ambiguous.
 */
function groupByEmail(
  candidates: Array<{ windowDays: ReminderWindowDays; row: ReminderCandidateRow }>,
): Map<string, Array<{ windowDays: ReminderWindowDays; row: ReminderCandidateRow }>> {
  const byEmail = new Map<
    string,
    Array<{ windowDays: ReminderWindowDays; row: ReminderCandidateRow }>
  >();
  for (const entry of candidates) {
    const normalized = normalizeCustomerEmail(entry.row.email);
    if (!normalized) continue;
    const group = byEmail.get(normalized) ?? [];
    group.push(entry);
    byEmail.set(normalized, group);
  }
  return byEmail;
}

export async function runLegacyRenewalReminders(
  options: RunLegacyRenewalRemindersOptions = {},
): Promise<LegacyRenewalReminderResult> {
  const now = options.now ?? new Date();
  const todayLosAngeles = calendarYmdForNow(now, MEMBERSHIP_STATUS_CALENDAR_TIMEZONE);
  const dryRun = options.dryRun ?? true;
  const triggerSource = options.triggerSource ?? "manual";
  const queryFn = options.queryFn ?? queryWatson;

  const listId =
    options.listId ?? ((process.env.ACTIVECAMPAIGN_KIN_LIST_ID || "").trim() || null);
  const paidThroughFieldId =
    options.paidThroughFieldId ??
    ((process.env.ACTIVECAMPAIGN_PAID_THROUGH_FIELD_ID || "").trim() || null);

  const windows = REMINDER_WINDOW_DAYS.map((days) => emptyWindowSummary(days));
  const details: ReminderDetail[] = [];

  const result: LegacyRenewalReminderResult = {
    ok: false,
    dryRun,
    triggerSource,
    todayLosAngeles,
    listId,
    paidThroughFieldId,
    windows,
    totals: {
      candidatesFound: 0,
      tagged: 0,
      wouldTag: 0,
      skippedActivePaid: 0,
      skippedAmbiguous: 0,
      skippedMissingEmail: 0,
      skippedStaffOrTest: 0,
      skippedAlreadyTagged: 0,
      skippedUnsubscribed: 0,
      skippedBounced: 0,
      skippedUnconfirmed: 0,
      createdContacts: 0,
      failures: 0,
    },
    details,
    errorMessage: null,
    completedAt: null,
  };

  const windowSummaryFor = (windowDays: ReminderWindowDays): ReminderWindowSummary =>
    windows.find((w) => w.windowDays === windowDays)!;

  try {
    if (!listId) {
      throw new Error(
        "ACTIVECAMPAIGN_KIN_LIST_ID is not set. Configure the existing Knit It Now list id (never auto-created).",
      );
    }
    if (!paidThroughFieldId) {
      throw new Error(
        "ACTIVECAMPAIGN_PAID_THROUGH_FIELD_ID is not set. Configure the 'Legacy Membership Paid Through' date field id.",
      );
    }

    // Resolve the ActiveCampaign client (real HTTP client from env unless injected).
    let ac = options.activeCampaign;
    if (!ac) {
      const config = getActiveCampaignConfig();
      if (!config) {
        throw new Error(
          "Missing ACTIVECAMPAIGN_API_KEY or ACTIVECAMPAIGN_BASE_URL for renewal reminders.",
        );
      }
      ac = createActiveCampaignClient(config);
    }

    // Fail fast if the configured list id does not exist; never create one.
    if (!options.skipListValidation) {
      const exists = await ac.listExists(listId);
      if (!exists) {
        throw new Error(
          `ActiveCampaign list ${listId} was not found. Set ACTIVECAMPAIGN_KIN_LIST_ID to the existing Knit It Now list.`,
        );
      }
    }

    const hasTaggedRecord =
      options.hasTaggedRecord ??
      ((memberId: string, tagName: string) =>
        defaultHasTaggedRecord(memberId, tagName, queryFn));
    const recordAttempt =
      options.recordAttempt ?? ((row: ReminderAuditRow) => defaultRecordAttempt(row, queryFn));

    // 1) Gather candidates for all three windows.
    const allCandidates: Array<{
      windowDays: ReminderWindowDays;
      row: ReminderCandidateRow;
    }> = [];
    for (const windowDays of REMINDER_WINDOW_DAYS) {
      const rows = await loadReminderCandidates(todayLosAngeles, windowDays, queryFn);
      windowSummaryFor(windowDays).candidatesFound = rows.length;
      for (const row of rows) {
        allCandidates.push({ windowDays, row });
      }
    }

    // 2) Resolve Memberstack once (bulk index) unless a per-email resolver is injected.
    const byEmail = groupByEmail(allCandidates);
    let resolveMember: ResolveMemberstackMemberByEmail;
    if (options.resolveMemberstackMemberByEmail) {
      resolveMember = options.resolveMemberstackMemberByEmail;
    } else if (byEmail.size === 0) {
      resolveMember = async () => ({ status: "not_found" }) satisfies MemberstackEmailResolution;
    } else {
      const load = options.loadMemberstackMembers ?? defaultLoadMemberstackMembers;
      const { members } = await load();
      const index = buildMemberstackEmailIndex(members);
      resolveMember = async (email: string) =>
        resolveMemberstackMemberFromIndex(index, email);
    }

    // 3) Process each candidate.
    const pushDetail = async (detail: ReminderDetail): Promise<void> => {
      details.push(detail);
      tallyOutcome(windowSummaryFor(detail.windowDays), detail.outcome, detail.created);
      if (!dryRun) {
        await recordAttempt({
          asOfDate: todayLosAngeles,
          windowDays: detail.windowDays,
          tagName: detail.tag,
          legacyMemberId: detail.legacyMemberId,
          email: detail.email,
          paidThrough: detail.paidThrough,
          memberstackId: detail.memberstackId,
          memberstackResolution: detail.memberstackResolution,
          acContactId: detail.acContactId,
          listStatus: detail.listStatus,
          outcome: detail.outcome,
          triggerSource,
          error: detail.error ?? null,
        });
      }
    };

    for (const entry of allCandidates) {
      const { windowDays, row } = entry;
      const tag = REMINDER_TAG_BY_WINDOW[windowDays];
      const paidThrough = addDaysYmd(todayLosAngeles, windowDays);
      const normalizedEmail = normalizeCustomerEmail(row.email);

      const base: ReminderDetail = {
        windowDays,
        tag,
        legacyMemberId: row.memberid,
        email: row.email,
        paidThrough,
        memberstackId: null,
        memberstackResolution: null,
        acContactId: null,
        listStatus: null,
        created: false,
        subscribed: false,
        outcome: "failure",
      };

      // Missing email -> cannot contact.
      if (!normalizedEmail) {
        await pushDetail({
          ...base,
          memberstackResolution: "missing_email",
          outcome: "skipped_missing_email",
          reason: "missing_email",
        });
        continue;
      }

      // Never email staff/test addresses.
      if (isStaffOrTestEmail(normalizedEmail)) {
        await pushDetail({
          ...base,
          outcome: "skipped_staff_or_test",
          reason: "staff_or_test_email",
        });
        continue;
      }

      // Ambiguous legacy email (same email on multiple legacy member rows).
      const group = byEmail.get(normalizedEmail) ?? [];
      const distinctMemberIds = new Set(group.map((g) => g.row.memberid));
      if (distinctMemberIds.size > 1) {
        await pushDetail({
          ...base,
          memberstackResolution: "ambiguous",
          outcome: "skipped_ambiguous",
          reason: "ambiguous_legacy_email",
        });
        continue;
      }

      try {
        // Re-check Memberstack independently for this window.
        const resolution = await resolveMember(normalizedEmail);

        if (resolution.status === "ambiguous") {
          await pushDetail({
            ...base,
            memberstackResolution: "ambiguous",
            outcome: "skipped_ambiguous",
            reason: "ambiguous_memberstack_match",
          });
          continue;
        }

        if (resolution.status === "error") {
          await pushDetail({
            ...base,
            outcome: "failure",
            reason: "memberstack_lookup_failed",
            error: resolution.error,
          });
          continue;
        }

        let memberstackId: string | null = null;
        let memberstackResolution: ReminderDetail["memberstackResolution"] = "not_found";

        if (resolution.status === "unique") {
          memberstackId = resolution.member.id;
          memberstackResolution = "unique";
          // Skip anyone who already holds another active paid membership.
          if (memberHasActivePaidMembership({ data: resolution.member })) {
            await pushDetail({
              ...base,
              memberstackId,
              memberstackResolution,
              outcome: "skipped_active_paid",
              reason: "other_active_paid_plan",
            });
            continue;
          }
        }
        // `not_found` continues: no Memberstack account means no active paid plan;
        // they may still be a valid legacy annual member who should be reminded.

        // Durable dedupe (survives manual same-day retries) before any AC write.
        if (await hasTaggedRecord(row.memberid, tag)) {
          await pushDetail({
            ...base,
            memberstackId,
            memberstackResolution,
            outcome: "skipped_already_tagged",
            reason: "already_tagged_audit",
          });
          continue;
        }

        // Resolve the AC contact (reads are allowed in dry-run).
        const existing = await ac.findContactByEmail(normalizedEmail);

        // Brand-new contact: no consent conflict possible; create + subscribe + tag.
        if (!existing) {
          if (dryRun) {
            await pushDetail({
              ...base,
              memberstackId,
              memberstackResolution,
              listStatus: "not_on_list",
              created: true,
              subscribed: true,
              outcome: "would_tag",
              reason: "would_create_subscribe_tag",
            });
            continue;
          }

          const synced = await ac.syncContact({
            email: normalizedEmail,
            firstName: row.fristname?.trim() || undefined,
            fieldValues: [{ field: paidThroughFieldId, value: paidThrough }],
          });
          await ac.subscribeToList(synced.id, listId);
          const tagId = await ac.resolveTagId(tag, { create: true });
          if (!tagId) {
            await pushDetail({
              ...base,
              memberstackId,
              memberstackResolution,
              acContactId: synced.id,
              listStatus: "active",
              created: true,
              subscribed: true,
              outcome: "failure",
              reason: "tag_resolve_failed",
            });
            continue;
          }
          await ac.addTag(synced.id, tagId);
          await pushDetail({
            ...base,
            memberstackId,
            memberstackResolution,
            acContactId: synced.id,
            listStatus: "active",
            created: true,
            subscribed: true,
            outcome: "tagged",
            reason: "created_subscribed_tagged",
          });
          continue;
        }

        // Existing contact: protect consent before doing anything.
        const contactId = existing.id;
        const listStatus = await ac.getListStatus(contactId, listId);

        if (listStatus === "unsubscribed") {
          await pushDetail({
            ...base,
            memberstackId,
            memberstackResolution,
            acContactId: contactId,
            listStatus,
            outcome: "skipped_unsubscribed",
            reason: "list_unsubscribed",
          });
          continue;
        }
        if (listStatus === "bounced") {
          await pushDetail({
            ...base,
            memberstackId,
            memberstackResolution,
            acContactId: contactId,
            listStatus,
            outcome: "skipped_bounced",
            reason: "list_bounced",
          });
          continue;
        }
        if (listStatus === "unconfirmed") {
          await pushDetail({
            ...base,
            memberstackId,
            memberstackResolution,
            acContactId: contactId,
            listStatus,
            outcome: "skipped_unconfirmed",
            reason: "list_unconfirmed",
          });
          continue;
        }

        // Duplicate protection: skip if the tag is already on the contact.
        const tagId = await ac.resolveTagId(tag, { create: !dryRun });
        if (tagId && (await ac.contactHasTag(contactId, tagId))) {
          await pushDetail({
            ...base,
            memberstackId,
            memberstackResolution,
            acContactId: contactId,
            listStatus,
            outcome: "skipped_already_tagged",
            reason: "already_tagged_activecampaign",
          });
          continue;
        }

        const needsSubscribe = listStatus === "not_on_list";

        if (dryRun) {
          await pushDetail({
            ...base,
            memberstackId,
            memberstackResolution,
            acContactId: contactId,
            listStatus,
            subscribed: needsSubscribe,
            outcome: "would_tag",
            reason: "would_update_field_and_tag",
          });
          continue;
        }

        // LIVE: write the paid-through date field, ensure subscription, then tag.
        await ac.syncContact({
          email: normalizedEmail,
          firstName: row.fristname?.trim() || undefined,
          fieldValues: [{ field: paidThroughFieldId, value: paidThrough }],
        });
        if (needsSubscribe) {
          await ac.subscribeToList(contactId, listId);
        }
        if (!tagId) {
          await pushDetail({
            ...base,
            memberstackId,
            memberstackResolution,
            acContactId: contactId,
            listStatus,
            subscribed: needsSubscribe,
            outcome: "failure",
            reason: "tag_resolve_failed",
          });
          continue;
        }
        await ac.addTag(contactId, tagId);
        await pushDetail({
          ...base,
          memberstackId,
          memberstackResolution,
          acContactId: contactId,
          listStatus,
          subscribed: needsSubscribe,
          outcome: "tagged",
          reason: "field_updated_and_tagged",
        });
      } catch (error) {
        await pushDetail({
          ...base,
          outcome: "failure",
          error: sanitizeError(error),
        });
      }
    }

    // Aggregate totals.
    for (const w of windows) {
      result.totals.candidatesFound += w.candidatesFound;
      result.totals.tagged += w.tagged;
      result.totals.wouldTag += w.wouldTag;
      result.totals.skippedActivePaid += w.skippedActivePaid;
      result.totals.skippedAmbiguous += w.skippedAmbiguous;
      result.totals.skippedMissingEmail += w.skippedMissingEmail;
      result.totals.skippedStaffOrTest += w.skippedStaffOrTest;
      result.totals.skippedAlreadyTagged += w.skippedAlreadyTagged;
      result.totals.skippedUnsubscribed += w.skippedUnsubscribed;
      result.totals.skippedBounced += w.skippedBounced;
      result.totals.skippedUnconfirmed += w.skippedUnconfirmed;
      result.totals.createdContacts += w.createdContacts;
      result.totals.failures += w.failures;
    }

    result.ok = true;
    result.completedAt = new Date().toISOString();
    return result;
  } catch (error) {
    result.ok = false;
    result.errorMessage = sanitizeError(error);
    return result;
  }
}

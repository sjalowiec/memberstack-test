/**
 * Explicit one-address legacy renewal test for nosub1@knititnow.com.
 * The scheduled job still skips every staff/test address. This module never
 * selects another contact and never falls back to the bulk reminder run.
 */
import type { ActiveCampaignClient } from "../activecampaign/client";
import {
  createActiveCampaignClient,
  getActiveCampaignConfig,
} from "../activecampaign/client";
import { memberHasActivePaidMembership } from "../membership/membershipCheckoutDecision";
import {
  calendarYmdForNow,
  MEMBERSHIP_STATUS_CALENDAR_TIMEZONE,
} from "../membership/membershipStatusSummary";
import type { MemberstackMember } from "../membership/membershipSummary";
import {
  buildMemberstackEmailIndex,
  defaultLoadMemberstackMembers,
  resolveMemberstackMemberFromIndex,
} from "./legacyAnnualExpiry";
import { complimentaryAccessThroughYmd } from "./complimentaryAccess";
import { queryWatson } from "./db";
import {
  activeComplimentaryOutlastsLegacyDate,
  addDaysYmd,
  getLegacyReminderActiveCampaignSettings,
  LEGACY_PAID_THROUGH_FIELD_TITLE,
  REMINDER_TAG_BY_WINDOW,
} from "./legacyRenewalReminders";
import type { WatsonQueryFn } from "./memberSearch";

export const LEGACY_RENEWAL_TEST_EMAIL = "nosub1@knititnow.com";
export const LEGACY_RENEWAL_TEST_WINDOW_DAYS = 7 as const;
export const LEGACY_RENEWAL_TEST_TAG = REMINDER_TAG_BY_WINDOW[LEGACY_RENEWAL_TEST_WINDOW_DAYS];
export const LEGACY_RENEWAL_TEST_AUTOMATION_NAME = "Legacy Annual Renewal - 7 Days";

const TEST_MEMBER_SQL = `
  SELECT
    memberid,
    fristname,
    CASE
      WHEN subscriptionexpiring IS NULL THEN NULL
      ELSE to_char(subscriptionexpiring::date, 'YYYY-MM-DD')
    END AS paid_through_ymd,
    COALESCE(betaactive, 0)::int AS betaactive,
    COALESCE(monthlysubscriber, 0)::int AS monthlysubscriber
  FROM legacy_members
  WHERE lower(btrim(email)) = $1
`;

const COMPLIMENTARY_YMD_SQL = `
  SELECT to_char(access_through, 'YYYY-MM-DD') AS paid_through_ymd
  FROM watson_complimentary_access
  WHERE memberstack_id = $1
    AND access_through IS NOT NULL
`;

const TAGGED_AUDIT_SQL = `
  SELECT 1 AS one
  FROM watson_legacy_renewal_reminders
  WHERE legacy_memberid = $1
    AND tag_name = $2
    AND outcome = 'tagged'
  LIMIT 1
`;

export type LegacyRenewalTestBlocker =
  | "watson_not_found"
  | "watson_ambiguous"
  | "outside_seven_day_window"
  | "monthly_subscriber"
  | "beta"
  | "memberstack_not_found"
  | "memberstack_ambiguous"
  | "memberstack_truncated"
  | "active_paid"
  | "complimentary_outlasts"
  | "not_subscribed"
  | "already_tagged_audit"
  | "already_tagged_activecampaign"
  | "tag_missing"
  | "paid_through_field_missing";

export interface LegacyRenewalTestPreflight {
  ok: boolean;
  dryRun: boolean;
  email: typeof LEGACY_RENEWAL_TEST_EMAIL;
  windowDays: typeof LEGACY_RENEWAL_TEST_WINDOW_DAYS;
  tagName: string;
  eligible: boolean;
  blockers: LegacyRenewalTestBlocker[];
  paidThrough: string | null;
  todayLosAngeles: string;
  sevenDayDate: string;
  listStatus: string | null;
  alreadyTagged: boolean;
  automation: { found: boolean; active: boolean; ambiguous: boolean } | null;
  error: string | null;
}

interface TestMemberRow {
  memberid: string;
  fristname: string | null;
  paid_through_ymd: string | null;
  betaactive: number | string;
  monthlysubscriber: number | string;
}

export interface LegacyRenewalTestDependencies {
  now?: Date;
  env?: NodeJS.ProcessEnv;
  queryFn?: WatsonQueryFn;
  activeCampaign?: ActiveCampaignClient;
  loadMemberstackMembers?: () => Promise<{ members: MemberstackMember[]; truncated: boolean }>;
  productionWritesAllowed?: boolean;
}

function safeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "Legacy renewal test preflight failed.";
  if (/postgres:|password|secret|api[_-]?key|sk_/i.test(raw)) {
    return "Legacy renewal test preflight failed.";
  }
  return raw.slice(0, 300);
}

async function taggedInAudit(
  memberId: string,
  queryFn: WatsonQueryFn,
): Promise<boolean> {
  try {
    const rows = await queryFn<{ one: number }>(TAGGED_AUDIT_SQL, [
      memberId,
      LEGACY_RENEWAL_TEST_TAG,
    ]);
    return rows.length > 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if ((error as { code?: string }).code === "42P01" || /does not exist/i.test(message)) {
      return false;
    }
    throw error;
  }
}

export async function preflightLegacyRenewalTestContact(
  options: LegacyRenewalTestDependencies = {},
): Promise<LegacyRenewalTestPreflight> {
  const now = options.now ?? new Date();
  const today = calendarYmdForNow(now, MEMBERSHIP_STATUS_CALENDAR_TIMEZONE);
  const sevenDayDate = addDaysYmd(today, LEGACY_RENEWAL_TEST_WINDOW_DAYS);
  const queryFn = options.queryFn ?? queryWatson;
  const blockers: LegacyRenewalTestBlocker[] = [];
  const report = (extra: Partial<LegacyRenewalTestPreflight> = {}): LegacyRenewalTestPreflight => ({
    ok: true,
    dryRun: true,
    email: LEGACY_RENEWAL_TEST_EMAIL,
    windowDays: LEGACY_RENEWAL_TEST_WINDOW_DAYS,
    tagName: LEGACY_RENEWAL_TEST_TAG,
    paidThrough: null,
    todayLosAngeles: today,
    sevenDayDate,
    listStatus: null,
    alreadyTagged: false,
    automation: null,
    error: null,
    ...extra,
    blockers,
    eligible: blockers.length === 0,
  });

  try {
    const settings = getLegacyReminderActiveCampaignSettings(options.env);
    const listId = settings.listId;
    let ac = options.activeCampaign;
    if (!ac) {
      const config = getActiveCampaignConfig(options.env);
      if (!config || !listId) {
        return {
          ...report(),
          ok: false,
          error: "ActiveCampaign reminder settings are not configured.",
        };
      }
      ac = createActiveCampaignClient(config);
    }
    if (!listId) {
      return {
        ...report(),
        ok: false,
        error: "ActiveCampaign reminder settings are not configured.",
      };
    }

    const watsonRows = await queryFn<TestMemberRow>(TEST_MEMBER_SQL, [
      LEGACY_RENEWAL_TEST_EMAIL,
    ]);
    if (watsonRows.length === 0) blockers.push("watson_not_found");
    if (watsonRows.length > 1) blockers.push("watson_ambiguous");
    const watson = watsonRows.length === 1 ? watsonRows[0] : null;
    const paidThrough = watson?.paid_through_ymd ?? null;
    if (watson) {
      if (Number(watson.monthlysubscriber) === 1) blockers.push("monthly_subscriber");
      if (Number(watson.betaactive) !== 0) blockers.push("beta");
      if (paidThrough !== sevenDayDate) blockers.push("outside_seven_day_window");
    }

    const loaded = options.loadMemberstackMembers
      ? await options.loadMemberstackMembers()
      : await defaultLoadMemberstackMembers();
    if (loaded.truncated) blockers.push("memberstack_truncated");
    const resolution = resolveMemberstackMemberFromIndex(
      buildMemberstackEmailIndex(loaded.members),
      LEGACY_RENEWAL_TEST_EMAIL,
    );
    if (resolution.status === "not_found") blockers.push("memberstack_not_found");
    if (resolution.status === "ambiguous") blockers.push("memberstack_ambiguous");
    if (resolution.status === "unique") {
      if (memberHasActivePaidMembership({ data: resolution.member })) {
        blockers.push("active_paid");
      }
      const complimentaryRows = await queryFn<{ paid_through_ymd: string | null }>(
        COMPLIMENTARY_YMD_SQL,
        [resolution.member.id],
      );
      const complimentaryYmd = complimentaryAccessThroughYmd(
        complimentaryRows[0]?.paid_through_ymd ?? null,
      );
      if (
        paidThrough &&
        activeComplimentaryOutlastsLegacyDate({
          memberOrPayload: { data: resolution.member },
          legacyYmd: paidThrough,
          complimentaryYmd,
        })
      ) {
        blockers.push("complimentary_outlasts");
      }
    }

    let alreadyTagged = false;
    if (watson) {
      alreadyTagged = await taggedInAudit(watson.memberid, queryFn);
      if (alreadyTagged) blockers.push("already_tagged_audit");
    }

    const contact = await ac.findContactByEmail(LEGACY_RENEWAL_TEST_EMAIL);
    let listStatus: LegacyRenewalTestPreflight["listStatus"] = null;
    if (!contact) {
      blockers.push("not_subscribed");
      listStatus = "not_on_list";
    } else {
      listStatus = await ac.getListStatus(contact.id, listId);
      if (listStatus !== "active") blockers.push("not_subscribed");
      const tagId = await ac.resolveTagId(LEGACY_RENEWAL_TEST_TAG, { create: false });
      if (!tagId) blockers.push("tag_missing");
      else if (await ac.contactHasTag(contact.id, tagId)) {
        alreadyTagged = true;
        blockers.push("already_tagged_activecampaign");
      }
    }

    const fieldId =
      settings.paidThroughFieldId ||
      (ac.resolveFieldId
        ? await ac.resolveFieldId(LEGACY_PAID_THROUGH_FIELD_TITLE, { create: false })
        : null);
    if (!fieldId) blockers.push("paid_through_field_missing");

    let automation: LegacyRenewalTestPreflight["automation"] = null;
    if (ac.findAutomationByExactName) {
      const found = await ac.findAutomationByExactName(LEGACY_RENEWAL_TEST_AUTOMATION_NAME);
      automation = found
        ? { found: true, active: found.active && !found.ambiguous, ambiguous: found.ambiguous }
        : { found: false, active: false, ambiguous: false };
    }

    return report({ paidThrough, listStatus, alreadyTagged, automation });
  } catch (error) {
    return {
      ...report(),
      ok: false,
      eligible: false,
      error: safeError(error),
    };
  }
}

export async function applyExplicitLegacyRenewalTest(
  options: LegacyRenewalTestDependencies = {},
): Promise<LegacyRenewalTestPreflight & { applied: boolean }> {
  const preflight = await preflightLegacyRenewalTestContact(options);
  if (!preflight.eligible || !options.productionWritesAllowed) {
    return { ...preflight, applied: false };
  }

  const queryFn = options.queryFn ?? queryWatson;
  const settings = getLegacyReminderActiveCampaignSettings(options.env);
  const ac =
    options.activeCampaign ??
    createActiveCampaignClient(getActiveCampaignConfig(options.env ?? process.env)!);
  const watsonRows = await queryFn<TestMemberRow>(TEST_MEMBER_SQL, [LEGACY_RENEWAL_TEST_EMAIL]);
  const watson = watsonRows[0];
  const contact = await ac.findContactByEmail(LEGACY_RENEWAL_TEST_EMAIL);
  const fieldId =
    settings.paidThroughFieldId ||
    (await ac.resolveFieldId?.(LEGACY_PAID_THROUGH_FIELD_TITLE, { create: false })) ||
    null;
  const tagId = contact
    ? await ac.resolveTagId(LEGACY_RENEWAL_TEST_TAG, { create: false })
    : null;
  if (!watson?.paid_through_ymd || !contact || !fieldId || !tagId || !settings.listId) {
    return {
      ...preflight,
      eligible: false,
      blockers: [...preflight.blockers, "tag_missing"],
      applied: false,
    };
  }

  await ac.syncContact({
    email: LEGACY_RENEWAL_TEST_EMAIL,
    firstName: watson.fristname?.trim() || undefined,
    fieldValues: [{ field: fieldId, value: watson.paid_through_ymd }],
  });
  await ac.addTag(contact.id, tagId);
  await queryFn(
    `INSERT INTO watson_legacy_renewal_reminders (
       as_of_date, window_days, tag_name, legacy_memberid, email, paid_through,
       memberstack_id, memberstack_resolution, ac_contact_id, list_status,
       outcome, dry_run, trigger_source, error
     ) VALUES ($1, 7, $2, $3, $4, $5, NULL, 'unique', $6, 'active', 'tagged', FALSE, 'manual', NULL)`,
    [
      preflight.todayLosAngeles,
      LEGACY_RENEWAL_TEST_TAG,
      watson.memberid,
      LEGACY_RENEWAL_TEST_EMAIL,
      watson.paid_through_ymd,
      contact.id,
    ],
  );
  return { ...preflight, dryRun: false, applied: true };
}

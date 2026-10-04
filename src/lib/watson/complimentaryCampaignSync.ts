/**
 * Sync saved Watson complimentary access-through dates to ActiveCampaign.
 *
 * Matching follows the renewal reminder client: exact email via contact lookup
 * and contact/sync, which updates an existing contact instead of creating a
 * second one. This does not subscribe, resubscribe, or change list status.
 * Members with no saved date are not selected. Staff and test addresses,
 * including sept13@knititnow.com, are skipped.
 *
 * Live writes run only on the production Netlify site. kin-dev can read the
 * same ActiveCampaign account, so it stays dry-run.
 */
import type { ActiveCampaignClient } from "../activecampaign/client";
import { createActiveCampaignClient, getActiveCampaignConfig } from "../activecampaign/client";
import { memberHasActivePaidMembership } from "../membership/membershipCheckoutDecision";
import type { MemberstackMember } from "../membership/membershipSummary";
import {
  getMemberstackAdminClient,
  isKinDevMemberstackRuntime,
  isMemberstackProductionRuntime,
} from "../../../netlify/functions/lib/memberstack-admin.js";
import {
  ALL_COMPLIMENTARY_ACCESS_SQL,
  complimentaryAccessThroughYmd,
  type ComplimentaryAccessRow,
} from "./complimentaryAccess";
import { normalizeCustomerEmail } from "./customerIdentifier";
import { queryWatson } from "./db";
import { isStaffOrTestEmail } from "./legacyMembershipReportsShared";
import type { WatsonQueryFn } from "./memberSearch";

export const COMPLIMENTARY_MEMBERSHIP_TAG = "Complimentary membership";
export const COMPLIMENTARY_ACCESS_THROUGH_FIELD = "Complimentary access through";
/** Same paid check the legacy reminder job uses, stored so a future automation can see it. */
export const ACTIVE_PAID_MEMBERSHIP_FIELD = "Active paid membership";
export const ACTIVE_PAID_MEMBERSHIP_YES = "yes";
export const ACTIVE_PAID_MEMBERSHIP_NO = "no";

/** Published knititnow.com site. kin-dev must not write to the shared account. */
export const PRODUCTION_CAMPAIGN_SITE_ID = "7a6a8dde-c0a0-4a21-960d-dff3f0ba358b";

const PRODUCTION_CAMPAIGN_HOSTS = new Set(["knititnow.com", "www.knititnow.com"]);

function hostnameFromCampaignUrl(value: string | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    return new URL(raw).hostname.trim().toLowerCase();
  } catch {
    return "";
  }
}

export function isProductionActiveCampaignWriteRuntime(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (isKinDevMemberstackRuntime(env)) return false;
  // The public production host only serves the published site. Astro SSR may
  // omit SITE_ID and CONTEXT, so this host is enough. kin-dev is rejected above.
  const host = hostnameFromCampaignUrl(env.URL) || hostnameFromCampaignUrl(env.DEPLOY_PRIME_URL);
  if (PRODUCTION_CAMPAIGN_HOSTS.has(host)) return true;
  if (!isMemberstackProductionRuntime(env)) return false;
  const siteId = String(env.SITE_ID || "").trim().toLowerCase();
  return siteId === PRODUCTION_CAMPAIGN_SITE_ID;
}

const KIN_DEV_CAMPAIGN_HOST = "kin-dev.netlify.app";

function campaignHost(value: string | undefined): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return hostnameFromCampaignUrl(raw.includes("://") ? raw : `https://${raw}`);
}

/**
 * Watson SSR can see a Netlify-internal URL instead of knititnow.com. Prefer an
 * observed public host when the env URL is not already the production site.
 * A kin-dev host always wins so DEV cannot write to the shared account.
 */
export function applyComplimentaryCampaignRequestHosts(
  env: NodeJS.ProcessEnv,
  hosts: string[],
): NodeJS.ProcessEnv {
  const next: NodeJS.ProcessEnv = { ...env };
  const observed = hosts.map((host) => campaignHost(host)).filter((host) => host.length > 0);
  const siteId = String(next.SITE_ID || "").trim().toLowerCase();
  if (siteId === PRODUCTION_CAMPAIGN_SITE_ID) return next;
  if (isKinDevMemberstackRuntime(next) || observed.includes(KIN_DEV_CAMPAIGN_HOST)) {
    if (campaignHost(next.URL) !== KIN_DEV_CAMPAIGN_HOST) {
      next.URL = `https://${KIN_DEV_CAMPAIGN_HOST}`;
    }
    return next;
  }
  if (PRODUCTION_CAMPAIGN_HOSTS.has(campaignHost(next.URL))) return next;
  const productionHost = observed.find((host) => PRODUCTION_CAMPAIGN_HOSTS.has(host));
  if (productionHost) next.URL = `https://${productionHost}`;
  return next;
}

/**
 * Live writes require the production site. An explicit flag must be the
 * string "true". Astro SSR often cannot see that Netlify flag at all; a
 * missing flag still writes on the confirmed production site, and kin-dev
 * stays dry-run.
 */
export function complimentaryCampaignSyncWillWrite(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!isProductionActiveCampaignWriteRuntime(env)) return false;
  const flag = env.COMPLIMENTARY_CAMPAIGN_SYNC_LIVE_ENABLED;
  if (flag == null || String(flag).trim() === "") return true;
  return flag === "true";
}

export type ComplimentaryCampaignOutcome =
  | "synced"
  | "would_sync"
  | "skipped_staff_or_test"
  | "skipped_missing_email"
  | "skipped_not_found"
  | "failure";

export interface ComplimentaryCampaignDetail {
  memberstackId: string;
  email: string | null;
  accessThrough: string | null;
  paidMembership: boolean | null;
  acContactId: string | null;
  tagApplied: boolean;
  dateFieldValue: string | null;
  paidFieldValue: string | null;
  outcome: ComplimentaryCampaignOutcome;
  reason?: string;
  error?: string;
}

export interface ComplimentaryCampaignSyncResult {
  ok: boolean;
  liveWrite: boolean;
  candidatesFound: number;
  synced: number;
  wouldSync: number;
  skipped: number;
  failures: number;
  tagName: string;
  dateFieldTitle: string;
  paidFieldTitle: string;
  details: ComplimentaryCampaignDetail[];
  errorMessage: string | null;
}

export type LoadComplimentaryCampaignMember = (
  memberstackId: string,
) => Promise<MemberstackMember | null>;

function sanitizeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 300);
}

function emailFromMember(member: MemberstackMember): string | null {
  return normalizeCustomerEmail(member.auth?.email);
}

async function defaultLoadMember(memberstackId: string): Promise<MemberstackMember | null> {
  const client = getMemberstackAdminClient() as {
    getMember?: (id: string) => Promise<MemberstackMember | null>;
  } | null;
  if (!client?.getMember) {
    throw new Error("Memberstack admin API is not configured.");
  }
  const member = await client.getMember(memberstackId);
  return member ?? null;
}

/**
 * Write each saved complimentary date onto the matching ActiveCampaign contact.
 * A later Watson date replaces the previous field value. Paid membership is
 * recorded separately from the complimentary date and from the legacy
 * paid-through field.
 */
export async function runComplimentaryCampaignSync(
  options: {
    liveWrite?: boolean;
    onlyMemberstackIds?: string[];
    queryFn?: WatsonQueryFn;
    loadMember?: LoadComplimentaryCampaignMember;
    activeCampaign?: ActiveCampaignClient;
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<ComplimentaryCampaignSyncResult> {
  const liveWrite = options.liveWrite ?? false;
  const queryFn = options.queryFn ?? queryWatson;
  const loadMember = options.loadMember ?? defaultLoadMember;
  const only = options.onlyMemberstackIds?.map((id) => id.trim()).filter(Boolean);

  const result: ComplimentaryCampaignSyncResult = {
    ok: false,
    liveWrite,
    candidatesFound: 0,
    synced: 0,
    wouldSync: 0,
    skipped: 0,
    failures: 0,
    tagName: COMPLIMENTARY_MEMBERSHIP_TAG,
    dateFieldTitle: COMPLIMENTARY_ACCESS_THROUGH_FIELD,
    paidFieldTitle: ACTIVE_PAID_MEMBERSHIP_FIELD,
    details: [],
    errorMessage: null,
  };

  try {
    const rows = await queryFn<ComplimentaryAccessRow>(ALL_COMPLIMENTARY_ACCESS_SQL);
    const selected = rows.filter((row) => {
      if (!complimentaryAccessThroughYmd(row.access_through)) return false;
      if (!only?.length) return true;
      return only.includes(row.memberstack_id);
    });
    result.candidatesFound = selected.length;

    let ac = options.activeCampaign ?? null;
    let dateFieldId: string | null = null;
    let paidFieldId: string | null = null;
    let tagId: string | null = null;

    if (liveWrite) {
      if (!ac) {
        const config = getActiveCampaignConfig(options.env);
        if (!config) {
          result.errorMessage =
            "Missing ACTIVECAMPAIGN_API_KEY or ACTIVECAMPAIGN_BASE_URL.";
          return result;
        }
        ac = createActiveCampaignClient(config);
      }
      if (!ac.resolveFieldId || !ac.readFieldValue) {
        result.errorMessage = "ActiveCampaign field sync is not available.";
        return result;
      }
      dateFieldId = await ac.resolveFieldId(COMPLIMENTARY_ACCESS_THROUGH_FIELD, {
        create: true,
        type: "date",
      });
      paidFieldId = await ac.resolveFieldId(ACTIVE_PAID_MEMBERSHIP_FIELD, {
        create: true,
        type: "text",
      });
      tagId = await ac.resolveTagId(COMPLIMENTARY_MEMBERSHIP_TAG, { create: true });
      if (!dateFieldId || !paidFieldId || !tagId) {
        result.errorMessage =
          "ActiveCampaign could not resolve the complimentary date field, paid field, or tag.";
        return result;
      }
    }

    for (const row of selected) {
      const accessThrough = complimentaryAccessThroughYmd(row.access_through);
      const base: ComplimentaryCampaignDetail = {
        memberstackId: row.memberstack_id,
        email: null,
        accessThrough,
        paidMembership: null,
        acContactId: null,
        tagApplied: false,
        dateFieldValue: null,
        paidFieldValue: null,
        outcome: "failure",
      };
      if (!accessThrough) {
        result.skipped += 1;
        result.details.push({
          ...base,
          outcome: "skipped_missing_email",
          reason: "no_saved_date",
        });
        continue;
      }

      try {
        const member = await loadMember(row.memberstack_id);
        if (!member) {
          result.skipped += 1;
          result.details.push({
            ...base,
            outcome: "skipped_not_found",
            reason: "memberstack_not_found",
          });
          continue;
        }
        const email = emailFromMember(member);
        if (!email) {
          result.skipped += 1;
          result.details.push({
            ...base,
            outcome: "skipped_missing_email",
            reason: "missing_memberstack_email",
          });
          continue;
        }
        if (isStaffOrTestEmail(email)) {
          result.skipped += 1;
          result.details.push({
            ...base,
            email,
            outcome: "skipped_staff_or_test",
            reason: "staff_or_test_email",
          });
          continue;
        }

        const paidMembership = memberHasActivePaidMembership(member);
        const paidValue = paidMembership ? ACTIVE_PAID_MEMBERSHIP_YES : ACTIVE_PAID_MEMBERSHIP_NO;
        if (!liveWrite || !ac || !dateFieldId || !paidFieldId || !tagId) {
          result.wouldSync += 1;
          result.details.push({
            ...base,
            email,
            paidMembership,
            dateFieldValue: accessThrough,
            paidFieldValue: paidValue,
            outcome: "would_sync",
            reason: "dry_run",
          });
          continue;
        }

        const synced = await ac.syncContact({
          email,
          fieldValues: [
            { field: dateFieldId, value: accessThrough },
            { field: paidFieldId, value: paidValue },
          ],
        });
        const alreadyTagged = await ac.contactHasTag(synced.id, tagId);
        if (!alreadyTagged) {
          await ac.addTag(synced.id, tagId);
        }
        const dateFieldValue =
          (await ac.readFieldValue?.(synced.id, dateFieldId)) ?? accessThrough;
        const paidFieldValue = (await ac.readFieldValue?.(synced.id, paidFieldId)) ?? paidValue;
        result.synced += 1;
        result.details.push({
          ...base,
          email,
          paidMembership,
          acContactId: synced.id,
          tagApplied: true,
          dateFieldValue,
          paidFieldValue,
          outcome: "synced",
          reason: alreadyTagged ? "date_updated" : "tagged_and_dated",
        });
      } catch (error) {
        result.failures += 1;
        result.details.push({
          ...base,
          outcome: "failure",
          error: sanitizeError(error),
        });
      }
    }

    result.ok = result.failures === 0 && !result.errorMessage;
    return result;
  } catch (error) {
    result.errorMessage = sanitizeError(error);
    return result;
  }
}

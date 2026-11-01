/**
 * Build the Member Thank-Yous list from Stripe charges, Watson member
 * records, and saved checkbox status. Reads only. Checkbox writes go
 * through memberThankYouStore.
 */

import {
  COMPLIMENTARY_MEMBER_PLAN_IDS,
  FREE_ACCESS_MEMBER_PLAN_IDS,
  MEMBERSHIPS,
} from "../../config/memberships";
import { readStripeMembershipConfig } from "../../config/stripeMembership";
import type { PlanConnection } from "../membership/membershipSummary";
import { buildCustomerPlanConnectionDisplay, formatMemberstackDisplayName } from "./customerMemberstack";
import { loadCustomerMemberstackMember } from "./customerMemberstack";
import {
  buildLegacyCustomerProfileUrl,
  buildMemberstackCustomerProfileUrl,
  customerEmailLookupKeys,
  resolveLegacyLinkByMemberstackEmail,
  type LegacyEmailLinkResult,
} from "./customerIdentifier";
import { queryWatson } from "./db";
import { formatLaTimestamp, formatCivilLabel } from "./salesReportDates";
import type { LegacyMemberDetailRow } from "./memberDetail";
import {
  MEMBER_MEMBERSHIPS_SQL,
  type LegacySubscriptionRow,
} from "./memberMembership";
import { formatMemberDisplayName, type WatsonQueryFn } from "./memberSearch";
import {
  assessMailingAddress,
  classifyMemberThankYou,
  explainAnnualThankYouEligibility,
  legacyHistoryYmd,
  matchesThankYouFilter,
  MEMBER_THANK_YOU_ADDRESS_LABEL,
  MEMBER_THANK_YOU_NO_ADDRESS,
  MEMBER_THANK_YOU_PLAN_LABEL,
  parseThankYouFilter,
  priorPaidFromLegacyAmount,
  resolveThankYouRange,
  thankYouPaymentYmd,
  THANK_YOU_KIND_LABELS,
  type PriorPaidMembership,
  type ThankYouAddressState,
  type ThankYouFilter,
  type ThankYouKind,
} from "./memberThankYouRules";
import {
  buildMembershipThankYouEmailMessage,
  buildVideoReplyPublicUrl,
  MEMBERSHIP_THANK_YOU_EMAIL_SUBJECT,
} from "../videoReplies/videoReplyMessage";
import {
  getVideoRepliesStore,
  getVideoReplyById,
  type VideoReply,
} from "../videoReplies/videoRepliesStore";
import {
  isMissingThankYouTable,
  listThankYouStatuses,
  type ThankYouStatusRecord,
} from "./memberThankYouStore";
import {
  fetchStripeChargeById,
  fetchStripeChargesInRange,
  readStripeReportingConfig,
  resolveStripeReportingFetch,
  type NormalizedStripeCharge,
} from "./stripeReportingClient";

// Stripe allows four expand levels. `data.invoice` is two, and the invoice
// already includes each line's price and recurring interval. Expanding
// `data.invoice.lines.data.price` is five levels and Stripe rejects the list.
export const THANK_YOU_STRIPE_EXPAND = ["data.invoice"];

export const THANK_YOU_CHARGE_EXPAND = ["invoice"];

const LEGACY_BY_STRIPE_CUSTOMER_SQL = `
  SELECT
    memberid,
    fristname,
    lastname,
    email,
    address,
    address2,
    city,
    state,
    postalcode,
    country,
    birthdayinfo,
    datejoined,
    subscriptionexpiring,
    active,
    betaactive,
    currentsubscriber
  FROM legacy_members
  WHERE stripcustomerid = $1
  ORDER BY datejoined DESC NULLS LAST, memberid ASC
`;

export type MemberstackThankYouLookup =
  | {
      status: "found";
      memberId: string;
      displayName: string | null;
      connections: PlanConnection[];
    }
  | { status: "not_found" }
  | { status: "ambiguous" }
  | { status: "unavailable" };

export type EarlyRenewalThankYouSignal =
  | { status: "covered"; paidThroughYmd: string }
  | { status: "none" }
  | { status: "unavailable" };

export type MemberThankYouRow = {
  stripeChargeId: string;
  displayName: string;
  email: string | null;
  paymentYmd: string;
  paymentDateLabel: string;
  planLabel: string;
  kind: ThankYouKind;
  kindLabel: string;
  addressState: ThankYouAddressState;
  addressLabel: string | null;
  addressLines: string | null;
  addressNote: string | null;
  noAddressMessage: string | null;
  profileHref: string | null;
  videoSent: boolean;
  cardSent: boolean;
  videoSentAt: string | null;
  cardSentAt: string | null;
  videoSentLabel: string | null;
  cardSentLabel: string | null;
  completed: boolean;
  completedAt: string | null;
  completedLabel: string | null;
  videoReplyId: string | null;
  videoOriginalUrl: string | null;
  videoPublicUrl: string | null;
  videoLinkDisabled: boolean;
  emailSubject: string | null;
  emailMessage: string | null;
};

export type MemberThankYouPage = {
  rows: MemberThankYouRow[];
  totalInRange: number;
  filter: ThankYouFilter;
  fromCivil: string;
  toCivil: string;
  todayCivil: string;
  statusesAvailable: boolean;
  videoColumnsAvailable: boolean;
  warnings: string[];
  error: string | null;
  priceConfigReady: boolean;
};

export type MemberThankYouDeps = {
  now?: Date;
  from?: string | null;
  to?: string | null;
  filter?: string | null;
  annualPriceIds?: ReadonlySet<string>;
  monthlyPriceIds?: ReadonlySet<string>;
  fetchCharges?: (startUtc: Date, endUtc: Date) => Promise<NormalizedStripeCharge[]>;
  legacyByEmail?: (email: string) => Promise<LegacyEmailLinkResult>;
  legacyByStripeCustomerId?: (customerId: string) => Promise<LegacyEmailLinkResult>;
  subscriptionsForMember?: (memberId: string) => Promise<LegacySubscriptionRow[]>;
  memberstackByEmail?: (email: string) => Promise<MemberstackThankYouLookup>;
  earlyRenewalForInvoice?: (invoiceId: string) => Promise<EarlyRenewalThankYouSignal>;
  statusesForCharges?: (
    ids: string[],
  ) => Promise<
    | ThankYouStatusRecord[]
    | { rows: ThankYouStatusRecord[]; videoColumnsAvailable: boolean }
    | "unavailable"
  >;
  videoRepliesById?: (ids: string[]) => Promise<Map<string, VideoReply> | "unavailable">;
  origin?: string;
};

type Identity =
  | { status: "unique"; member: LegacyMemberDetailRow }
  | { status: "none" }
  | { status: "ambiguous" }
  | { status: "unavailable" };

function sentLabel(iso: string | null): string | null {
  if (!iso) return null;
  const label = formatLaTimestamp(iso);
  return label === "-" ? null : `Sent ${label}`;
}

function completedLabel(iso: string | null): string | null {
  if (!iso) return null;
  const label = formatLaTimestamp(iso);
  return label === "-" ? null : `Completed ${label}`;
}

const EMPTY_VIDEO = {
  videoReplyId: null,
  videoOriginalUrl: null,
  videoPublicUrl: null,
  videoLinkDisabled: false,
  emailSubject: null,
  emailMessage: null,
  completed: false,
  completedAt: null,
  completedLabel: null,
} as const;

function linkToIdentity(link: LegacyEmailLinkResult | "unavailable"): Identity {
  if (link === "unavailable") return { status: "unavailable" };
  if (link.status === "ambiguous") return { status: "ambiguous" };
  if (link.status === "unique") return { status: "unique", member: link.member };
  return { status: "none" };
}

function combineIdentity(emailIdentity: Identity, stripeIdentity: Identity): Identity {
  if (emailIdentity.status === "unavailable" || stripeIdentity.status === "unavailable") {
    return { status: "unavailable" };
  }
  if (emailIdentity.status === "ambiguous" || stripeIdentity.status === "ambiguous") {
    return { status: "ambiguous" };
  }
  if (emailIdentity.status === "unique" && stripeIdentity.status === "unique") {
    if (emailIdentity.member.memberid !== stripeIdentity.member.memberid) {
      return { status: "ambiguous" };
    }
    return emailIdentity;
  }
  if (emailIdentity.status === "unique") return emailIdentity;
  if (stripeIdentity.status === "unique") return stripeIdentity;
  return { status: "none" };
}

function legacyPriors(rows: LegacySubscriptionRow[]): {
  history: "ready" | "unavailable";
  prior: PriorPaidMembership[];
} {
  const prior: PriorPaidMembership[] = [];
  for (const row of rows) {
    const amount =
      row.dollaramount == null || row.dollaramount === ""
        ? null
        : Number(row.dollaramount);
    const parsed = priorPaidFromLegacyAmount({
      amount: amount != null && Number.isFinite(amount) ? amount : null,
      monthlyBilling: row.monthlybilling,
      startedYmd: legacyHistoryYmd(row.datebought),
      coveredThroughYmd: legacyHistoryYmd(row.expirationdate),
    });
    if (parsed === "free") continue;
    if (parsed === "incomplete") return { history: "unavailable", prior: [] };
    prior.push(parsed);
  }
  return { history: "ready", prior };
}

function connectionStartYmd(connection: PlanConnection): string | null {
  const raw = connection.createdAt;
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return legacyHistoryYmd(raw);
  return thankYouPaymentYmd(Math.floor(date.getTime() / 1000));
}

function connectionEndYmd(connection: PlanConnection): string | null {
  const raw = connection.canceledAt || connection.cancelledAt;
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return legacyHistoryYmd(raw);
  return thankYouPaymentYmd(Math.floor(date.getTime() / 1000));
}

const NON_PAID_PLAN_IDS = new Set<string>([
  MEMBERSHIPS.beta.memberstackPlanId,
  ...FREE_ACCESS_MEMBER_PLAN_IDS,
  ...COMPLIMENTARY_MEMBER_PLAN_IDS,
]);

function memberstackPriors(connections: PlanConnection[]): {
  history: "ready" | "unavailable";
  prior: PriorPaidMembership[];
} {
  const prior: PriorPaidMembership[] = [];
  for (const connection of connections) {
    if (connection.planId && NON_PAID_PLAN_IDS.has(connection.planId)) continue;
    const display = buildCustomerPlanConnectionDisplay(connection);
    if (display.isPaidPlan === false) continue;
    if (display.isPaidPlan == null || !display.billingInterval) {
      return { history: "unavailable", prior: [] };
    }
    const startedYmd = connectionStartYmd(connection);
    if (!startedYmd) return { history: "unavailable", prior: [] };
    const ended = connectionEndYmd(connection);
    const active = display.activeLabel === "Active";
    if (!active && !ended) return { history: "unavailable", prior: [] };
    prior.push({
      startedYmd,
      coveredThroughYmd: ended ?? "9999-12-31",
      monthly: display.billingInterval === "monthly",
      incomplete: false,
    });
  }
  return { history: "ready", prior };
}

function displayNameFor(input: {
  identity: Identity;
  memberstackName: string | null;
  chargeName: string | null;
}): string {
  if (input.identity.status === "unique") {
    const legacyName = formatMemberDisplayName(input.identity.member);
    if (legacyName.trim()) return legacyName.trim();
  }
  if (input.identity.status !== "ambiguous" && input.memberstackName?.trim()) {
    return input.memberstackName.trim();
  }
  if (input.chargeName?.trim()) return input.chargeName.trim();
  return "Name not on file";
}

export async function loadMemberThankYouPage(
  deps: MemberThankYouDeps = {},
): Promise<MemberThankYouPage> {
  const now = deps.now ?? new Date();
  const config = readStripeMembershipConfig();
  const annualPriceIds = deps.annualPriceIds ?? config.annualPriceIds;
  const monthlyPriceIds = deps.monthlyPriceIds ?? config.monthlyPriceIds;
  const filter = parseThankYouFilter(deps.filter);
  const rangeResult = resolveThankYouRange(now, deps.from, deps.to);
  if (!rangeResult.ok) {
    return emptyPage(filter, "", "", "", [rangeResult.error], rangeResult.error, annualPriceIds.size > 0);
  }
  const range = rangeResult.range;
  const warnings: string[] = [];
  if (range.clamped) {
    warnings.push("The date range was limited to October 30, 2026 through today.");
  }
  if (annualPriceIds.size === 0) {
    const message =
      "Annual membership price IDs are not configured, so no payments are listed. Dollar amounts are not used to guess.";
    warnings.push(message);
    return emptyPage(filter, range.fromCivil, range.toCivil, range.todayCivil, warnings, null, false);
  }

  let charges: NormalizedStripeCharge[];
  try {
    const fetchCharges =
      deps.fetchCharges ??
      ((startUtc: Date, endUtc: Date) =>
        fetchStripeChargesInRange({
          startUtc,
          endUtc,
          expand: THANK_YOU_STRIPE_EXPAND,
        }));
    charges = await fetchCharges(range.startUtc, range.endUtc);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe payments could not be loaded.";
    return emptyPage(
      filter,
      range.fromCivil,
      range.toCivil,
      range.todayCivil,
      warnings,
      message,
      true,
    );
  }

  const eligible: Array<{ charge: NormalizedStripeCharge; paymentYmd: string }> = [];
  let unverifiedInterval = 0;
  for (const charge of charges) {
    const paymentYmd = thankYouPaymentYmd(charge.created);
    if (!paymentYmd) continue;
    const decision = explainAnnualThankYouEligibility({
      charge,
      annualPriceIds,
      monthlyPriceIds,
      paymentYmd,
    });
    if (decision.reason === "interval_unverified") unverifiedInterval += 1;
    if (!decision.eligible || paymentYmd < range.fromCivil || paymentYmd > range.toCivil) continue;
    eligible.push({ charge, paymentYmd });
  }
  if (unverifiedInterval > 0) {
    warnings.push(
      `${unverifiedInterval} paid charge${unverifiedInterval === 1 ? "" : "s"} matched the annual price but did not include a yearly billing interval, so ${unverifiedInterval === 1 ? "it is" : "they are"} not listed.`,
    );
  }

  const legacyByEmail = deps.legacyByEmail ?? resolveLegacyLinkByMemberstackEmail;
  const legacyByStripeCustomerId =
    deps.legacyByStripeCustomerId ??
    ((customerId: string) => legacyMembersByStripeCustomerId(customerId));
  const subscriptionsForMember =
    deps.subscriptionsForMember ??
    (async (memberId: string) => queryWatson<LegacySubscriptionRow>(MEMBER_MEMBERSHIPS_SQL, [memberId]));
  const memberstackByEmail = deps.memberstackByEmail ?? defaultMemberstackByEmail;
  const earlyRenewalForInvoice = deps.earlyRenewalForInvoice ?? defaultEarlyRenewalForInvoice;
  const statusesForCharges = deps.statusesForCharges ?? defaultStatusesForCharges;

  const emailIdentity = new Map<string, Identity>();
  const stripeIdentity = new Map<string, Identity>();
  const memberstackCache = new Map<string, MemberstackThankYouLookup>();
  const subscriptionCache = new Map<string, LegacySubscriptionRow[] | "unavailable">();
  const renewalCache = new Map<string, EarlyRenewalThankYouSignal>();

  async function identityForEmail(email: string): Promise<Identity> {
    const key = email.trim().toLowerCase();
    const cached = emailIdentity.get(key);
    if (cached) return cached;
    let resolved: Identity;
    try {
      resolved = linkToIdentity(await legacyByEmail(email));
    } catch {
      resolved = { status: "unavailable" };
    }
    emailIdentity.set(key, resolved);
    return resolved;
  }

  async function identityForCustomer(customerId: string): Promise<Identity> {
    const cached = stripeIdentity.get(customerId);
    if (cached) return cached;
    let resolved: Identity;
    try {
      resolved = linkToIdentity(await legacyByStripeCustomerId(customerId));
    } catch {
      resolved = { status: "unavailable" };
    }
    stripeIdentity.set(customerId, resolved);
    return resolved;
  }

  const built: MemberThankYouRow[] = [];
  for (const item of eligible) {
    const email = item.charge.customerEmail?.trim() || null;
    const emailMatch = email ? await identityForEmail(email) : { status: "none" as const };
    const stripeMatch = item.charge.customerId
      ? await identityForCustomer(item.charge.customerId)
      : { status: "none" as const };
    const identity = combineIdentity(emailMatch, stripeMatch);

    let memberstack: MemberstackThankYouLookup = { status: "not_found" };
    const memberstackEmail =
      email ?? (identity.status === "unique" ? identity.member.email : null);
    if (memberstackEmail) {
      const cacheKey = memberstackEmail.trim().toLowerCase();
      const cached = memberstackCache.get(cacheKey);
      if (cached) {
        memberstack = cached;
      } else {
        try {
          memberstack = await memberstackByEmail(memberstackEmail);
        } catch {
          memberstack = { status: "unavailable" };
        }
        memberstackCache.set(cacheKey, memberstack);
      }
    } else {
      memberstack = { status: "unavailable" };
    }

    let legacyHistory: { history: "ready" | "unavailable"; prior: PriorPaidMembership[] } = {
      history: "ready",
      prior: [],
    };
    if (identity.status === "unique") {
      const memberId = identity.member.memberid;
      let rows = subscriptionCache.get(memberId);
      if (!rows) {
        try {
          rows = await subscriptionsForMember(memberId);
        } catch {
          rows = "unavailable";
        }
        subscriptionCache.set(memberId, rows);
      }
      legacyHistory =
        rows === "unavailable"
          ? { history: "unavailable", prior: [] }
          : legacyPriors(rows);
    } else if (identity.status === "unavailable") {
      legacyHistory = { history: "unavailable", prior: [] };
    }

    const stackHistory =
      memberstack.status === "found"
        ? memberstackPriors(memberstack.connections)
        : memberstack.status === "unavailable" || memberstack.status === "ambiguous"
          ? { history: "unavailable" as const, prior: [] as PriorPaidMembership[] }
          : { history: "ready" as const, prior: [] as PriorPaidMembership[] };

    let history: "ready" | "unavailable" = "ready";
    let prior = [...legacyHistory.prior, ...stackHistory.prior];
    if (legacyHistory.history === "unavailable" || stackHistory.history === "unavailable") {
      if (legacyHistory.history === "ready" && legacyHistory.prior.length > 0 && stackHistory.history === "unavailable") {
        history = "ready";
        prior = legacyHistory.prior;
      } else if (
        stackHistory.history === "ready" &&
        stackHistory.prior.length > 0 &&
        legacyHistory.history === "unavailable" &&
        identity.status !== "unique"
      ) {
        history = "ready";
        prior = stackHistory.prior;
      } else if (legacyHistory.history === "unavailable" || (stackHistory.history === "unavailable" && legacyHistory.prior.length === 0)) {
        history = "unavailable";
        prior = [];
      }
    }

    let stillCovered = false;
    const invoiceId = item.charge.invoiceId;
    if (invoiceId) {
      let signal = renewalCache.get(invoiceId);
      if (!signal) {
        try {
          signal = await earlyRenewalForInvoice(invoiceId);
        } catch {
          signal = { status: "unavailable" };
        }
        renewalCache.set(invoiceId, signal);
      }
      if (
        signal.status === "covered" &&
        signal.paidThroughYmd >= item.paymentYmd
      ) {
        stillCovered = true;
      }
    }

    const identityForClass =
      memberstack.status === "ambiguous" && identity.status !== "unique"
        ? "ambiguous"
        : identity.status === "none" && !email && !item.charge.customerId
          ? "unavailable"
          : identity.status;

    const kind = classifyMemberThankYou({
      billingReason: item.charge.billingReason,
      paymentYmd: item.paymentYmd,
      identity: identityForClass,
      history,
      stillCovered,
      priorPaid: prior,
    });

    const addressMember = identity.status === "unique" ? identity.member : null;
    const address = assessMailingAddress(
      addressMember
        ? {
            address: addressMember.address,
            address2: addressMember.address2,
            city: addressMember.city,
            state: addressMember.state,
            postalcode: addressMember.postalcode,
            country: addressMember.country,
          }
        : null,
    );

    const profileHref =
      identity.status === "unique"
        ? buildLegacyCustomerProfileUrl(identity.member.memberid)
        : memberstack.status === "found" && identity.status !== "ambiguous"
          ? buildMemberstackCustomerProfileUrl(memberstack.memberId)
          : null;

    built.push({
      stripeChargeId: item.charge.id,
      displayName: displayNameFor({
        identity,
        memberstackName: memberstack.status === "found" ? memberstack.displayName : null,
        chargeName: item.charge.customerName,
      }),
      email,
      paymentYmd: item.paymentYmd,
      paymentDateLabel: formatCivilLabel(item.paymentYmd),
      planLabel: MEMBER_THANK_YOU_PLAN_LABEL,
      kind,
      kindLabel: THANK_YOU_KIND_LABELS[kind],
      addressState: address.state,
      addressLabel: address.lines ? MEMBER_THANK_YOU_ADDRESS_LABEL : null,
      addressLines: address.lines,
      addressNote: address.note,
      noAddressMessage: address.state === "missing" ? MEMBER_THANK_YOU_NO_ADDRESS : null,
      profileHref,
      videoSent: false,
      cardSent: false,
      videoSentAt: null,
      cardSentAt: null,
      videoSentLabel: null,
      cardSentLabel: null,
      ...EMPTY_VIDEO,
    });
  }

  let statusesAvailable = true;
  let videoColumnsAvailable = true;
  let statusRows: ThankYouStatusRecord[] = [];
  try {
    const loaded = await statusesForCharges(built.map((row) => row.stripeChargeId));
    if (loaded === "unavailable") {
      statusesAvailable = false;
      videoColumnsAvailable = false;
      warnings.push(
        "Thank-you status is not in the database yet. Payments are listed, and the sent boxes cannot be saved until the migration is applied.",
      );
    } else if (Array.isArray(loaded)) {
      statusRows = loaded;
    } else {
      statusRows = loaded.rows;
      videoColumnsAvailable = loaded.videoColumnsAvailable;
      if (!videoColumnsAvailable) {
        warnings.push(
          "Video links and Mark Complete need the thank-you video migration. Sent boxes still save, and existing rows were not marked complete.",
        );
      }
    }
  } catch (error) {
    if (isMissingThankYouTable(error)) {
      statusesAvailable = false;
      videoColumnsAvailable = false;
      warnings.push(
        "Thank-you status is not in the database yet. Payments are listed, and the sent boxes cannot be saved until the migration is applied.",
      );
    } else {
      statusesAvailable = false;
      videoColumnsAvailable = false;
      warnings.push("Saved thank-you status could not be loaded. Sent boxes are not shown as saved.");
    }
  }

  const statusById = new Map(statusRows.map((row) => [row.stripeChargeId, row]));
  const withStatus = built.map((row) => {
    const status = statusById.get(row.stripeChargeId);
    if (!status) return row;
    return {
      ...row,
      videoSent: Boolean(status.videoSentAt),
      cardSent: Boolean(status.cardSentAt),
      videoSentAt: status.videoSentAt,
      cardSentAt: status.cardSentAt,
      videoSentLabel: sentLabel(status.videoSentAt),
      cardSentLabel: sentLabel(status.cardSentAt),
      videoReplyId: status.videoReplyId ?? null,
      completed: Boolean(status.completedAt),
      completedAt: status.completedAt ?? null,
      completedLabel: completedLabel(status.completedAt ?? null),
    };
  });

  const origin = (deps.origin ?? "").replace(/\/$/, "");
  const replyIds = [
    ...new Set(withStatus.map((row) => row.videoReplyId).filter((id): id is string => Boolean(id))),
  ];
  let replies = new Map<string, VideoReply>();
  if (replyIds.length > 0) {
    try {
      const loadedReplies = await (deps.videoRepliesById ?? defaultVideoRepliesById)(replyIds);
      if (loadedReplies === "unavailable") {
        warnings.push("Saved thank-you videos could not be loaded. Sent boxes were not changed.");
      } else {
        replies = loadedReplies;
      }
    } catch {
      warnings.push("Saved thank-you videos could not be loaded. Sent boxes were not changed.");
    }
  }

  const withVideo = withStatus.map((row) => {
    const reply = row.videoReplyId ? replies.get(row.videoReplyId) : undefined;
    if (!reply) return row;
    const videoPublicUrl = buildVideoReplyPublicUrl(origin, reply.publicToken);
    return {
      ...row,
      videoOriginalUrl: reply.originalVimeoUrl,
      videoPublicUrl,
      videoLinkDisabled: reply.status === "disabled",
      emailSubject: MEMBERSHIP_THANK_YOU_EMAIL_SUBJECT,
      emailMessage: buildMembershipThankYouEmailMessage({
        memberName: reply.memberName,
        publicViewingUrl: videoPublicUrl,
      }),
    };
  });

  withVideo.sort((a, b) => {
    const byDate = b.paymentYmd.localeCompare(a.paymentYmd);
    if (byDate !== 0) return byDate;
    return a.stripeChargeId.localeCompare(b.stripeChargeId);
  });

  return {
    rows: withVideo.filter((row) =>
      matchesThankYouFilter(
        {
          videoSent: row.videoSent,
          cardSent: row.cardSent,
          addressState: row.addressState,
          completed: row.completed,
        },
        filter,
      ),
    ),
    totalInRange: withVideo.length,
    filter,
    fromCivil: range.fromCivil,
    toCivil: range.toCivil,
    todayCivil: range.todayCivil,
    statusesAvailable,
    videoColumnsAvailable,
    warnings,
    error: null,
    priceConfigReady: true,
  };
}

function emptyPage(
  filter: ThankYouFilter,
  fromCivil: string,
  toCivil: string,
  todayCivil: string,
  warnings: string[],
  error: string | null,
  priceConfigReady: boolean,
): MemberThankYouPage {
  return {
    rows: [],
    totalInRange: 0,
    filter,
    fromCivil,
    toCivil,
    todayCivil,
    statusesAvailable: false,
    videoColumnsAvailable: false,
    warnings,
    error,
    priceConfigReady,
  };
}

async function legacyMembersByStripeCustomerId(
  customerId: string,
  queryFn: WatsonQueryFn = queryWatson,
): Promise<LegacyEmailLinkResult> {
  const id = customerId.trim();
  if (!id.startsWith("cus_")) return { status: "none" };
  const rows = await queryFn<LegacyMemberDetailRow>(LEGACY_BY_STRIPE_CUSTOMER_SQL, [id]);
  if (rows.length === 0) return { status: "none" };
  if (rows.length === 1) return { status: "unique", member: rows[0]! };
  return { status: "ambiguous", members: rows };
}

async function defaultMemberstackByEmail(email: string): Promise<MemberstackThankYouLookup> {
  const keys = customerEmailLookupKeys(email);
  if (keys.length === 0) return { status: "not_found" };
  const found: MemberstackThankYouLookup[] = [];
  for (const key of keys) {
    const result = await loadCustomerMemberstackMember({ lookupValue: key });
    if (!result.ok) {
      if (result.status === "not_found") continue;
      return { status: "unavailable" };
    }
    found.push({
      status: "found",
      memberId: result.member.id,
      displayName: formatMemberstackDisplayName(result.member),
      connections: result.member.planConnections ?? [],
    });
  }
  const ids = new Set(found.map((item) => (item.status === "found" ? item.memberId : "")));
  if (ids.size > 1) return { status: "ambiguous" };
  return found[0] ?? { status: "not_found" };
}

const EARLY_RENEWAL_COVERED_SQL = `
  SELECT to_char(paid_through_ymd, 'YYYY-MM-DD') AS paid_through_ymd
  FROM watson_legacy_annual_early_renewals
  WHERE stripe_invoice_id = $1
    AND outcome = 'applied'
  LIMIT 1
`;

async function defaultEarlyRenewalForInvoice(
  invoiceId: string,
): Promise<EarlyRenewalThankYouSignal> {
  try {
    const rows = await queryWatson<{ paid_through_ymd: string | null }>(
      EARLY_RENEWAL_COVERED_SQL,
      [invoiceId],
    );
    const paidThroughYmd = rows[0]?.paid_through_ymd?.trim() ?? "";
    if (!paidThroughYmd) return { status: "none" };
    return { status: "covered", paidThroughYmd };
  } catch (error) {
    if (isMissingThankYouTable(error)) return { status: "none" };
    return { status: "unavailable" };
  }
}

async function defaultVideoRepliesById(
  ids: string[],
): Promise<Map<string, VideoReply> | "unavailable"> {
  try {
    const store = getVideoRepliesStore();
    const replies = new Map<string, VideoReply>();
    for (const id of ids) {
      const reply = await getVideoReplyById(store, id);
      if (reply) replies.set(id, reply);
    }
    return replies;
  } catch {
    return "unavailable";
  }
}

async function defaultStatusesForCharges(
  ids: string[],
): Promise<{ rows: ThankYouStatusRecord[]; videoColumnsAvailable: boolean } | "unavailable"> {
  try {
    return await listThankYouStatuses(ids);
  } catch (error) {
    if (isMissingThankYouTable(error)) return "unavailable";
    throw error;
  }
}

export async function loadThankYouChargeForSave(
  chargeId: string,
): Promise<NormalizedStripeCharge | null> {
  const config = readStripeReportingConfig();
  if ("error" in config) {
    throw new Error(config.error);
  }
  return fetchStripeChargeById(
    chargeId,
    config,
    resolveStripeReportingFetch(),
    THANK_YOU_CHARGE_EXPAND,
  );
}

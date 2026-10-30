/**
 * Pure rules for the Watson Member Thank-Yous page.
 * Annual payments are identified by Stripe price id and a yearly interval.
 * Dollar amount is never used to decide that a charge is annual.
 */

import { MEMBERSHIPS } from "../../config/memberships";
import { isStaffOrTestEmail, isMonthlyAmount } from "./legacyMembershipReportsShared";
import type { StripeChargeLineRef } from "./stripeSalesClassify";
import type { NormalizedStripeCharge } from "./stripeReportingClient";
import {
  addCivilDays,
  civilToString,
  compareCivil,
  laCivilDateOf,
  laCivilMidnightUtc,
  parseCivil,
  SALES_REPORT_TZ,
} from "./salesReportDates";
import { ymdFromDateOnlyValue } from "../membership/membershipStatusSummary";

export const MEMBER_THANK_YOU_START_YMD = "2026-10-30";
export const MEMBER_THANK_YOU_PLAN_LABEL = `${MEMBERSHIPS.membership.name}, annual`;
export const MEMBER_THANK_YOU_ADDRESS_LABEL = "Address on file, may need confirmation.";
export const MEMBER_THANK_YOU_NO_ADDRESS = "No mailing address on file.";
export const MEMBER_THANK_YOU_TIME_ZONE = SALES_REPORT_TZ;

export const THANK_YOU_FILTERS = ["all", "video", "card", "address", "completed"] as const;
export type ThankYouFilter = (typeof THANK_YOU_FILTERS)[number];

export const THANK_YOU_KINDS = ["new", "renewing", "returning", "unknown"] as const;
export type ThankYouKind = (typeof THANK_YOU_KINDS)[number];

export const THANK_YOU_KIND_LABELS: Record<ThankYouKind, string> = {
  new: "New",
  renewing: "Renewing",
  returning: "Returning",
  unknown: "Unknown",
};

export type ThankYouAddressState = "missing" | "incomplete" | "usable";

export type ThankYouExclusionReason =
  | "price_config_missing"
  | "before_start"
  | "not_succeeded"
  | "unpaid"
  | "test_mode"
  | "not_usd"
  | "refunded"
  | "zero_amount"
  | "shopify"
  | "staff_or_test"
  | "monthly_price"
  | "not_annual_price"
  | "interval_unverified"
  | "interval_not_yearly";

const STATE_REQUIRED_COUNTRIES = new Set([
  "united states",
  "united states of america",
  "us",
  "usa",
  "canada",
  "ca",
  "australia",
  "au",
  "mexico",
  "mx",
]);

/** Countries where a postal code is not required for a usable mailing address. */
const POSTAL_OPTIONAL_COUNTRIES = new Set([
  "angola",
  "antigua and barbuda",
  "aruba",
  "bahamas",
  "belize",
  "benin",
  "botswana",
  "burkina faso",
  "burundi",
  "cameroon",
  "central african republic",
  "comoros",
  "congo",
  "cook islands",
  "cote d'ivoire",
  "côte d'ivoire",
  "ivory coast",
  "djibouti",
  "dominica",
  "equatorial guinea",
  "eritrea",
  "fiji",
  "gambia",
  "ghana",
  "grenada",
  "guyana",
  "hong kong",
  "hk",
  "kiribati",
  "macau",
  "macao",
  "mo",
  "malawi",
  "mali",
  "mauritania",
  "nauru",
  "niue",
  "qatar",
  "qa",
  "rwanda",
  "saint kitts and nevis",
  "sao tome and principe",
  "seychelles",
  "sierra leone",
  "solomon islands",
  "somalia",
  "suriname",
  "syria",
  "togo",
  "tonga",
  "tuvalu",
  "uganda",
  "united arab emirates",
  "uae",
  "ae",
  "vanuatu",
  "yemen",
  "zimbabwe",
]);

export type ThankYouChargeInput = Pick<
  NormalizedStripeCharge,
  | "status"
  | "paid"
  | "livemode"
  | "currency"
  | "amount"
  | "amountRefunded"
  | "refunded"
  | "hasShopifyMarker"
  | "customerEmail"
  | "lines"
>;

export function explainAnnualThankYouEligibility(input: {
  charge: ThankYouChargeInput;
  annualPriceIds: ReadonlySet<string>;
  monthlyPriceIds: ReadonlySet<string>;
  paymentYmd: string;
  earliestYmd?: string;
}): { eligible: boolean; reason: ThankYouExclusionReason | null } {
  const earliest = input.earliestYmd ?? MEMBER_THANK_YOU_START_YMD;
  if (input.annualPriceIds.size === 0) {
    return { eligible: false, reason: "price_config_missing" };
  }
  if (input.paymentYmd < earliest) {
    return { eligible: false, reason: "before_start" };
  }
  if (input.charge.status !== "succeeded") {
    return { eligible: false, reason: "not_succeeded" };
  }
  if (!input.charge.paid) {
    return { eligible: false, reason: "unpaid" };
  }
  if (!input.charge.livemode) {
    return { eligible: false, reason: "test_mode" };
  }
  if (input.charge.currency !== "usd") {
    return { eligible: false, reason: "not_usd" };
  }
  if (input.charge.refunded || input.charge.amountRefunded > 0) {
    return { eligible: false, reason: "refunded" };
  }
  if (input.charge.amount <= 0) {
    return { eligible: false, reason: "zero_amount" };
  }
  if (input.charge.hasShopifyMarker) {
    return { eligible: false, reason: "shopify" };
  }
  if (isStaffOrTestEmail(input.charge.customerEmail)) {
    return { eligible: false, reason: "staff_or_test" };
  }

  const lines = input.charge.lines;
  if (lines.some((line) => line.priceId && input.monthlyPriceIds.has(line.priceId))) {
    return { eligible: false, reason: "monthly_price" };
  }

  const annualLines = lines.filter(
    (line) => line.priceId && input.annualPriceIds.has(line.priceId),
  );
  if (annualLines.length === 0) {
    return { eligible: false, reason: "not_annual_price" };
  }
  if (annualLines.every((line) => !isVerifiedYearlyInterval(line))) {
    if (annualLines.every((line) => line.recurringInterval == null)) {
      return { eligible: false, reason: "interval_unverified" };
    }
    return { eligible: false, reason: "interval_not_yearly" };
  }
  return { eligible: true, reason: null };
}

function isVerifiedYearlyInterval(line: StripeChargeLineRef): boolean {
  const count = line.recurringIntervalCount;
  const countOk = count == null || count === 1;
  return line.recurringInterval === "year" && countOk;
}

export type ThankYouRange = {
  fromCivil: string;
  toCivil: string;
  startUtc: Date;
  endUtc: Date;
  todayCivil: string;
  clamped: boolean;
};

export function resolveThankYouRange(
  now: Date,
  fromRaw: string | null | undefined,
  toRaw: string | null | undefined,
): { ok: true; range: ThankYouRange } | { ok: false; error: string } {
  const today = laCivilDateOf(now);
  const todayCivil = civilToString(today);
  const floor = parseCivil(MEMBER_THANK_YOU_START_YMD);
  if (!floor) {
    return { ok: false, error: "The thank-you start date is invalid." };
  }
  if (compareCivil(today, floor) < 0) {
    return {
      ok: false,
      error: "Today is before October 30, 2026, so there are no thank-you payments to list.",
    };
  }

  const requestedFrom = parseCivil(fromRaw) ?? floor;
  const requestedTo = parseCivil(toRaw) ?? today;
  if (fromRaw?.trim() && !parseCivil(fromRaw)) {
    return { ok: false, error: "The From date is not a real calendar day." };
  }
  if (toRaw?.trim() && !parseCivil(toRaw)) {
    return { ok: false, error: "The To date is not a real calendar day." };
  }

  let from = requestedFrom;
  let to = requestedTo;
  let clamped = false;
  if (compareCivil(from, floor) < 0) {
    from = floor;
    clamped = true;
  }
  if (compareCivil(to, today) > 0) {
    to = today;
    clamped = true;
  }
  if (compareCivil(from, to) > 0) {
    return { ok: false, error: "The From date is after the To date." };
  }

  return {
    ok: true,
    range: {
      fromCivil: civilToString(from),
      toCivil: civilToString(to),
      startUtc: laCivilMidnightUtc(from),
      endUtc: laCivilMidnightUtc(addCivilDays(to, 1)),
      todayCivil,
      clamped,
    },
  };
}

/** Los Angeles calendar day for a Stripe charge instant. */
export function thankYouPaymentYmd(createdUnixSeconds: number): string | null {
  if (!Number.isFinite(createdUnixSeconds) || createdUnixSeconds <= 0) return null;
  return civilToString(laCivilDateOf(new Date(createdUnixSeconds * 1000)));
}

export function parseThankYouFilter(value: string | null | undefined): ThankYouFilter {
  const normalized = (value ?? "").trim().toLowerCase();
  if ((THANK_YOU_FILTERS as readonly string[]).includes(normalized)) {
    return normalized as ThankYouFilter;
  }
  return "all";
}

export function matchesThankYouFilter(
  row: {
    videoSent: boolean;
    cardSent: boolean;
    addressState: ThankYouAddressState;
  },
  filter: ThankYouFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "video") return !row.videoSent;
  if (filter === "card") return !row.cardSent && row.addressState === "usable";
  if (filter === "address") return row.addressState !== "usable" && !row.cardSent;
  return row.videoSent && row.cardSent;
}

export type MailingAddressInput = {
  address: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  postalcode: string | null;
  country: string | null;
};

export type MailingAddressAssessment = {
  state: ThankYouAddressState;
  lines: string | null;
  note: string | null;
};

function fieldText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function normalizeCountryName(value: string | null | undefined): string {
  return fieldText(value).toLowerCase().replace(/\./g, "").replace(/\s+/g, " ");
}

export function assessMailingAddress(input: MailingAddressInput | null): MailingAddressAssessment {
  if (!input) {
    return { state: "missing", lines: null, note: null };
  }
  const street = fieldText(input.address);
  const street2 = fieldText(input.address2);
  const city = fieldText(input.city);
  const state = fieldText(input.state);
  const postal = fieldText(input.postalcode);
  const country = fieldText(input.country);
  const anyField = Boolean(street || street2 || city || state || postal || country);
  if (!anyField) {
    return { state: "missing", lines: null, note: null };
  }

  const locality = [city, state, postal].filter(Boolean);
  let localityLine = "";
  if (city && state && postal) localityLine = `${city}, ${state} ${postal}`;
  else if (city && state) localityLine = `${city}, ${state}`;
  else localityLine = locality.join(", ");
  const lines = [street, street2, localityLine, country].filter(Boolean).join("\n");

  const missing: string[] = [];
  if (!street) missing.push("a street");
  if (!city) missing.push("a city");
  if (!country) missing.push("a country");
  const countryKey = normalizeCountryName(country);
  if (country && STATE_REQUIRED_COUNTRIES.has(countryKey) && !state) {
    missing.push("a state or province");
  }
  if (country && !POSTAL_OPTIONAL_COUNTRIES.has(countryKey) && !postal) {
    missing.push("a postal code");
  }

  if (missing.length > 0) {
    return {
      state: "incomplete",
      lines,
      note: `Incomplete address: add ${joinMissing(missing)}.`,
    };
  }
  return { state: "usable", lines, note: null };
}

function joinMissing(parts: string[]): string {
  if (parts.length === 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

export type PriorPaidMembership = {
  startedYmd: string | null;
  coveredThroughYmd: string | null;
  monthly: boolean;
  incomplete: boolean;
};

/**
 * New, Renewing, Returning, or Unknown.
 * A later charge on the same subscription is Renewing even when the person
 * match is ambiguous. A Memberstack account creation date is not an input.
 */
export function classifyMemberThankYou(input: {
  billingReason: string | null;
  paymentYmd: string;
  identity: "unique" | "none" | "ambiguous" | "unavailable";
  history: "ready" | "unavailable";
  stillCovered: boolean;
  priorPaid: PriorPaidMembership[];
}): ThankYouKind {
  const reason = (input.billingReason ?? "").trim().toLowerCase();
  if (reason === "subscription_cycle") return "renewing";
  if (input.stillCovered) return "renewing";
  if (input.identity === "ambiguous" || input.identity === "unavailable") return "unknown";
  if (input.history === "unavailable") return "unknown";
  if (input.priorPaid.some((row) => row.incomplete)) return "unknown";

  const prior = input.priorPaid.filter((row) => {
    if (!row.startedYmd) return false;
    return row.startedYmd < input.paymentYmd;
  });
  if (prior.length === 0) return "new";

  const latest = [...prior].sort((a, b) =>
    (b.startedYmd ?? "").localeCompare(a.startedYmd ?? ""),
  )[0];
  if (!latest) return "unknown";
  if (latest.monthly) return "renewing";
  if (!latest.coveredThroughYmd) return "unknown";
  if (latest.coveredThroughYmd >= input.paymentYmd) return "renewing";
  return "returning";
}

export function priorPaidFromLegacyAmount(input: {
  amount: number | null;
  monthlyBilling: number | null;
  startedYmd: string | null;
  coveredThroughYmd: string | null;
}): PriorPaidMembership | "free" | "incomplete" {
  if (input.amount == null) return "incomplete";
  if (input.amount <= 1) return "free";
  const monthly = input.monthlyBilling === 1 || isMonthlyAmount(input.amount);
  if (!input.startedYmd) {
    return {
      startedYmd: null,
      coveredThroughYmd: input.coveredThroughYmd,
      monthly,
      incomplete: true,
    };
  }
  return {
    startedYmd: input.startedYmd,
    coveredThroughYmd: input.coveredThroughYmd,
    monthly,
    incomplete: false,
  };
}

/** Calendar day for a legacy date column, using the stored date prefix. */
export function legacyHistoryYmd(value: string | Date | null | undefined): string | null {
  return ymdFromDateOnlyValue(value ?? null);
}

export function isValidThankYouChargeId(value: string): boolean {
  return /^ch_[A-Za-z0-9]+$/.test(value) && value.length <= 255;
}

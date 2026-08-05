/**
 * Watson Email Signups report — pure compute + view helpers.
 *
 * No database imports here so Astro components can use these helpers without
 * pulling `pg` into the client bundle.
 *
 * A counted "new signup" is a row with status = 'added' (ActiveCampaign
 * confirmed the email was newly subscribed to the Knit It Now list).
 * America/Los_Angeles civil days match other Watson reports.
 */

import { EMAIL_SIGNUP_SOURCE_TIP_OF_THE_WEEK } from "../email/emailListSignupShared";
import {
  addCivilDays,
  civilDayKey,
  civilToString,
  eachCivilDay,
  formatCivilLabel,
  laCivilDateOf,
  laCivilMidnightUtc,
  SALES_REPORT_TZ,
  type CivilDate,
} from "./salesReportDates";

export const EMAIL_SIGNUPS_REPORT_TZ = SALES_REPORT_TZ;

/** Display label for known sources (structure allows more later). */
export const EMAIL_SIGNUP_SOURCE_LABELS: Record<string, string> = {
  [EMAIL_SIGNUP_SOURCE_TIP_OF_THE_WEEK]: "Tip of the Week",
};

export type EmailSignupEvent = {
  createdAt: Date;
  status: string;
  source: string;
};

export type PeriodTotals = {
  /** Inclusive first LA day YYYY-MM-DD. */
  fromCivil: string;
  /** Inclusive last LA day YYYY-MM-DD. */
  toCivil: string;
  /** Count of status = 'added' in this period. */
  newSignups: number;
};

export type PeriodComparison = {
  current: PeriodTotals;
  previous: PeriodTotals;
  /** current - previous. */
  change: number;
  /**
   * Percent change vs previous, or null when previous is 0
   * (avoid divide-by-zero / meaningless %).
   */
  percentChange: number | null;
};

export type EmailSignupsDailyRow = {
  date: string;
  newSignups: number;
  inProgress: boolean;
};

export type EmailSignupsReport = {
  generatedAtIso: string;
  timezone: string;
  sourceLabel: string;
  today: PeriodTotals;
  last7: PeriodComparison;
  last30: PeriodComparison;
  daily: EmailSignupsDailyRow[];
};

function civilRangeUtc(from: CivilDate, to: CivilDate): {
  startUtc: Date;
  endUtc: Date;
  fromCivil: string;
  toCivil: string;
} {
  return {
    fromCivil: civilToString(from),
    toCivil: civilToString(to),
    startUtc: laCivilMidnightUtc(from),
    endUtc: laCivilMidnightUtc(addCivilDays(to, 1)),
  };
}

function countAddedInRange(
  events: EmailSignupEvent[],
  startUtc: Date,
  endUtc: Date,
): number {
  let count = 0;
  const startMs = startUtc.getTime();
  const endMs = endUtc.getTime();
  for (const event of events) {
    if (event.status !== "added") continue;
    const t = event.createdAt.getTime();
    if (t >= startMs && t < endMs) count += 1;
  }
  return count;
}

function buildPeriod(
  events: EmailSignupEvent[],
  from: CivilDate,
  to: CivilDate,
): PeriodTotals {
  const range = civilRangeUtc(from, to);
  return {
    fromCivil: range.fromCivil,
    toCivil: range.toCivil,
    newSignups: countAddedInRange(events, range.startUtc, range.endUtc),
  };
}

function buildComparison(
  events: EmailSignupEvent[],
  currentFrom: CivilDate,
  currentTo: CivilDate,
  previousFrom: CivilDate,
  previousTo: CivilDate,
): PeriodComparison {
  const current = buildPeriod(events, currentFrom, currentTo);
  const previous = buildPeriod(events, previousFrom, previousTo);
  const change = current.newSignups - previous.newSignups;
  const percentChange =
    previous.newSignups === 0
      ? null
      : Math.round((change / previous.newSignups) * 100);
  return { current, previous, change, percentChange };
}

/**
 * Pure report computation from already-loaded events.
 * Only `status === "added"` rows contribute to totals.
 */
export function computeEmailSignupsReport(input: {
  events: EmailSignupEvent[];
  now?: Date;
  sourceLabel?: string;
}): EmailSignupsReport {
  const now = input.now ?? new Date();
  const today = laCivilDateOf(now);
  const todayStr = civilToString(today);

  // Current 7 days: today-6 … today; previous: today-13 … today-7
  const last7From = addCivilDays(today, -6);
  const prev7From = addCivilDays(today, -13);
  const prev7To = addCivilDays(today, -7);

  // Current 30 days: today-29 … today; previous: today-59 … today-30
  const last30From = addCivilDays(today, -29);
  const prev30From = addCivilDays(today, -59);
  const prev30To = addCivilDays(today, -30);

  const dailyFrom = last30From;
  const dailyKeys = eachCivilDay(civilToString(dailyFrom), todayStr);
  const dailyCounts = new Map<string, number>();
  for (const key of dailyKeys) dailyCounts.set(key, 0);

  for (const event of input.events) {
    if (event.status !== "added") continue;
    const key = civilDayKey(event.createdAt);
    if (dailyCounts.has(key)) {
      dailyCounts.set(key, (dailyCounts.get(key) ?? 0) + 1);
    }
  }

  const daily: EmailSignupsDailyRow[] = dailyKeys.map((date) => ({
    date,
    newSignups: dailyCounts.get(date) ?? 0,
    inProgress: date === todayStr,
  }));

  return {
    generatedAtIso: now.toISOString(),
    timezone: EMAIL_SIGNUPS_REPORT_TZ,
    sourceLabel:
      input.sourceLabel ??
      EMAIL_SIGNUP_SOURCE_LABELS[EMAIL_SIGNUP_SOURCE_TIP_OF_THE_WEEK] ??
      "Email list",
    today: buildPeriod(input.events, today, today),
    last7: buildComparison(
      input.events,
      last7From,
      today,
      prev7From,
      prev7To,
    ),
    last30: buildComparison(
      input.events,
      last30From,
      today,
      prev30From,
      prev30To,
    ),
    daily,
  };
}

export function formatEmailSignupsPercentChange(
  percentChange: number | null,
): string {
  if (percentChange == null) return "—";
  const sign = percentChange > 0 ? "+" : "";
  return `${sign}${percentChange}%`;
}

export function formatEmailSignupsChange(change: number): string {
  if (change > 0) return `+${change}`;
  return String(change);
}

export function formatEmailSignupsPeriodLabel(period: PeriodTotals): string {
  if (period.fromCivil === period.toCivil) {
    return formatCivilLabel(period.fromCivil);
  }
  return `${formatCivilLabel(period.fromCivil)} – ${formatCivilLabel(period.toCivil)}`;
}

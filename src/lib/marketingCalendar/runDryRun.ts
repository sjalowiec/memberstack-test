import { getActiveCampaignConfig } from "../activecampaign/client";
import { isMaskedNetlifySecret, MASKED_SECRET_MESSAGE } from "./netlifyEnv";
import {
  listCampaigns,
  loadAccountTimeZone,
  loadMessageSubjects,
} from "./activeCampaignCampaigns";
import { decideCampaign } from "./campaignPlan";
import {
  EVENT_COLOR,
  IMPORT_START_DATE,
  IMPORT_TIME_ZONE,
  KIN_MARKETING_CALENDAR_NAME,
  PROP_CAMPAIGN_ID,
  PROP_SYNC,
} from "./constants";
import { isOnOrAfterImportStart, isValidTimeZone } from "./dates";
import { MarketingCalendarError } from "./errors";
import {
  createGoogleCalendarReader,
  type ListedEvent,
} from "./googleCalendarClient";
import type { Sleep } from "./http";
import { parseServiceAccount, resolveCalendarId } from "./serviceAccount";
import {
  buildSyncPlan,
  findPossibleConflicts,
  type ManualCalendarEvent,
  type OwnedCalendarEvent,
  type PlannedWrite,
  type PlanRow,
  type PossibleConflict,
} from "./syncPlan";

export interface DryRunReport {
  ok: true;
  dryRun: true;
  writesEnabled: false;
  writesPerformed: 0;
  calendar: {
    id: string;
    summary: string;
    accessRole: string;
    timeZone: string;
  };
  serviceAccountEmail: string;
  activeCampaignHost: string;
  importStarting: typeof IMPORT_START_DATE;
  importTimeZone: typeof IMPORT_TIME_ZONE;
  colors: typeof EVENT_COLOR;
  campaignsFound: number;
  counts: {
    create: number;
    update: number;
    unchanged: number;
    delete: number;
    preserve: number;
    skip: number;
    conflict: number;
  };
  skipReasons: Record<string, number>;
  actions: PlanRow[];
  untouched: {
    instanceCount: number;
    recurringSeriesCount: number;
    nonRecurringEvents: Array<{ id: string; summary: string; start: string | null }>;
    recurringSeries: Array<{ id: string; summary: string }>;
    detailsTruncated: boolean;
  };
  possibleConflicts: PossibleConflict[];
  warnings: string[];
}

export async function runMarketingCalendarDryRun(input: {
  env: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  sleep?: Sleep;
  now?: Date;
}): Promise<DryRunReport> {
  return (await collectMarketingCalendar(input)).report;
}

export async function collectMarketingCalendar(input: {
  env: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  sleep?: Sleep;
  now?: Date;
}): Promise<{ report: DryRunReport; writes: PlannedWrite[] }> {
  const config = getActiveCampaignConfig(input.env);
  if (isMaskedNetlifySecret(input.env.ACTIVECAMPAIGN_API_KEY || "")) {
    throw new MarketingCalendarError(MASKED_SECRET_MESSAGE, { code: "masked-secret" });
  }
  if (!config) {
    throw new MarketingCalendarError(
      "Missing ACTIVECAMPAIGN_API_KEY or ACTIVECAMPAIGN_BASE_URL.",
      { code: "config" },
    );
  }
  if (isMaskedNetlifySecret(config.apiKey)) {
    throw new MarketingCalendarError(MASKED_SECRET_MESSAGE, { code: "masked-secret" });
  }
  let activeCampaignHost = "";
  try {
    activeCampaignHost = new URL(config.baseUrl).host;
  } catch {
    throw new MarketingCalendarError("ACTIVECAMPAIGN_BASE_URL is not a valid URL.", { code: "config" });
  }

  const calendarId = resolveCalendarId(input.env);
  const account = parseServiceAccount(input.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON);
  const calendar = createGoogleCalendarReader({
    account,
    calendarId,
    fetchImpl: input.fetchImpl,
    sleep: input.sleep,
    now: input.now,
  });

  const access = await calendar.verifyAccess();
  const warnings: string[] = [];
  let calendarTimeZone = access.timeZone;
  if (!calendarTimeZone || !isValidTimeZone(calendarTimeZone)) {
    calendarTimeZone = IMPORT_TIME_ZONE;
    warnings.push(`Calendar time zone was missing. Event times use ${IMPORT_TIME_ZONE}.`);
  }

  const ownedEvents = (await calendar.listOwnedEvents()).map(toOwned);
  const ownedIds = new Set(
    ownedEvents.map((event) => event.campaignId).filter((id): id is string => Boolean(id)),
  );

  const zone = await loadAccountTimeZone(config, { fetchImpl: input.fetchImpl, sleep: input.sleep });
  if (zone.warning) warnings.push(zone.warning);
  const campaigns = await listCampaigns(config, { fetchImpl: input.fetchImpl, sleep: input.sleep });
  const decisions = campaigns.map((campaign) => decideCampaign(campaign, zone.timeZone, input.now ?? new Date()));
  const messageIds = decisions
    .filter((decision) => needsSubject(decision, ownedIds))
    .map((decision) => decision.campaign.messageId ?? "");
  const subjects = await loadMessageSubjects(config, messageIds, {
    fetchImpl: input.fetchImpl,
    sleep: input.sleep,
  });
  warnings.push(...subjects.warnings);

  const plan = buildSyncPlan({
    decisions,
    subjects: subjects.subjects,
    ownedEvents,
    baseUrl: config.baseUrl,
    calendarTimeZone,
  });

  const instants = decisions.flatMap((decision) =>
    decision.kind === "upsert" ? [decision.instant] : [],
  );
  const bounds = windowBounds(instants);
  const windowEvents = await calendar.listWindowEvents(bounds.timeMin, bounds.timeMax);
  const ownedGoogleIds = new Set(ownedEvents.map((event) => event.id));
  const manual = windowEvents
    .filter((event) => !ownedGoogleIds.has(event.id) && !isSyncEvent(event))
    .map(toManual);
  const untouched = summarizeUntouched(manual);

  const report: DryRunReport = {
    ok: true,
    dryRun: true,
    writesEnabled: false,
    writesPerformed: 0,
    calendar: {
      id: access.calendarId,
      summary: access.summary || KIN_MARKETING_CALENDAR_NAME,
      accessRole: access.accessRole,
      timeZone: calendarTimeZone,
    },
    serviceAccountEmail: account.clientEmail,
    activeCampaignHost,
    importStarting: IMPORT_START_DATE,
    importTimeZone: IMPORT_TIME_ZONE,
    colors: EVENT_COLOR,
    campaignsFound: campaigns.length,
    counts: plan.counts,
    skipReasons: plan.skipReasons,
    actions: plan.rows.filter((row) => row.action !== "skip"),
    untouched,
    possibleConflicts: findPossibleConflicts(plan.rows, manual),
    warnings,
  };
  return { report, writes: plan.writes };
}

function needsSubject(
  decision: ReturnType<typeof decideCampaign>,
  ownedIds: Set<string>,
): boolean {
  if (decision.kind === "skip" || !decision.campaign.messageId) return false;
  if (decision.kind === "upsert") {
    return isOnOrAfterImportStart(decision.instant) || ownedIds.has(decision.campaign.id);
  }
  return ownedIds.has(decision.campaign.id);
}

function windowBounds(instants: Date[]): { timeMin: string; timeMax: string } {
  const start = new Date("2026-10-01T07:00:00.000Z");
  let end = new Date("2027-01-15T08:00:00.000Z");
  for (const instant of instants) {
    const later = new Date(instant.getTime() + 36 * 3_600_000);
    if (later > end) end = later;
  }
  return { timeMin: start.toISOString(), timeMax: end.toISOString() };
}

function isSyncEvent(event: ListedEvent): boolean {
  return event.privateProps[PROP_SYNC] === "kin-marketing" && Boolean(event.privateProps[PROP_CAMPAIGN_ID]);
}

function toOwned(event: ListedEvent): OwnedCalendarEvent {
  return {
    id: event.id,
    summary: event.summary,
    description: event.description,
    colorId: event.colorId,
    start: event.start,
    startText: event.startText,
    campaignId: event.privateProps[PROP_CAMPAIGN_ID] ?? null,
    source: event.privateProps.kinSource ?? null,
    sync: event.privateProps[PROP_SYNC] ?? null,
  };
}

function toManual(event: ListedEvent): ManualCalendarEvent {
  return {
    id: event.id,
    summary: event.summary,
    start: event.start,
    startText: event.startText,
    recurringEventId: event.recurringEventId,
    recurring: event.recurring,
    campaignId: event.privateProps[PROP_CAMPAIGN_ID] ?? null,
  };
}

function summarizeUntouched(events: ManualCalendarEvent[]): DryRunReport["untouched"] {
  const series = new Map<string, string>();
  const nonRecurring: DryRunReport["untouched"]["nonRecurringEvents"] = [];
  for (const event of events) {
    if (event.recurringEventId) {
      if (!series.has(event.recurringEventId)) series.set(event.recurringEventId, event.summary);
      continue;
    }
    nonRecurring.push({ id: event.id, summary: event.summary, start: event.startText });
  }
  return {
    instanceCount: events.length,
    recurringSeriesCount: series.size,
    nonRecurringEvents: nonRecurring.slice(0, 100),
    recurringSeries: [...series.entries()].slice(0, 100).map(([id, summary]) => ({ id, summary })),
    detailsTruncated: nonRecurring.length > 100 || series.size > 100,
  };
}

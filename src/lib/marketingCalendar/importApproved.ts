import {
  IMPORT_TIME_ZONE,
  KIN_MARKETING_CALENDAR_NAME,
  PROP_CAMPAIGN_ID,
  PROP_EVENT_AT,
  PROP_SOURCE,
  PROP_SYNC,
  SYNC_MARKER,
  SYNC_SOURCE,
} from "./constants";
import { statusLabel } from "./campaignPlan";
import { MarketingCalendarError } from "./errors";
import {
  createGoogleCalendarWriter,
  eventIsOwnedBySync,
  toGoogleEventResource,
  type GoogleEventResource,
  type ListedEvent,
} from "./googleCalendarClient";
import type { Sleep } from "./http";
import { collectMarketingCalendar, type DryRunReport } from "./runDryRun";
import { parseServiceAccount, resolveCalendarId } from "./serviceAccount";
import { findPossibleConflicts, ownedProperties, type PlannedWrite } from "./syncPlan";

/** The eight campaigns approved after the October 13, 2026 dry run. */
export const APPROVED_IMPORT_CAMPAIGN_IDS = [
  "2349",
  "2378",
  "2390",
  "2394",
  "2395",
  "2398",
  "2404",
  "2410",
] as const;

const SNAPSHOT_START = "2026-09-01T00:00:00-07:00";
const SNAPSHOT_END = "2027-12-31T00:00:00-08:00";

export interface CreatedCalendarEvent {
  campaignId: string;
  googleEventId: string;
  title: string;
  status: string;
  colorId: string | null;
  allDayDate: string;
  eventAt: string;
  campaignIdStored: boolean;
}

export interface ImportReport {
  ok: true;
  oneTimeImport: true;
  dryRun: false;
  writesPerformed: number;
  updated: 0;
  deleted: 0;
  automaticSyncEnabled: false;
  calendar: DryRunReport["calendar"];
  created: CreatedCalendarEvent[];
  existingEventCount: number;
  existingEventsChanged: string[];
  existingEventsMissing: string[];
}

export function assertApprovedCreates(report: DryRunReport, writes: PlannedWrite[]): PlannedWrite[] {
  const approved = new Set<string>(APPROVED_IMPORT_CAMPAIGN_IDS);
  const createIds = writes.filter((write) => write.action === "create").map((write) => write.campaignId);
  const reasons: string[] = [];
  if (report.calendar.summary !== KIN_MARKETING_CALENDAR_NAME) {
    reasons.push(`calendar is ${report.calendar.summary || "(unnamed)"}`);
  }
  if (report.calendar.timeZone !== IMPORT_TIME_ZONE) {
    reasons.push(`time zone is ${report.calendar.timeZone || "(missing)"}`);
  }
  if (report.counts.update !== 0 || writes.some((write) => write.action === "update")) {
    reasons.push("the plan includes updates");
  }
  if (report.counts.delete !== 0 || writes.some((write) => write.action === "delete")) {
    reasons.push("the plan includes deletes");
  }
  if (report.counts.conflict !== 0 || report.possibleConflicts.length > 0) {
    reasons.push("the plan includes conflicts");
  }
  if (report.counts.create !== APPROVED_IMPORT_CAMPAIGN_IDS.length || writes.length !== APPROVED_IMPORT_CAMPAIGN_IDS.length) {
    reasons.push(`the plan creates ${report.counts.create} events`);
  }
  if (createIds.length !== approved.size || createIds.some((id) => !approved.has(id))) {
    reasons.push("the campaigns are not the eight approved campaigns");
  }
  if (writes.some((write) => !write.allDay || !write.eventAt || !/^\d{4}-\d{2}-\d{2}$/.test(write.start || ""))) {
    reasons.push("a proposed event is not an all-day event with a stored time");
  }
  if (reasons.length > 0) {
    throw new MarketingCalendarError(
      `The one-time import was not run. ${reasons.join("; ")}. No events were created.`,
      { code: "import-refused" },
    );
  }
  return writes;
}

function fingerprint(event: ListedEvent): string {
  return [event.etag, event.updated, event.summary, event.startText, event.colorId, event.description].join("\u0000");
}

function assertCreatedEvent(event: ListedEvent, write: PlannedWrite): void {
  const campaignId = event.privateProps[PROP_CAMPAIGN_ID];
  const eventAt = event.privateProps[PROP_EVENT_AT];
  if (
    !event.allDay ||
    event.startText !== write.start ||
    campaignId !== write.campaignId ||
    eventAt !== write.eventAt ||
    event.privateProps[PROP_SYNC] !== SYNC_MARKER ||
    event.privateProps[PROP_SOURCE] !== SYNC_SOURCE ||
    event.colorId !== write.colorId ||
    !event.description.includes(write.eventAt || "")
  ) {
    throw new MarketingCalendarError(
      `Created event for campaign ${write.campaignId} did not store the campaign id, all-day date, or exact time.`,
      { code: "calendar-write" },
    );
  }
}

export async function importApprovedCampaigns(input: {
  env: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  sleep?: Sleep;
  now?: Date;
}): Promise<ImportReport> {
  const collected = await collectMarketingCalendar(input);
  const writes = assertApprovedCreates(collected.report, collected.writes);
  const account = parseServiceAccount(input.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON);
  const writer = createGoogleCalendarWriter({
    account,
    calendarId: resolveCalendarId(input.env),
    fetchImpl: input.fetchImpl,
    sleep: input.sleep,
    now: input.now,
  });
  await writer.verifyAccess();
  const owned = await writer.listOwnedEvents();
  if (owned.length > 0) {
    throw new MarketingCalendarError(
      "Synced events are already on the calendar. Nothing was created.",
      { code: "import-refused" },
    );
  }
  const before = await writer.listWindowEvents(SNAPSHOT_START, SNAPSHOT_END);
  const freshConflicts = findPossibleConflicts(
    collected.report.actions,
    before
      .filter((event) => event.privateProps[PROP_SYNC] !== SYNC_MARKER)
      .map((event) => ({
        id: event.id,
        summary: event.summary,
        start: event.start,
        startText: event.startText,
        recurringEventId: event.recurringEventId,
        recurring: event.recurring,
        campaignId: event.privateProps[PROP_CAMPAIGN_ID] ?? null,
      })),
  );
  if (freshConflicts.length > 0) {
    throw new MarketingCalendarError(
      "A manual event now conflicts with one of the eight campaigns. Nothing was created.",
      { code: "import-refused" },
    );
  }

  const beforeById = new Map(before.map((event) => [event.id, fingerprint(event)]));
  const created: CreatedCalendarEvent[] = [];
  try {
    for (const write of writes) {
      const inserted = await writer.insertEvent(toGoogleEventResource(write));
      if (beforeById.has(inserted.id)) {
        throw new MarketingCalendarError(
          `Google returned an existing event id for campaign ${write.campaignId}.`,
          { code: "calendar-write" },
        );
      }
      const event = await writer.getEvent(inserted.id);
      assertCreatedEvent(event, write);
      created.push({
        campaignId: write.campaignId,
        googleEventId: event.id,
        title: event.summary,
        status: write.status,
        colorId: event.colorId,
        allDayDate: event.startText || write.start || "",
        eventAt: event.privateProps[PROP_EVENT_AT] || "",
        campaignIdStored: event.privateProps[PROP_CAMPAIGN_ID] === write.campaignId,
      });
    }
  } catch (error) {
    const done = created.map((event) => event.campaignId).join(", ");
    const message = error instanceof Error ? error.message : "The import stopped.";
    throw new MarketingCalendarError(
      `Import stopped after creating campaigns ${done || "(none)"}. ${message}`,
      { code: "calendar-write" },
    );
  }

  const after = await writer.listWindowEvents(SNAPSHOT_START, SNAPSHOT_END);
  const afterById = new Map(after.map((event) => [event.id, event]));
  const existingEventsMissing: string[] = [];
  const existingEventsChanged: string[] = [];
  for (const [id, finger] of beforeById) {
    const current = afterById.get(id);
    if (!current) existingEventsMissing.push(id);
    else if (fingerprint(current) !== finger) existingEventsChanged.push(id);
  }

  return {
    ok: true,
    oneTimeImport: true,
    dryRun: false,
    writesPerformed: created.length,
    updated: 0,
    deleted: 0,
    automaticSyncEnabled: false,
    calendar: collected.report.calendar,
    created,
    existingEventCount: beforeById.size,
    existingEventsChanged,
    existingEventsMissing,
  };
}

export interface TitleUpdate {
  campaignId: string;
  googleEventId: string;
  previousTitle: string;
  title: string;
  emailSubject: string;
  status: string;
  allDayDate: string;
  eventAt: string;
  campaignIdStored: boolean;
  dateUnchanged: boolean;
}

export interface TitleUpdateReport {
  ok: true;
  oneTimeTitleUpdate: true;
  dryRun: false;
  created: 0;
  updated: number;
  deleted: 0;
  automaticSyncEnabled: false;
  calendar: DryRunReport["calendar"];
  updatedEvents: TitleUpdate[];
  otherEventsChanged: string[];
  otherEventsMissing: string[];
}

/** Title and description only. Start and end are omitted so the all-day date stays put. */
export function titleOnlyEventResource(write: PlannedWrite): GoogleEventResource {
  const resource: GoogleEventResource = {
    summary: write.title,
    description: write.description,
    extendedProperties: { private: ownedProperties(write.campaignId, write.eventAt) },
  };
  if (write.colorId) resource.colorId = write.colorId;
  return resource;
}

export function assertApprovedTitleUpdates(report: DryRunReport, writes: PlannedWrite[]): PlannedWrite[] {
  const approved = new Set<string>(APPROVED_IMPORT_CAMPAIGN_IDS);
  const updateIds = writes.filter((write) => write.action === "update").map((write) => write.campaignId);
  const reasons: string[] = [];
  if (report.calendar.summary !== KIN_MARKETING_CALENDAR_NAME) {
    reasons.push(`calendar is ${report.calendar.summary || "(unnamed)"}`);
  }
  if (report.calendar.timeZone !== IMPORT_TIME_ZONE) {
    reasons.push(`time zone is ${report.calendar.timeZone || "(missing)"}`);
  }
  if (report.counts.create !== 0 || writes.some((write) => write.action === "create")) {
    reasons.push("the plan includes creates");
  }
  if (report.counts.delete !== 0 || writes.some((write) => write.action === "delete")) {
    reasons.push("the plan includes deletes");
  }
  if (report.counts.conflict !== 0 || report.possibleConflicts.length > 0) {
    reasons.push("the plan includes conflicts");
  }
  if (report.counts.update !== approved.size || writes.length !== approved.size || updateIds.length !== approved.size) {
    reasons.push(`the plan updates ${report.counts.update} events`);
  }
  if (updateIds.some((id) => !approved.has(id)) || new Set(updateIds).size !== approved.size) {
    reasons.push("the campaigns are not the eight approved campaigns");
  }
  if (
    writes.some(
      (write) =>
        write.action !== "update" ||
        !write.googleEventId ||
        write.reason !== "campaign-name" ||
        !write.eventAt ||
        !/^\d{4}-\d{2}-\d{2}$/.test(write.start || "") ||
        !write.description.includes(`Campaign ID: ${write.campaignId}`) ||
        !write.description.includes(`Exact time: ${write.eventAt}`) ||
        !write.description.includes("Subject:"),
    )
  ) {
    reasons.push("a proposed change is not a title update that keeps the subject, campaign id, and send time");
  }
  const described = new Map(report.actions.map((action) => [action.campaignId, action]));
  if (
    writes.some((write) => {
      const action = described.get(write.campaignId);
      return (
        !action ||
        action.action !== "update" ||
        action.reason !== "campaign-name" ||
        !action.previousTitle ||
        action.previousTitle === write.title ||
        !action.emailSubject ||
        !write.description.includes(`Subject: ${action.emailSubject}`)
      );
    })
  ) {
    reasons.push("a title change does not keep the current event and its email subject");
  }
  if (reasons.length > 0) {
    throw new MarketingCalendarError(
      `The title update was not run. ${reasons.join("; ")}. No events were changed.`,
      { code: "import-refused" },
    );
  }
  return writes;
}

export async function updateApprovedTitles(input: {
  env: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  sleep?: Sleep;
  now?: Date;
}): Promise<TitleUpdateReport> {
  const collected = await collectMarketingCalendar(input);
  const writes = assertApprovedTitleUpdates(collected.report, collected.writes);
  const subjects = new Map(
    collected.report.actions.map((action) => [action.campaignId, action.emailSubject || ""]),
  );
  const previousTitles = new Map(
    collected.report.actions.map((action) => [action.campaignId, action.previousTitle || ""]),
  );
  const account = parseServiceAccount(input.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON);
  const writer = createGoogleCalendarWriter({
    account,
    calendarId: resolveCalendarId(input.env),
    fetchImpl: input.fetchImpl,
    sleep: input.sleep,
    now: input.now,
  });
  await writer.verifyAccess();
  const before = await writer.listWindowEvents(SNAPSHOT_START, SNAPSHOT_END);
  const freshConflicts = findPossibleConflicts(
    collected.report.actions,
    before
      .filter((event) => event.privateProps[PROP_SYNC] !== SYNC_MARKER)
      .map((event) => ({
        id: event.id,
        summary: event.summary,
        start: event.start,
        startText: event.startText,
        recurringEventId: event.recurringEventId,
        recurring: event.recurring,
        campaignId: event.privateProps[PROP_CAMPAIGN_ID] ?? null,
      })),
  );
  if (freshConflicts.length > 0) {
    throw new MarketingCalendarError(
      "A manual event now conflicts with one of the eight titles. Nothing was changed.",
      { code: "import-refused" },
    );
  }

  const currentEvents = [];
  for (const write of writes) {
    const event = await writer.getEvent(write.googleEventId || "");
    if (!eventIsOwnedBySync(event, write.campaignId) || event.startText !== write.start) {
      throw new MarketingCalendarError(
        `Event for campaign ${write.campaignId} is not the imported all-day event. Nothing was changed.`,
        { code: "import-refused" },
      );
    }
    if (event.privateProps[PROP_EVENT_AT] !== write.eventAt) {
      throw new MarketingCalendarError(
        `Event for campaign ${write.campaignId} does not have the stored send time. Nothing was changed.`,
        { code: "import-refused" },
      );
    }
    currentEvents.push({ write, event });
  }

  const targetIds = new Set(currentEvents.map((item) => item.event.id));
  const beforeById = new Map(
    before.filter((event) => !targetIds.has(event.id)).map((event) => [event.id, fingerprint(event)]),
  );
  const updatedEvents: TitleUpdate[] = [];
  try {
    for (const item of currentEvents) {
      const resource = titleOnlyEventResource(item.write);
      if ("start" in resource || "end" in resource) {
        throw new MarketingCalendarError("The title update included a date. Nothing further was changed.", {
          code: "calendar-write",
        });
      }
      await writer.patchEvent(item.event.id, resource);
      const event = await writer.getEvent(item.event.id);
      const subject = subjects.get(item.write.campaignId) || "";
      const dateUnchanged = event.allDay && event.startText === item.event.startText;
      if (
        event.summary !== item.write.title ||
        !dateUnchanged ||
        event.privateProps[PROP_CAMPAIGN_ID] !== item.write.campaignId ||
        event.privateProps[PROP_EVENT_AT] !== item.write.eventAt ||
        !event.description.includes(`Subject: ${subject}`) ||
        !event.description.includes(`Campaign ID: ${item.write.campaignId}`) ||
        !event.description.includes(`Status: ${statusLabel(item.write.status)}`) ||
        !event.description.includes(`Exact time: ${item.write.eventAt}`)
      ) {
        throw new MarketingCalendarError(
          `Campaign ${item.write.campaignId} did not keep its subject, campaign id, date, or send time.`,
          { code: "calendar-write" },
        );
      }
      updatedEvents.push({
        campaignId: item.write.campaignId,
        googleEventId: event.id,
        previousTitle: previousTitles.get(item.write.campaignId) || item.event.summary,
        title: event.summary,
        emailSubject: subject,
        status: item.write.status,
        allDayDate: event.startText || "",
        eventAt: event.privateProps[PROP_EVENT_AT] || "",
        campaignIdStored: true,
        dateUnchanged,
      });
    }
  } catch (error) {
    const done = updatedEvents.map((event) => event.campaignId).join(", ");
    const message = error instanceof Error ? error.message : "The title update stopped.";
    throw new MarketingCalendarError(
      `Title update stopped after campaigns ${done || "(none)"}. ${message}`,
      { code: "calendar-write" },
    );
  }

  const after = await writer.listWindowEvents(SNAPSHOT_START, SNAPSHOT_END);
  const afterById = new Map(after.map((event) => [event.id, event]));
  const otherEventsMissing: string[] = [];
  const otherEventsChanged: string[] = [];
  for (const [id, finger] of beforeById) {
    const current = afterById.get(id);
    if (!current) otherEventsMissing.push(id);
    else if (fingerprint(current) !== finger) otherEventsChanged.push(id);
  }

  return {
    ok: true,
    oneTimeTitleUpdate: true,
    dryRun: false,
    created: 0,
    updated: updatedEvents.length,
    deleted: 0,
    automaticSyncEnabled: false,
    calendar: collected.report.calendar,
    updatedEvents,
    otherEventsChanged,
    otherEventsMissing,
  };
}

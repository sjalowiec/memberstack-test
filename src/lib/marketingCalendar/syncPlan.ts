import { PROP_CAMPAIGN_ID, PROP_EVENT_AT, PROP_SOURCE, PROP_SYNC, SYNC_MARKER, SYNC_SOURCE } from "./constants";
import {
  statusLabel,
  statusName,
  type CampaignDecision,
  type CampaignSnapshot,
  type CampaignStatusName,
} from "./campaignPlan";
import { allDaySpan, isOnOrAfterImportStart } from "./dates";

export interface OwnedCalendarEvent {
  id: string;
  summary: string;
  description: string;
  colorId: string | null;
  start: Date | null;
  startText: string | null;
  campaignId: string | null;
  source: string | null;
  sync: string | null;
}

export interface ManualCalendarEvent {
  id: string;
  summary: string;
  start: Date | null;
  startText: string | null;
  recurringEventId: string | null;
  recurring: boolean;
  campaignId: string | null;
}

export interface PlannedWrite {
  action: "create" | "update" | "delete";
  campaignId: string;
  googleEventId: string | null;
  title: string;
  campaignName: string;
  status: CampaignStatusName;
  colorId: string | null;
  start: string | null;
  end: string | null;
  timeZone: string | null;
  timeSource: string | null;
  timePreserved: boolean;
  allDay: boolean;
  eventAt: string | null;
  description: string;
  adminUrl: string;
  reason: string;
}

export interface PlanRow {
  action: PlannedWrite["action"] | "unchanged" | "preserve" | "conflict" | "skip";
  campaignId: string;
  googleEventId: string | null;
  title: string;
  campaignName: string;
  status: string;
  colorId: string | null;
  start: string | null;
  timeSource: string | null;
  timePreserved: boolean;
  eventAt: string | null;
  adminUrl: string | null;
  reason: string;
}

export interface PossibleConflict {
  campaignId: string;
  plannedTitle: string;
  plannedStart: string | null;
  manualEventId: string;
  manualSummary: string;
  manualStart: string | null;
  reason: "title" | "start-time";
}

export interface SyncPlan {
  rows: PlanRow[];
  writes: PlannedWrite[];
  skipReasons: Record<string, number>;
  counts: {
    create: number;
    update: number;
    unchanged: number;
    delete: number;
    preserve: number;
    skip: number;
    conflict: number;
  };
}

function adminUrl(baseUrl: string, campaignId: string): string {
  return `${baseUrl.replace(/\/$/, "")}/app/campaigns/${campaignId}`;
}

export function eventTitle(subject: string | null | undefined, name: string, id: string): string {
  const subjectText = subject?.replace(/\s+/g, " ").trim();
  if (subjectText) return subjectText;
  const nameText = name.replace(/\s+/g, " ").trim();
  if (nameText) return nameText;
  return `Campaign ${id}`;
}

export function eventDescription(input: {
  campaignId: string;
  status: CampaignStatusName;
  subject: string | null;
  name: string;
  timeSource: string;
  adminUrl: string;
  scheduledOrSent?: string | null;
  exactTime?: string | null;
  note?: string;
}): string {
  const lines = [
    "Knit It Now marketing sync",
    `Campaign ID: ${input.campaignId}`,
    `Status: ${statusLabel(input.status)}`,
    `Subject: ${input.subject?.trim() || "(none)"}`,
    `Campaign name: ${input.name || "(none)"}`,
    `Time source: ${input.timeSource}`,
    `Scheduled or sent: ${input.scheduledOrSent || "(none)"}`,
    `Exact time: ${input.exactTime || "(none)"}`,
    `ActiveCampaign: ${input.adminUrl}`,
  ];
  if (input.note) lines.push(input.note);
  return lines.join("\n");
}

function count(counts: SyncPlan["counts"], action: PlanRow["action"]): void {
  if (action === "create") counts.create += 1;
  else if (action === "update") counts.update += 1;
  else if (action === "unchanged") counts.unchanged += 1;
  else if (action === "delete") counts.delete += 1;
  else if (action === "preserve") counts.preserve += 1;
  else if (action === "skip") counts.skip += 1;
  else counts.conflict += 1;
}

function bump(reasons: Record<string, number>, reason: string): void {
  reasons[reason] = (reasons[reason] ?? 0) + 1;
}

function groupOwned(events: OwnedCalendarEvent[]): {
  byCampaign: Map<string, OwnedCalendarEvent[]>;
  malformed: OwnedCalendarEvent[];
} {
  const byCampaign = new Map<string, OwnedCalendarEvent[]>();
  const malformed: OwnedCalendarEvent[] = [];
  for (const event of events) {
    if (
      !event.campaignId ||
      event.sync !== SYNC_MARKER ||
      (event.source !== null && event.source !== SYNC_SOURCE)
    ) {
      malformed.push(event);
      continue;
    }
    const list = byCampaign.get(event.campaignId) ?? [];
    list.push(event);
    byCampaign.set(event.campaignId, list);
  }
  return { byCampaign, malformed };
}


export function buildSyncPlan(input: {
  decisions: CampaignDecision[];
  subjects: ReadonlyMap<string, string | null>;
  ownedEvents: OwnedCalendarEvent[];
  baseUrl: string;
  calendarTimeZone: string;
}): SyncPlan {
  const counts: SyncPlan["counts"] = {
    create: 0,
    update: 0,
    unchanged: 0,
    delete: 0,
    preserve: 0,
    skip: 0,
    conflict: 0,
  };
  const skipReasons: Record<string, number> = {};
  const rows: PlanRow[] = [];
  const writes: PlannedWrite[] = [];
  const { byCampaign, malformed } = groupOwned(input.ownedEvents);
  const seen = new Set<string>();

  const add = (row: PlanRow, write?: PlannedWrite) => {
    rows.push(row);
    count(counts, row.action);
    if (row.action === "skip") bump(skipReasons, row.reason);
    if (write) writes.push(write);
  };

  for (const event of malformed) {
    add({
      action: "conflict",
      campaignId: event.campaignId ?? "",
      googleEventId: event.id,
      title: event.summary,
      campaignName: "",
      status: "",
      colorId: event.colorId,
      start: event.startText,
      timeSource: null,
      timePreserved: true,
      eventAt: null,
      adminUrl: null,
      reason: "owned-event-missing-campaign-id",
    });
  }

  for (const decision of input.decisions) {
    const campaign = decision.campaign;
    seen.add(campaign.id);
    const owned = byCampaign.get(campaign.id) ?? [];
    const subject = input.subjects.get(campaign.messageId ?? "") ?? null;
    const title = eventTitle(subject, campaign.name, campaign.id);
    const link = adminUrl(input.baseUrl, campaign.id);

    if (owned.length > 1) {
      add({
        action: "conflict",
        campaignId: campaign.id,
        googleEventId: null,
        title,
        campaignName: campaign.name,
        status: "status" in decision ? statusLabel(decision.status) : "",
        colorId: null,
        start: null,
        timeSource: null,
        timePreserved: true,
        eventAt: null,
        adminUrl: link,
        reason: "duplicate-owned-events",
      });
      continue;
    }

    const existing = owned[0] ?? null;

    if (decision.kind === "skip") {
      if (existing) {
        add(preserveRow(campaign, existing, title, link, decision.reason));
      } else {
        add(skipRow(campaign, title, decision.reason));
      }
      continue;
    }

    if (decision.kind === "delete") {
      if (!existing) {
        add(skipRow(campaign, title, "schedule-cleared-absent"));
      } else {
        const clearedStatus = statusName(campaign.status);
        const write: PlannedWrite = {
          action: "delete",
          campaignId: campaign.id,
          googleEventId: existing.id,
          title: existing.summary || title,
          campaignName: campaign.name,
          status: clearedStatus,
          colorId: null,
          start: existing.startText,
          end: null,
          timeZone: null,
          timeSource: null,
          timePreserved: false,
          allDay: false,
          eventAt: null,
          description: "",
          adminUrl: link,
          reason: "schedule-cleared",
        };
        add(
          {
            action: "delete",
            campaignId: campaign.id,
            googleEventId: existing.id,
            title: write.title,
            campaignName: campaign.name,
            status: statusLabel(clearedStatus === "unknown" ? "draft" : clearedStatus),
            colorId: null,
            start: existing.startText,
            timeSource: null,
            timePreserved: false,
            eventAt: null,
            adminUrl: link,
            reason: "schedule-cleared",
          },
          write,
        );
      }
      continue;
    }

    if (decision.kind === "preserve" || (decision.kind === "upsert" && !isOnOrAfterImportStart(decision.instant) && !existing)) {
      if (decision.kind === "upsert" && !existing) {
        add(skipRow(campaign, title, "before-window"));
        continue;
      }
      if (!existing) {
        add(skipRow(campaign, title, decision.kind === "preserve" ? decision.reason : "before-window"));
        continue;
      }
      const reason = decision.kind === "preserve" ? decision.reason : "existing-event-kept";
      const keptSpan = decision.kind === "upsert" ? allDaySpan(decision.instant, input.calendarTimeZone) : null;
      const description = eventDescription({
        campaignId: campaign.id,
        status: decision.status,
        subject,
        name: campaign.name,
        timeSource: decision.kind === "upsert" ? decision.timeSource : "existing-event",
        adminUrl: link,
        scheduledOrSent: keptSpan?.display,
        exactTime: keptSpan?.eventAt,
        note:
          decision.kind === "preserve"
            ? "Event time kept because ActiveCampaign did not return a usable send or scheduled date."
            : undefined,
      });
      const changed =
        existing.summary !== title ||
        existing.colorId !== decision.colorId ||
        existing.description !== description;
      const rowBase = {
        campaignId: campaign.id,
        googleEventId: existing.id,
        title,
        campaignName: campaign.name,
        status: statusLabel(decision.status),
        colorId: decision.colorId,
        start: existing.startText,
        timeSource: decision.kind === "upsert" ? decision.timeSource : "existing-event",
        timePreserved: true,
        eventAt: keptSpan?.eventAt ?? null,
        adminUrl: link,
        reason,
      };
      if (!changed && decision.kind === "preserve") {
        add({ action: "preserve", ...rowBase });
        continue;
      }
      if (!changed) {
        add({ action: "unchanged", ...rowBase, reason: "unchanged" });
        continue;
      }
      add(
        { action: "update", ...rowBase },
        {
          action: "update",
          campaignId: campaign.id,
          googleEventId: existing.id,
          title,
          campaignName: campaign.name,
          status: decision.status,
          colorId: decision.colorId,
          start: null,
          end: null,
          timeZone: input.calendarTimeZone,
          timeSource: rowBase.timeSource,
          timePreserved: true,
          allDay: false,
          eventAt: keptSpan?.eventAt ?? null,
          description,
          adminUrl: link,
          reason,
        },
      );
      continue;
    }

    if (decision.kind !== "upsert") continue;
    const when = allDaySpan(decision.instant, input.calendarTimeZone);
    const description = eventDescription({
      campaignId: campaign.id,
      status: decision.status,
      subject,
      name: campaign.name,
      timeSource: decision.timeSource,
      adminUrl: link,
      scheduledOrSent: when.display,
      exactTime: when.eventAt,
    });
    const sameClock =
      existing?.start != null && Math.abs(existing.start.getTime() - decision.instant.getTime()) < 1000;
    const sameDay = existing?.startText?.slice(0, 10) === when.date;
    const changed =
      !existing ||
      (!sameClock && !sameDay) ||
      existing.summary !== title ||
      existing.colorId !== decision.colorId ||
      existing.description !== description;
    const row = {
      campaignId: campaign.id,
      googleEventId: existing?.id ?? null,
      title,
      campaignName: campaign.name,
      status: statusLabel(decision.status),
      colorId: decision.colorId,
      start: when.date,
      timeSource: decision.timeSource,
      timePreserved: false,
      eventAt: when.eventAt,
      adminUrl: link,
      reason: existing ? "status-or-time" : "new-campaign",
    };
    if (existing && !changed) {
      add({ action: "unchanged", ...row, reason: "unchanged" });
      continue;
    }
    const action = existing ? "update" : "create";
    add(
      { action, ...row },
      {
        action,
        campaignId: campaign.id,
        googleEventId: existing?.id ?? null,
        title,
        campaignName: campaign.name,
        status: decision.status,
        colorId: decision.colorId,
        start: when.date,
        end: when.endDate,
        timeZone: input.calendarTimeZone,
        timeSource: decision.timeSource,
        timePreserved: false,
        allDay: true,
        eventAt: when.eventAt,
        description,
        adminUrl: link,
        reason: row.reason,
      },
    );
  }

  for (const [campaignId, events] of byCampaign) {
    if (seen.has(campaignId) || events.length !== 1) continue;
    const existing = events[0];
    add({
      action: "preserve",
      campaignId,
      googleEventId: existing.id,
      title: existing.summary,
      campaignName: "",
      status: "",
      colorId: existing.colorId,
      start: existing.startText,
      timeSource: "existing-event",
      timePreserved: true,
      eventAt: null,
      adminUrl: null,
      reason: "owned-event-campaign-missing",
    });
  }

  for (const [campaignId, events] of byCampaign) {
    if (seen.has(campaignId) || events.length < 2) continue;
    add({
      action: "conflict",
      campaignId,
      googleEventId: null,
      title: events[0]?.summary ?? "",
      campaignName: "",
      status: "",
      colorId: null,
      start: null,
      timeSource: null,
      timePreserved: true,
      eventAt: null,
      adminUrl: null,
      reason: "duplicate-owned-events",
    });
  }

  return { rows, writes, skipReasons, counts };
}

function skipRow(campaign: CampaignSnapshot, title: string, reason: string): PlanRow {
  return {
    action: "skip",
    campaignId: campaign.id,
    googleEventId: null,
    title,
    campaignName: campaign.name,
    status: "",
    colorId: null,
    start: null,
    timeSource: null,
    timePreserved: false,
    eventAt: null,
    adminUrl: null,
    reason,
  };
}

function preserveRow(
  campaign: CampaignSnapshot,
  existing: OwnedCalendarEvent,
  title: string,
  link: string,
  reason: string,
): PlanRow {
  return {
    action: "preserve",
    campaignId: campaign.id,
    googleEventId: existing.id,
    title,
    campaignName: campaign.name,
    status: "",
    colorId: existing.colorId,
    start: existing.startText,
    timeSource: "existing-event",
    timePreserved: true,
    eventAt: null,
    adminUrl: link,
    reason,
  };
}

function normalizeTitle(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

export function findPossibleConflicts(
  rows: PlanRow[],
  manualEvents: ManualCalendarEvent[],
): PossibleConflict[] {
  const conflicts: PossibleConflict[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.action !== "create" && row.action !== "update") continue;
      const plannedStart = Date.parse(row.eventAt || row.start || "");
    for (const manual of manualEvents) {
      if (manual.campaignId && manual.campaignId === row.campaignId) continue;
      const titleMatch =
        normalizeTitle(row.title).length > 0 &&
        normalizeTitle(row.title) === normalizeTitle(manual.summary);
      const manualStart = manual.start?.getTime() ?? NaN;
      const timeMatch =
        Number.isFinite(plannedStart) &&
        Number.isFinite(manualStart) &&
        Math.abs(plannedStart - manualStart) < 60_000;
      if (!titleMatch && !timeMatch) continue;
      const reason = titleMatch ? "title" : "start-time";
      const key = `${row.campaignId}:${manual.id}:${reason}`;
      if (seen.has(key)) continue;
      seen.add(key);
      conflicts.push({
        campaignId: row.campaignId,
        plannedTitle: row.title,
        plannedStart: row.start,
        manualEventId: manual.id,
        manualSummary: manual.summary,
        manualStart: manual.startText,
        reason,
      });
    }
  }
  return conflicts;
}

export function ownedProperties(campaignId: string, eventAt?: string | null): Record<string, string> {
  const properties: Record<string, string> = {
    [PROP_CAMPAIGN_ID]: campaignId,
    [PROP_SOURCE]: SYNC_SOURCE,
    [PROP_SYNC]: SYNC_MARKER,
  };
  if (eventAt) properties[PROP_EVENT_AT] = eventAt;
  return properties;
}

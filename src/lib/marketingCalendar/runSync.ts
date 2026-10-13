import {
  KIN_MARKETING_CALENDAR_NAME,
  IMPORT_TIME_ZONE,
} from "./constants";
import { MarketingCalendarError } from "./errors";
import {
  createGoogleCalendarWriter,
  eventIsOwnedBySync,
  toGoogleEventResource,
  type ListedEvent,
} from "./googleCalendarClient";
import type { Sleep } from "./http";
import { collectMarketingCalendar, type DryRunReport } from "./runDryRun";
import { parseServiceAccount, resolveCalendarId } from "./serviceAccount";
import type { PlannedWrite, PossibleConflict } from "./syncPlan";

export interface ProposedDeletion {
  campaignId: string;
  title: string;
  googleEventId: string | null;
  reason: string;
}

export interface SkippedConflict {
  campaignId: string;
  title: string;
  manualSummary: string;
  reason: string;
}

export interface SyncChange {
  action: "create" | "update";
  campaignId: string;
  title: string;
  date: string | null;
  status: string;
  eventAt: string | null;
}

export interface MarketingCalendarSyncReport {
  ok: true;
  dryRun: boolean;
  created: number;
  updated: number;
  deleted: 0;
  writesPerformed: number;
  calendar: { summary: string; timeZone: string };
  changes: SyncChange[];
  proposedDeletions: ProposedDeletion[];
  skippedConflicts: SkippedConflict[];
}

export function planSyncActions(input: {
  writes: PlannedWrite[];
  conflicts: PossibleConflict[];
}): {
  apply: PlannedWrite[];
  proposedDeletions: ProposedDeletion[];
  skippedConflicts: SkippedConflict[];
} {
  const conflicted = new Set(input.conflicts.map((conflict) => conflict.campaignId));
  const conflictByCampaign = new Map<string, PossibleConflict>();
  for (const conflict of input.conflicts) {
    if (!conflictByCampaign.has(conflict.campaignId)) conflictByCampaign.set(conflict.campaignId, conflict);
  }
  const apply: PlannedWrite[] = [];
  const proposedDeletions: ProposedDeletion[] = [];
  const skippedConflicts: SkippedConflict[] = [];

  for (const write of input.writes) {
    if (write.action === "delete") {
      proposedDeletions.push({
        campaignId: write.campaignId,
        title: write.title,
        googleEventId: write.googleEventId,
        reason: write.reason,
      });
      continue;
    }
    if (write.action !== "create" && write.action !== "update") continue;
    if (conflicted.has(write.campaignId)) {
      const conflict = conflictByCampaign.get(write.campaignId);
      skippedConflicts.push({
        campaignId: write.campaignId,
        title: write.title,
        manualSummary: conflict?.manualSummary ?? "",
        reason: conflict?.reason ?? "conflict",
      });
      continue;
    }
    apply.push(write);
  }

  return { apply, proposedDeletions, skippedConflicts };
}

function changeFrom(write: PlannedWrite): SyncChange {
  return {
    action: write.action === "update" ? "update" : "create",
    campaignId: write.campaignId,
    title: write.title,
    date: write.start,
    status: write.status,
    eventAt: write.eventAt,
  };
}

export async function applySyncActions(
  writes: PlannedWrite[],
  writer: {
    getEvent: (eventId: string) => Promise<ListedEvent>;
    insertEvent: (resource: ReturnType<typeof toGoogleEventResource>) => Promise<{ id: string }>;
    patchEvent: (eventId: string, resource: ReturnType<typeof toGoogleEventResource>) => Promise<void>;
  },
): Promise<SyncChange[]> {
  const updates = writes.filter((write) => write.action === "update");
  const creates = writes.filter((write) => write.action === "create");
  if (writes.some((write) => write.action === "delete")) {
    throw new MarketingCalendarError("Calendar deletions are not applied.", { code: "calendar-write" });
  }

  for (const write of updates) {
    if (!write.googleEventId) {
      throw new MarketingCalendarError(
        `Campaign ${write.campaignId} has no owned calendar event id, so nothing was changed.`,
        { code: "calendar-write" },
      );
    }
    const current = await writer.getEvent(write.googleEventId);
    if (!eventIsOwnedBySync(current, write.campaignId)) {
      throw new MarketingCalendarError(
        `Calendar event ${write.googleEventId} is not owned by the marketing sync. It was not changed.`,
        { code: "manual-event" },
      );
    }
  }

  const changes: SyncChange[] = [];
  for (const write of creates) {
    await writer.insertEvent(toGoogleEventResource(write));
    changes.push(changeFrom(write));
  }
  for (const write of updates) {
    await writer.patchEvent(write.googleEventId || "", toGoogleEventResource(write));
    changes.push(changeFrom(write));
  }
  return changes;
}

export async function runMarketingCalendarSync(input: {
  env: NodeJS.ProcessEnv;
  dryRun?: boolean;
  fetchImpl?: typeof fetch;
  sleep?: Sleep;
  now?: Date;
}): Promise<MarketingCalendarSyncReport> {
  const collected = await collectMarketingCalendar(input);
  const planned = planSyncActions({
    writes: collected.writes,
    conflicts: collected.report.possibleConflicts,
  });
  const calendar = {
    summary: collected.report.calendar.summary || KIN_MARKETING_CALENDAR_NAME,
    timeZone: collected.report.calendar.timeZone || IMPORT_TIME_ZONE,
  };
  if (calendar.summary !== KIN_MARKETING_CALENDAR_NAME || calendar.timeZone !== IMPORT_TIME_ZONE) {
    throw new MarketingCalendarError(
      `The calendar is ${calendar.summary || "(unnamed)"} in ${calendar.timeZone || "(missing)"}. Nothing was changed.`,
      { code: "calendar-name" },
    );
  }
  if (input.dryRun || planned.apply.length === 0) {
    return {
      ok: true,
      dryRun: true,
      created: planned.apply.filter((write) => write.action === "create").length,
      updated: planned.apply.filter((write) => write.action === "update").length,
      deleted: 0,
      writesPerformed: 0,
      calendar,
      changes: planned.apply.map(changeFrom),
      proposedDeletions: planned.proposedDeletions,
      skippedConflicts: planned.skippedConflicts,
    };
  }

  const account = parseServiceAccount(input.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON);
  const writer = createGoogleCalendarWriter({
    account,
    calendarId: resolveCalendarId(input.env),
    fetchImpl: input.fetchImpl,
    sleep: input.sleep,
    now: input.now,
  });
  await writer.verifyAccess();
  const changes = await applySyncActions(planned.apply, writer);
  return {
    ok: true,
    dryRun: false,
    created: changes.filter((change) => change.action === "create").length,
    updated: changes.filter((change) => change.action === "update").length,
    deleted: 0,
    writesPerformed: changes.length,
    calendar,
    changes,
    proposedDeletions: planned.proposedDeletions,
    skippedConflicts: planned.skippedConflicts,
  };
}

export function scheduledSyncIsLive(env: NodeJS.ProcessEnv): boolean {
  return (env.MARKETING_CALENDAR_SYNC_LIVE_ENABLED || "").trim() === "true";
}

export function publicSyncSummary(report: MarketingCalendarSyncReport): {
  ok: true;
  dryRun: boolean;
  created: number;
  updated: number;
  deleted: 0;
  writesPerformed: number;
  proposedDeletionCount: number;
  skippedConflictCount: number;
} {
  return {
    ok: true,
    dryRun: report.dryRun,
    created: report.created,
    updated: report.updated,
    deleted: 0,
    writesPerformed: report.writesPerformed,
    proposedDeletionCount: report.proposedDeletions.length,
    skippedConflictCount: report.skippedConflicts.length,
  };
}

export type { DryRunReport };

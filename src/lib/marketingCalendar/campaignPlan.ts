import { EVENT_COLOR } from "./constants";
import { isEmptyDate, parseAcDateTime, type ParsedDate } from "./dates";

export type CampaignStatusName =
  | "draft"
  | "scheduled"
  | "sending"
  | "paused"
  | "stopped"
  | "completed"
  | "disabled"
  | "unknown";

const STATUS_BY_CODE: Record<string, Exclude<CampaignStatusName, "unknown">> = {
  "0": "draft",
  "1": "scheduled",
  "2": "sending",
  "3": "paused",
  "4": "stopped",
  "5": "completed",
  "6": "disabled",
};

export interface CampaignSnapshot {
  id: string;
  name: string;
  type: string | null;
  status: string | null;
  seriesId: string | null;
  automation: string | null;
  scheduledDate: string | null;
  sendDate: string | null;
  lastSendDate: string | null;
  messageId: string | null;
}

export type CampaignDecision =
  | { kind: "skip"; campaign: CampaignSnapshot; reason: string }
  | {
      kind: "upsert";
      campaign: CampaignSnapshot;
      status: CampaignStatusName;
      colorId: string;
      instant: Date;
      timeSource: "scheduleddate" | "sdate" | "ldate";
    }
  | {
      kind: "preserve";
      campaign: CampaignSnapshot;
      status: CampaignStatusName;
      colorId: string;
      reason: string;
    }
  | { kind: "delete"; campaign: CampaignSnapshot; reason: "schedule-cleared" };

function text(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function noneIfZero(value: string | null): string | null {
  if (value == null || value === "0") return null;
  return value;
}

export function normalizeCampaign(raw: unknown): CampaignSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const id = text(record.id);
  if (!id) return null;
  return {
    id,
    name: text(record.name) ?? "",
    type: text(record.type),
    status: text(record.status),
    seriesId: noneIfZero(text(record.seriesid)),
    automation: noneIfZero(text(record.automation)),
    scheduledDate: text(record.scheduleddate),
    sendDate: text(record.sdate),
    lastSendDate: text(record.ldate),
    messageId: noneIfZero(text(record.message_id)),
  };
}

export function statusName(code: string | null): CampaignStatusName {
  if (!code) return "unknown";
  return STATUS_BY_CODE[code] ?? "unknown";
}

export function statusLabel(status: CampaignStatusName): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "scheduled":
      return "Scheduled";
    case "sending":
      return "Sending";
    case "paused":
      return "Paused";
    case "stopped":
      return "Stopped";
    case "completed":
      return "Completed";
    case "disabled":
      return "Disabled";
    default:
      return "Unknown";
  }
}

function isBroadcast(campaign: CampaignSnapshot): { ok: true } | { ok: false; reason: string } {
  if (campaign.automation) return { ok: false, reason: "not-broadcast:automation" };
  if (campaign.seriesId) return { ok: false, reason: "not-broadcast:series" };
  if (campaign.type !== "single") {
    return { ok: false, reason: `not-broadcast:${campaign.type ?? "unknown"}` };
  }
  return { ok: true };
}

function parsed(
  value: string | null,
  accountTimeZone: string | null,
): ParsedDate {
  return parseAcDateTime(value, accountTimeZone);
}

function allEmpty(dates: ParsedDate[]): boolean {
  return dates.every((date) => date.kind === "empty");
}

function colorFor(status: CampaignStatusName): string {
  switch (status) {
    case "draft":
      return EVENT_COLOR.draft;
    case "scheduled":
      return EVENT_COLOR.scheduled;
    case "sending":
      return EVENT_COLOR.sending;
    case "paused":
      return EVENT_COLOR.paused;
    case "stopped":
      return EVENT_COLOR.stopped;
    case "disabled":
      return EVENT_COLOR.disabled;
    case "completed":
      return EVENT_COLOR.completed;
    default:
      return EVENT_COLOR.paused;
  }
}

/**
 * Decide what one campaign means for the calendar.
 * Undated drafts are not given a date. A non-empty date that cannot be
 * parsed is incomplete, not a cleared schedule.
 */
export function decideCampaign(
  campaign: CampaignSnapshot,
  accountTimeZone: string | null,
): CampaignDecision {
  const broadcast = isBroadcast(campaign);
  if (!broadcast.ok) return { kind: "skip", campaign, reason: broadcast.reason };

  const status = statusName(campaign.status);
  const scheduled = parsed(campaign.scheduledDate, accountTimeZone);
  const sent = parsed(campaign.sendDate, accountTimeZone);
  const lastSent = parsed(campaign.lastSendDate, accountTimeZone);
  const colorId = colorFor(status);

  const upsert = (
    instant: Date,
    timeSource: "scheduleddate" | "sdate" | "ldate",
  ): CampaignDecision => ({
    kind: "upsert",
    campaign,
    status,
    colorId,
    instant,
    timeSource,
  });

  const preserve = (reason: string): CampaignDecision => ({
    kind: "preserve",
    campaign,
    status,
    colorId,
    reason,
  });

  if (status === "draft" || status === "disabled") {
    if (scheduled.kind === "instant") return upsert(scheduled.instant, "scheduleddate");
    if (scheduled.kind === "unparsed" || sent.kind !== "empty" || lastSent.kind !== "empty") {
      return preserve(
        scheduled.kind === "unparsed"
          ? `scheduled-date-${scheduled.reason}`
          : "send-history-present",
      );
    }
    if (allEmpty([scheduled, sent, lastSent]) && isEmptyDate(campaign.scheduledDate)) {
      return { kind: "delete", campaign, reason: "schedule-cleared" };
    }
    return preserve("scheduled-date-missing");
  }

  if (status === "scheduled") {
    if (scheduled.kind === "instant") return upsert(scheduled.instant, "scheduleddate");
    return preserve(
      scheduled.kind === "unparsed" ? `scheduled-date-${scheduled.reason}` : "scheduled-date-missing",
    );
  }

  if (status === "completed") {
    if (sent.kind === "instant") return upsert(sent.instant, "sdate");
    if (sent.kind === "empty" && lastSent.kind === "instant") return upsert(lastSent.instant, "ldate");
    return preserve("send-date-missing");
  }

  if (status === "sending") {
    if (sent.kind === "instant") return upsert(sent.instant, "sdate");
    if (scheduled.kind === "instant") return upsert(scheduled.instant, "scheduleddate");
    return preserve("send-date-missing");
  }

  if (status === "paused" || status === "stopped") {
    if (sent.kind === "instant") return upsert(sent.instant, "sdate");
    if (scheduled.kind === "instant") return upsert(scheduled.instant, "scheduleddate");
    if (lastSent.kind === "instant") return upsert(lastSent.instant, "ldate");
    return preserve("scheduled-date-missing");
  }

  return preserve("unknown-status");
}

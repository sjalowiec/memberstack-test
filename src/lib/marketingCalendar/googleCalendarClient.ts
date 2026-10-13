import {
  KIN_MARKETING_CALENDAR_NAME,
  PROP_CAMPAIGN_ID,
  PROP_SOURCE,
  PROP_SYNC,
} from "./constants";
import { MarketingCalendarError } from "./errors";
import { requestJson, type Sleep } from "./http";
import { mintAccessToken, type ServiceAccount } from "./serviceAccount";
import { ownedProperties, type PlannedWrite } from "./syncPlan";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export interface CalendarAccess {
  calendarId: string;
  summary: string;
  accessRole: string;
  timeZone: string;
}

export interface ListedEvent {
  id: string;
  summary: string;
  description: string;
  colorId: string | null;
  start: Date | null;
  startText: string | null;
  recurringEventId: string | null;
  recurring: boolean;
  allDay: boolean;
  etag: string | null;
  updated: string | null;
  privateProps: Record<string, string>;
}

export interface GoogleEventResource {
  summary?: string;
  description?: string;
  colorId?: string;
  start?: { date?: string; dateTime?: string; timeZone?: string };
  end?: { date?: string; dateTime?: string; timeZone?: string };
  extendedProperties: { private: Record<string, string> };
}

export interface GoogleCalendarReader {
  verifyAccess(): Promise<CalendarAccess>;
  listOwnedEvents(): Promise<ListedEvent[]>;
  listWindowEvents(timeMin: string, timeMax: string): Promise<ListedEvent[]>;
}

export interface GoogleCalendarWriter extends GoogleCalendarReader {
  getEvent(eventId: string): Promise<ListedEvent>;
  insertEvent(resource: GoogleEventResource): Promise<{ id: string }>;
  patchEvent(eventId: string, resource: GoogleEventResource): Promise<void>;
  deleteEvent(eventId: string): Promise<void>;
}

export function toGoogleEventResource(write: PlannedWrite): GoogleEventResource {
  const resource: GoogleEventResource = {
    summary: write.title,
    description: write.description,
    extendedProperties: { private: ownedProperties(write.campaignId, write.eventAt) },
  };
  if (write.colorId) resource.colorId = write.colorId;
  if (!write.timePreserved && write.allDay && write.start && write.end) {
    resource.start = { date: write.start };
    resource.end = { date: write.end };
  } else if (!write.timePreserved && write.start && write.end && write.timeZone) {
    resource.start = { dateTime: write.start, timeZone: write.timeZone };
    resource.end = { dateTime: write.end, timeZone: write.timeZone };
  }
  return resource;
}

function assertVerified(verified: boolean): void {
  if (!verified) {
    throw new MarketingCalendarError(
      "Calendar access has not been confirmed for the service account.",
      { code: "calendar-auth" },
    );
  }
}

function privateProps(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object") return {};
  const extended = (raw as { extendedProperties?: { private?: unknown } }).extendedProperties?.private;
  if (!extended || typeof extended !== "object") return {};
  const props: Record<string, string> = {};
  for (const [key, value] of Object.entries(extended)) {
    if (typeof value === "string") props[key] = value;
  }
  return props;
}

export function mapListedEvent(raw: unknown): ListedEvent | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id : "";
  if (!id) return null;
  const startRecord =
    record.start && typeof record.start === "object" ? (record.start as Record<string, unknown>) : {};
  const startText =
    typeof startRecord.dateTime === "string"
      ? startRecord.dateTime
      : typeof startRecord.date === "string"
        ? startRecord.date
        : null;
  const start = startRecord.dateTime ? new Date(String(startRecord.dateTime)) : null;
  const recurringEventId =
    typeof record.recurringEventId === "string" ? record.recurringEventId : null;
  return {
    id,
    summary: typeof record.summary === "string" ? record.summary : "",
    description: typeof record.description === "string" ? record.description : "",
    colorId: record.colorId == null ? null : String(record.colorId),
    start: start && !Number.isNaN(start.getTime()) ? start : null,
    startText,
    recurringEventId,
    recurring: Boolean(recurringEventId) || Array.isArray(record.recurrence),
    allDay: typeof startRecord.date === "string" && typeof startRecord.dateTime !== "string",
    etag: typeof record.etag === "string" ? record.etag : null,
    updated: typeof record.updated === "string" ? record.updated : null,
    privateProps: privateProps(record),
  };
}

async function listEvents(
  token: string,
  calendarId: string,
  params: URLSearchParams,
  deps: { fetchImpl?: typeof fetch; sleep?: Sleep },
): Promise<ListedEvent[]> {
  const events: ListedEvent[] = [];
  const seenTokens = new Set<string>();
  let pageToken = "";
  for (let page = 0; page < 40; page += 1) {
    if (pageToken) {
      if (seenTokens.has(pageToken)) {
        throw new MarketingCalendarError("Google Calendar event list did not advance.", {
          code: "incomplete",
        });
      }
      seenTokens.add(pageToken);
      params.set("pageToken", pageToken);
    }
    const url = `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;
    const payload = await requestJson({
      url,
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      fetchImpl: deps.fetchImpl,
      sleep: deps.sleep,
      label: "Google Calendar",
    });
    const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
    const items = Array.isArray(record.items) ? record.items : [];
    for (const item of items) {
      const mapped = mapListedEvent(item);
      if (mapped) events.push(mapped);
    }
    const next = typeof record.nextPageToken === "string" ? record.nextPageToken : "";
    if (!next) return events;
    pageToken = next;
  }
  throw new MarketingCalendarError(
    "Google Calendar event list was incomplete, so no calendar changes were planned.",
    { code: "incomplete" },
  );
}

/**
 * A calendar shared with a service account is often missing from calendarList.
 * events.list still returns the calendar name, time zone, and access role.
 * The probe window is empty so this check does not read event details.
 */
async function readSharedCalendar(options: {
  calendarId: string;
  clientEmail: string;
  headers: Record<string, string>;
  fetchImpl?: typeof fetch;
  sleep?: Sleep;
}): Promise<{ summary: string; accessRole: string; timeZone: string }> {
  const params = new URLSearchParams({
    maxResults: "1",
    singleEvents: "true",
    showDeleted: "false",
    timeMin: "1970-01-01T00:00:00Z",
    timeMax: "1970-01-01T00:00:01Z",
  });
  let record: Record<string, unknown>;
  try {
    const payload = await requestJson({
      url: `${CALENDAR_API}/calendars/${encodeURIComponent(options.calendarId)}/events?${params.toString()}`,
      headers: options.headers,
      fetchImpl: options.fetchImpl,
      sleep: options.sleep,
      label: "Google Calendar",
    });
    record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  } catch (error) {
    if (error instanceof MarketingCalendarError && (error.status === 404 || error.status === 403)) {
      throw new MarketingCalendarError(
        `Service account ${options.clientEmail} cannot use the KIN marketing calendar (HTTP ${error.status}). Share it with that account as Make changes to events. No events were read.`,
        { code: "calendar-permission", status: error.status },
      );
    }
    throw error;
  }
  return {
    summary: typeof record.summary === "string" ? record.summary.trim() : "",
    accessRole: typeof record.accessRole === "string" ? record.accessRole.trim().toLowerCase() : "",
    timeZone: typeof record.timeZone === "string" ? record.timeZone.trim() : "",
  };
}

export function createGoogleCalendarClient(options: {
  account: ServiceAccount;
  calendarId: string;
  allowWrites?: boolean;
  fetchImpl?: typeof fetch;
  sleep?: Sleep;
  now?: Date;
}): GoogleCalendarWriter {
  const allowWrites = options.allowWrites === true;
  let verified = false;
  let token = "";
  const deps = { fetchImpl: options.fetchImpl, sleep: options.sleep };

  async function authorized(): Promise<string> {
    assertVerified(verified);
    if (!token) {
      throw new MarketingCalendarError("Google Calendar is missing an access token.", {
        code: "calendar-auth",
      });
    }
    return token;
  }

  function requireWrites(): void {
    if (!allowWrites) {
      throw new MarketingCalendarError("Calendar writes are not enabled.", { code: "writes-disabled" });
    }
  }

  return {
    async verifyAccess() {
      token = await mintAccessToken(options.account, {
        fetchImpl: options.fetchImpl,
        sleep: options.sleep,
        now: options.now,
      });
      const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
      let summary = "";
      let accessRole = "";
      let timeZone = "";
      try {
        const payload = await requestJson({
          url: `${CALENDAR_API}/users/me/calendarList/${encodeURIComponent(options.calendarId)}`,
          headers,
          fetchImpl: options.fetchImpl,
          sleep: options.sleep,
          label: "Google Calendar",
        });
        const record = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
        summary = typeof record.summary === "string" ? record.summary.trim() : "";
        accessRole = typeof record.accessRole === "string" ? record.accessRole.trim().toLowerCase() : "";
        timeZone = typeof record.timeZone === "string" ? record.timeZone.trim() : "";
      } catch (error) {
        if (!(error instanceof MarketingCalendarError) || (error.status !== 404 && error.status !== 403)) {
          throw error;
        }
        const shared = await readSharedCalendar({
          calendarId: options.calendarId,
          clientEmail: options.account.clientEmail,
          headers,
          fetchImpl: options.fetchImpl,
          sleep: options.sleep,
        });
        summary = shared.summary;
        accessRole = shared.accessRole;
        timeZone = shared.timeZone;
      }
      if (summary !== KIN_MARKETING_CALENDAR_NAME) {
        throw new MarketingCalendarError(
          `The calendar ID is named "${summary || "(unnamed)"}", not ${KIN_MARKETING_CALENDAR_NAME}. No events were read.`,
          { code: "calendar-name" },
        );
      }
      if (accessRole !== "writer" && accessRole !== "owner") {
        throw new MarketingCalendarError(
          `Service account ${options.account.clientEmail} has "${accessRole || "no"}" access. Share ${KIN_MARKETING_CALENDAR_NAME} as Make changes to events. No events were read.`,
          { code: "calendar-permission" },
        );
      }
      verified = true;
      return {
        calendarId: options.calendarId,
        summary,
        accessRole,
        timeZone,
      };
    },

    async listOwnedEvents() {
      const accessToken = await authorized();
      const params = new URLSearchParams({
        maxResults: "250",
        showDeleted: "false",
        singleEvents: "false",
      });
      params.append("privateExtendedProperty", `${PROP_SYNC}=kin-marketing`);
      params.append("privateExtendedProperty", `${PROP_SOURCE}=activecampaign`);
      return listEvents(accessToken, options.calendarId, params, deps);
    },

    async listWindowEvents(timeMin: string, timeMax: string) {
      const accessToken = await authorized();
      const params = new URLSearchParams({
        maxResults: "250",
        showDeleted: "false",
        singleEvents: "true",
        timeMin,
        timeMax,
      });
      return listEvents(accessToken, options.calendarId, params, deps);
    },

    async getEvent(eventId: string) {
      requireWrites();
      const accessToken = await authorized();
      const payload = await requestJson({
        url: `${CALENDAR_API}/calendars/${encodeURIComponent(options.calendarId)}/events/${encodeURIComponent(eventId)}`,
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        fetchImpl: options.fetchImpl,
        sleep: options.sleep,
        label: "Google Calendar",
      });
      const mapped = mapListedEvent(payload);
      if (!mapped) {
        throw new MarketingCalendarError("Google Calendar event could not be read.", { code: "calendar-event" });
      }
      return mapped;
    },

    async insertEvent(resource: GoogleEventResource) {
      requireWrites();
      const accessToken = await authorized();
      const payload = await requestJson({
        url: `${CALENDAR_API}/calendars/${encodeURIComponent(options.calendarId)}/events`,
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(resource),
        fetchImpl: options.fetchImpl,
        sleep: options.sleep,
        label: "Google Calendar",
      });
      const id =
        payload && typeof payload === "object" ? (payload as { id?: unknown }).id : null;
      if (typeof id !== "string" || !id) {
        throw new MarketingCalendarError("Google Calendar did not return an event id.", {
          code: "calendar-write",
        });
      }
      return { id };
    },

    async patchEvent(eventId: string, resource: GoogleEventResource) {
      requireWrites();
      const accessToken = await authorized();
      await requestJson({
        url: `${CALENDAR_API}/calendars/${encodeURIComponent(options.calendarId)}/events/${encodeURIComponent(eventId)}`,
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(resource),
        fetchImpl: options.fetchImpl,
        sleep: options.sleep,
        label: "Google Calendar",
      });
    },

    async deleteEvent(eventId: string) {
      requireWrites();
      const accessToken = await authorized();
      await requestJson({
        url: `${CALENDAR_API}/calendars/${encodeURIComponent(options.calendarId)}/events/${encodeURIComponent(eventId)}`,
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
        fetchImpl: options.fetchImpl,
        sleep: options.sleep,
        label: "Google Calendar",
      });
    },
  };
}

export function createGoogleCalendarReader(
  options: Omit<Parameters<typeof createGoogleCalendarClient>[0], "allowWrites">,
): GoogleCalendarReader {
  const client = createGoogleCalendarClient({ ...options, allowWrites: false });
  return {
    verifyAccess: () => client.verifyAccess(),
    listOwnedEvents: () => client.listOwnedEvents(),
    listWindowEvents: (timeMin, timeMax) => client.listWindowEvents(timeMin, timeMax),
  };
}

export function createGoogleCalendarWriter(
  options: Omit<Parameters<typeof createGoogleCalendarClient>[0], "allowWrites">,
): GoogleCalendarWriter {
  return createGoogleCalendarClient({ ...options, allowWrites: true });
}

export function eventIsOwnedBySync(event: ListedEvent, campaignId: string): boolean {
  return (
    event.privateProps[PROP_CAMPAIGN_ID] === campaignId &&
    event.privateProps[PROP_SYNC] === "kin-marketing" &&
    event.privateProps[PROP_SOURCE] === "activecampaign"
  );
}

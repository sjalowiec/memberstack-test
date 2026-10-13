import { MarketingCalendarError } from "./errors";
import {
  eventIsOwnedBySync,
  toGoogleEventResource,
  type GoogleCalendarWriter,
  type GoogleEventResource,
} from "./googleCalendarClient";
import type { PlannedWrite } from "./syncPlan";

/**
 * Applies an already reviewed plan. The dry-run script and the Netlify
 * function do not call this. A live run stays unwired until the dry run
 * is approved.
 */
export async function applyMarketingCalendarPlan(
  writes: PlannedWrite[],
  writer: Pick<GoogleCalendarWriter, "getEvent" | "insertEvent" | "patchEvent" | "deleteEvent">,
): Promise<{ created: number; updated: number; deleted: number }> {
  let created = 0;
  let updated = 0;
  let deleted = 0;

  for (const write of writes) {
    if (write.action === "create") {
      await writer.insertEvent(toGoogleEventResource(write));
      created += 1;
      continue;
    }
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
    if (write.action === "delete") {
      await writer.deleteEvent(write.googleEventId);
      deleted += 1;
      continue;
    }
    await writer.patchEvent(write.googleEventId, toGoogleEventResource(write));
    updated += 1;
  }

  return { created, updated, deleted };
}

export type { GoogleEventResource };

/**
 * Temporary read-only probe for the Bust Darts investigation.
 * It reads ActiveCampaign and Google Calendar and does not write.
 */
import { getActiveCampaignConfig } from "../../src/lib/activecampaign/client";
import { listCampaigns, loadAccountTimeZone, loadMessageSubjects } from "../../src/lib/marketingCalendar/activeCampaignCampaigns";
import { decideCampaign, statusLabel, statusName, type CampaignSnapshot } from "../../src/lib/marketingCalendar/campaignPlan";
import { IMPORT_TIME_ZONE, PROP_CAMPAIGN_ID, PROP_SYNC } from "../../src/lib/marketingCalendar/constants";
import { isOnOrAfterImportStart, isValidTimeZone } from "../../src/lib/marketingCalendar/dates";
import { MarketingCalendarError } from "../../src/lib/marketingCalendar/errors";
import { createGoogleCalendarReader, type ListedEvent } from "../../src/lib/marketingCalendar/googleCalendarClient";
import { parseServiceAccount, resolveCalendarId } from "../../src/lib/marketingCalendar/serviceAccount";
import { buildSyncPlan, type OwnedCalendarEvent } from "../../src/lib/marketingCalendar/syncPlan";

const CHECK = "bust-darts-readonly-2026-10-13";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
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

export default async function marketingCalendarInspect(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (url.searchParams.get("check") !== CHECK) return json({ ok: false, error: "Not found" }, 404);
  if (req.method !== "GET") return json({ ok: false, error: "Method not allowed" }, 405);

  try {
    const config = getActiveCampaignConfig(process.env);
    if (!config) return json({ ok: false, error: "ActiveCampaign config missing" }, 500);
    const host = new URL(config.baseUrl).host;
    if (host !== "knititnow.api-us1.com" || config.apiKey.includes("*")) {
      return json({ ok: false, error: "Credential source refused" }, 500);
    }

    const account = parseServiceAccount(process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON);
    const calendar = createGoogleCalendarReader({ account, calendarId: resolveCalendarId(process.env) });
    const access = await calendar.verifyAccess();
    const calendarTimeZone = access.timeZone && isValidTimeZone(access.timeZone) ? access.timeZone : IMPORT_TIME_ZONE;
    const ownedEvents = (await calendar.listOwnedEvents()).map(toOwned);
    const ownedIds = new Set(ownedEvents.map((event) => event.campaignId).filter((id): id is string => Boolean(id)));

    const zone = await loadAccountTimeZone(config, {});
    const campaigns = await listCampaigns(config, {});
    const decisions = campaigns.map((campaign) => decideCampaign(campaign, zone.timeZone));
    const messageIds = decisions
      .filter((decision) => {
        if (decision.kind === "skip" || !decision.campaign.messageId) return false;
        if (decision.kind === "upsert") return isOnOrAfterImportStart(decision.instant) || ownedIds.has(decision.campaign.id);
        return ownedIds.has(decision.campaign.id);
      })
      .map((decision) => decision.campaign.messageId ?? "");
    const subjects = await loadMessageSubjects(config, messageIds, {});
    const plan = buildSyncPlan({
      decisions,
      subjects: subjects.subjects,
      ownedEvents,
      baseUrl: config.baseUrl,
      calendarTimeZone,
    });
    const decisionById = new Map(decisions.map((decision) => [decision.campaign.id, decision]));
    const rowById = new Map(plan.rows.map((row) => [row.campaignId, row]));

    const describe = (campaign: CampaignSnapshot) => {
      const decision = decisionById.get(campaign.id);
      const row = rowById.get(campaign.id);
      const instant = decision?.kind === "upsert" ? decision.instant : null;
      return {
        id: campaign.id,
        name: campaign.name,
        subject: subjects.subjects.get(campaign.messageId || "") ?? null,
        type: campaign.type,
        status: statusLabel(statusName(campaign.status)),
        automation: campaign.automation,
        seriesId: campaign.seriesId,
        scheduledDate: campaign.scheduledDate,
        sendDate: campaign.sendDate,
        lastSendDate: campaign.lastSendDate,
        decision: decision?.kind ?? null,
        planAction: row?.action ?? null,
        reason: row?.reason ?? ("reason" in (decision ?? {}) ? (decision as { reason?: string }).reason ?? null : null),
        onOrAfterImportStart: instant ? isOnOrAfterImportStart(instant) : null,
        alreadyOnCalendar: ownedIds.has(campaign.id),
      };
    };

    const interesting = campaigns.filter(
      (campaign) =>
        /bust|dart/i.test(campaign.name) ||
        Number(campaign.id) > 2410 ||
        campaign.status === "1" ||
        campaign.status === "2",
    );

    return json({
      ok: true,
      host,
      accountTimeZone: zone.timeZone,
      timeZoneWarning: zone.warning,
      calendar: { summary: access.summary, timeZone: calendarTimeZone },
      campaignsFound: campaigns.length,
      ownedEvents: ownedEvents.length,
      counts: plan.counts,
      skipReasons: plan.skipReasons,
      subjectWarnings: subjects.warnings,
      matches: interesting.map(describe),
    });
  } catch (error) {
    const message = error instanceof MarketingCalendarError ? error.message : "Read failed.";
    return json({ ok: false, error: message }, 500);
  }
}

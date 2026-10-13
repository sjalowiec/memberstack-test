/**
 * Temporary read-only dry run. Remove after confirming the five scheduled creates.
 */
import { MarketingCalendarError } from "../../src/lib/marketingCalendar/errors";
import { collectMarketingCalendar } from "../../src/lib/marketingCalendar/runDryRun";

const CHECK = "scheduled-sdate-dry-run";
const EXPECTED = ["2300", "2302", "2406", "2415", "2417"];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export default async function scheduledDateDryRun(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (url.searchParams.get("check") !== CHECK) return json({ ok: false, error: "Not found" }, 404);
  if (req.method !== "GET") return json({ ok: false, error: "Method not allowed" }, 405);
  try {
    const collected = await collectMarketingCalendar({ env: process.env });
    const changes = collected.report.actions
      .filter((row) => row.action === "create" || row.action === "update" || row.action === "delete")
      .map((row) => ({
        action: row.action,
        campaignId: row.campaignId,
        title: row.title,
        start: row.start,
        eventAt: row.eventAt,
        timeSource: row.timeSource,
        reason: row.reason,
      }));
    return json({
      ok: true,
      dryRun: true,
      writesPerformed: 0,
      campaignsFound: collected.report.campaignsFound,
      counts: collected.report.counts,
      skipReasons: collected.report.skipReasons,
      changes,
      expectedPresent: EXPECTED.map((id) => changes.some((row) => row.campaignId === id && row.action === "create")),
    });
  } catch (error) {
    const message = error instanceof MarketingCalendarError ? error.message : "Read failed.";
    return json({ ok: false, error: message }, 500);
  }
}

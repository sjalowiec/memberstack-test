/**
 * Daily sync of saved Watson complimentary dates to ActiveCampaign.
 *
 * Writes only when this is the production site and
 * COMPLIMENTARY_CAMPAIGN_SYNC_LIVE_ENABLED === "true". kin-dev stays dry-run
 * so it cannot tag or date the same live contacts. Manual HTTP is always a
 * dry run. Does not send email or change list subscription status.
 */
import { isScheduledInvocation } from "./legacy-annual-expiry";
import {
  complimentaryCampaignSyncWillWrite,
  runComplimentaryCampaignSync,
} from "../../src/lib/watson/complimentaryCampaignSync";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export default async (req: Request): Promise<Response> => {
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  let bodyText = "";
  if (req.method === "POST") {
    try {
      bodyText = await req.text();
    } catch {
      bodyText = "";
    }
  }

  const scheduled = isScheduledInvocation(bodyText);
  const liveWrite = scheduled && complimentaryCampaignSyncWillWrite();

  try {
    const result = await runComplimentaryCampaignSync({ liveWrite });
    console.log("[complimentary-campaign-sync]", {
      liveWrite: result.liveWrite,
      candidatesFound: result.candidatesFound,
      synced: result.synced,
      wouldSync: result.wouldSync,
      skipped: result.skipped,
      failures: result.failures,
    });
    return json({ ok: result.ok, result, error: result.errorMessage }, result.ok ? 200 : 502);
  } catch (error) {
    console.error("complimentary-campaign-sync failed:", error);
    return json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Complimentary campaign sync failed.",
      },
      500,
    );
  }
};

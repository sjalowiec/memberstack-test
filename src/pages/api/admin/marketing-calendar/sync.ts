import type { APIRoute } from "astro";

import { adminAuthErrorBody, requireAdminForRequest } from "../../../../lib/admin/requireAdminRequest";
import { MarketingCalendarError } from "../../../../lib/marketingCalendar/errors";
import { runMarketingCalendarSync, type MarketingCalendarSyncReport } from "../../../../lib/marketingCalendar/runSync";

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export async function handleMarketingCalendarAdminSync(
  request: Request,
  cookies: { get: (name: string) => { value: string } | undefined },
  deps: {
    sync?: typeof runMarketingCalendarSync;
  } = {},
): Promise<Response> {
  const auth = await requireAdminForRequest(request, cookies);
  if (!auth.ok) return json(adminAuthErrorBody(auth), auth.status);
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  try {
    const sync = deps.sync ?? runMarketingCalendarSync;
    const result = await sync({ env: process.env, dryRun: false });
    return json(adminSyncBody(result));
  } catch (error) {
    const message =
      error instanceof MarketingCalendarError
        ? error.message
        : "Marketing calendar sync failed.";
    return json({ ok: false, created: 0, updated: 0, deleted: 0, error: message }, 502);
  }
}

function adminSyncBody(result: MarketingCalendarSyncReport) {
  return {
    ok: true,
    dryRun: result.dryRun,
    created: result.created,
    updated: result.updated,
    deleted: result.deleted,
    writesPerformed: result.writesPerformed,
    calendar: result.calendar,
    changes: result.changes,
    proposedDeletions: result.proposedDeletions,
    skippedConflicts: result.skippedConflicts,
  };
}

export const POST: APIRoute = ({ request, cookies }) => handleMarketingCalendarAdminSync(request, cookies);

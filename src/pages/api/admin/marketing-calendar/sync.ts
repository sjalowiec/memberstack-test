import type { APIRoute } from "astro";

import { adminAuthErrorBody, requireAdminForRequest } from "../../../../lib/admin/requireAdminRequest";
import { readMarketingCalendarSyncJob, startMarketingCalendarSync } from "../../../../lib/marketingCalendar/syncJob";
import type { SyncJobStore } from "../../../../lib/marketingCalendar/syncJobStore";

export const prerender = false;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

type AdminDeps = {
  store?: SyncJobStore;
  now?: () => Date;
  createId?: () => string;
  dispatch?: (input: { origin: string; jobId: string; token: string }) => Promise<"accepted" | "unreachable">;
};

export async function handleMarketingCalendarAdminSync(
  request: Request,
  cookies: { get: (name: string) => { value: string } | undefined },
  deps: AdminDeps = {},
): Promise<Response> {
  const auth = await requireAdminForRequest(request, cookies);
  if (!auth.ok) return json(adminAuthErrorBody(auth), auth.status);
  if (request.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);

  const started = await startMarketingCalendarSync({
    store: deps.store,
    origin: new URL(request.url).origin,
    now: deps.now?.(),
    createId: deps.createId,
    dispatch: deps.dispatch,
  });
  if (started.outcome === "start-failed") {
    return json({ ok: false, status: "failed", error: started.error }, 502);
  }
  return json(
    {
      ok: true,
      status: "running",
      jobId: started.jobId,
      alreadyRunning: started.outcome === "already-running",
    },
    202,
  );
}

export async function handleMarketingCalendarAdminStatus(
  request: Request,
  cookies: { get: (name: string) => { value: string } | undefined },
  deps: AdminDeps = {},
): Promise<Response> {
  const auth = await requireAdminForRequest(request, cookies);
  if (!auth.ok) return json(adminAuthErrorBody(auth), auth.status);
  if (request.method !== "GET") return json({ ok: false, error: "Method not allowed" }, 405);

  const jobId = new URL(request.url).searchParams.get("job") || "";
  const job = await readMarketingCalendarSyncJob({
    store: deps.store,
    jobId,
    now: deps.now?.(),
  });
  if (!job) return json({ ok: false, error: "That sync could not be found." }, 404);
  return json(job);
}

export const POST: APIRoute = ({ request, cookies }) => handleMarketingCalendarAdminSync(request, cookies);
export const GET: APIRoute = ({ request, cookies }) => handleMarketingCalendarAdminStatus(request, cookies);

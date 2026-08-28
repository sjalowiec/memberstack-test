import type { APIRoute } from "astro";
import { requireVerifiedMemberForRequest } from "../../../lib/admin/requireAdminRequest";
import {
  isMachineSalesPublishAllowed,
  MACHINE_SALES_PUBLISH_CONFIRM,
  planMachineSalesPublish,
  publishMachineSalesToProduction,
} from "../../../lib/machines/machineSalesPublish";

export const prerender = false;

const adminEnv = {
  isViteDev: import.meta.env.DEV,
  publicSiteEnv: import.meta.env.PUBLIC_SITE_ENV,
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function productionBlockedResponse() {
  return jsonResponse(
    {
      ok: false,
      error: "Publish to Production is only available from DEV, not from knititnow.com.",
    },
    403,
  );
}

async function requirePublisher(
  request: Request,
  cookies: Parameters<typeof requireVerifiedMemberForRequest>[1],
) {
  const hostname = new URL(request.url).hostname;
  if (!isMachineSalesPublishAllowed(hostname, adminEnv)) {
    return productionBlockedResponse();
  }
  const auth = await requireVerifiedMemberForRequest(request, cookies);
  if (!auth.ok) {
    return jsonResponse({ ok: false, error: auth.error }, auth.status);
  }
  return null;
}

export const GET: APIRoute = async ({ request, cookies }) => {
  const blocked = await requirePublisher(request, cookies);
  if (blocked) return blocked;

  try {
    const { plan } = await planMachineSalesPublish();
    return jsonResponse({ ok: true, ...plan });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not prepare the publish plan.";
    return jsonResponse({ ok: false, error: message }, 500);
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const blocked = await requirePublisher(request, cookies);
  if (blocked) return blocked;

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return jsonResponse({ ok: false, error: "Content-Type must be application/json" }, 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const confirm =
    body && typeof body === "object" && "confirm" in body
      ? String((body as { confirm?: unknown }).confirm ?? "")
      : "";
  if (confirm !== MACHINE_SALES_PUBLISH_CONFIRM) {
    return jsonResponse(
      {
        ok: false,
        error: `Body must include confirm: "${MACHINE_SALES_PUBLISH_CONFIRM}".`,
      },
      400,
    );
  }

  try {
    const result = await publishMachineSalesToProduction();
    return jsonResponse({
      ok: true,
      ...result,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Publish to Production failed.";
    return jsonResponse({ ok: false, error: message }, 500);
  }
};

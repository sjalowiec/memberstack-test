import type { APIRoute } from "astro";
import {
  isMachineSalesDevWriteAllowed,
  persistMachineSalesImage,
} from "../../../lib/machines/machineSalesPersist";

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
      error: "Machines for Sale images can only be uploaded from DEV, not from production.",
    },
    403,
  );
}

export const POST: APIRoute = async ({ request }) => {
  const hostname = new URL(request.url).hostname;
  if (!isMachineSalesDevWriteAllowed(hostname, adminEnv)) {
    return productionBlockedResponse();
  }

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return jsonResponse({ ok: false, error: "Content-Type must be application/json" }, 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }

  if (!body || typeof body !== "object") {
    return jsonResponse({ ok: false, error: "Request body must be a JSON object." }, 400);
  }

  const payload = body as Record<string, unknown>;
  const filename = typeof payload.filename === "string" ? payload.filename : "";
  const mimeType = typeof payload.mimeType === "string" ? payload.mimeType : "";
  const dataBase64 = typeof payload.dataBase64 === "string" ? payload.dataBase64 : "";
  if (!filename || !mimeType || !dataBase64) {
    return jsonResponse(
      { ok: false, error: "filename, mimeType, and dataBase64 are required." },
      400,
    );
  }

  try {
    const saved = await persistMachineSalesImage(
      { filename, mimeType, dataBase64 },
      { hostname, env: adminEnv },
    );
    return jsonResponse({
      ok: true,
      filename: saved.filename,
      imageSrc: saved.imageSrc,
      persistedVia: saved.persistedVia,
      branch: saved.branch ?? null,
      commitSha: saved.commitSha ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not save the image.";
    if (/only be saved from DEV|production/i.test(message)) {
      return jsonResponse({ ok: false, error: message }, 403);
    }
    const status = /GITHUB_|GitHub/i.test(message) ? 500 : 400;
    return jsonResponse({ ok: false, error: message }, status);
  }
};

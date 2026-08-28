import type { APIRoute } from "astro";
import { writeMachineSalesImage } from "../../../lib/machines/machineSalesImageUpload";

export const prerender = false;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const POST: APIRoute = async ({ request }) => {
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
      400
    );
  }

  try {
    const saved = writeMachineSalesImage({ filename, mimeType, dataBase64 });
    return jsonResponse({ ok: true, ...saved });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not save the image.";
    return jsonResponse({ ok: false, error: message }, 400);
  }
};

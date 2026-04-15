import type { APIRoute } from "astro";
import {
  parsePatternHelpData,
  readPatternHelpFile,
  writePatternHelpFile,
  type PatternHelpData,
} from "../../../lib/patternHelpAdminFile";

export const prerender = false;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const GET: APIRoute = async () => {
  try {
    const data = readPatternHelpFile();
    return jsonResponse({ ok: true, data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read pattern-help.json";
    return jsonResponse({ ok: false, error: message }, 500);
  }
};

export const PUT: APIRoute = async ({ request }) => {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return jsonResponse({ ok: false, error: "Content-Type must be application/json" }, 400);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const rawData = body.data;
  let data: PatternHelpData;
  try {
    data = parsePatternHelpData(rawData);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid pattern help data";
    return jsonResponse({ ok: false, error: message }, 400);
  }

  for (const [id, entry] of Object.entries(data)) {
    if (id.trim() === "") {
      return jsonResponse({ ok: false, error: "Help ID cannot be blank." }, 400);
    }
    if (typeof entry.title !== "string") {
      return jsonResponse({ ok: false, error: `Entry "${id}": title must be a string.` }, 400);
    }
    if (!Array.isArray(entry.text)) {
      return jsonResponse({ ok: false, error: `Entry "${id}": text must be an array.` }, 400);
    }
  }

  try {
    writePatternHelpFile(data);
  } catch (e) {
    /*
     * MANUAL SETUP / DEPLOY NOTE:
     * On many serverless hosts (e.g. Netlify Functions) the filesystem is read-only except /tmp,
     * so PUT may fail in production. Use the admin page "Download JSON" and replace
     * src/data/pattern-help.json in your repo, then deploy.
     */
    const message = e instanceof Error ? e.message : "Could not write pattern-help.json";
    return jsonResponse({ ok: false, error: message, hint: "download" }, 500);
  }

  return jsonResponse({ ok: true, data });
};

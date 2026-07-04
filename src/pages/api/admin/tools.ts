import type { APIRoute } from "astro";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeToolForSave, type ToolRecord } from "../../../lib/tools/toolAdminFields";

export const prerender = false;

// Canonical tool catalog used by the public Tools index, the individual tool
// pages, and the embedded-tool registry. Lives at the repo root, not under src/.
const TOOLS_JSON_PATH = join(process.cwd(), "data", "tools.json");

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function readToolsArray(): ToolRecord[] {
  const raw = readFileSync(TOOLS_JSON_PATH, "utf-8");
  const data = JSON.parse(raw) as unknown;
  if (!Array.isArray(data)) {
    throw new Error("tools.json must contain a JSON array.");
  }
  return data as ToolRecord[];
}

export const GET: APIRoute = async () => {
  try {
    const tools = readToolsArray();
    return jsonResponse({ ok: true, tools });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read tools.json";
    return jsonResponse({ ok: false, error: message }, 500);
  }
};

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

  if (!Array.isArray(body)) {
    return jsonResponse(
      { ok: false, error: "Request body must be a JSON array of tools." },
      400,
    );
  }

  const tools: ToolRecord[] = [];
  for (let i = 0; i < body.length; i++) {
    const entry = body[i];
    if (!entry || typeof entry !== "object") {
      return jsonResponse({ ok: false, error: `Tool #${i + 1} is not an object.` }, 400);
    }
    const normalized = normalizeToolForSave(entry);
    if (!normalized.title) {
      return jsonResponse({ ok: false, error: `Tool #${i + 1} is missing a title.` }, 400);
    }
    tools.push(normalized);
  }

  try {
    writeFileSync(TOOLS_JSON_PATH, JSON.stringify(tools, null, 2) + "\n", "utf-8");
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not write tools.json";
    return jsonResponse({ ok: false, error: message }, 500);
  }

  return jsonResponse({ ok: true, tools });
};

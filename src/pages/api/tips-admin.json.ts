import type { APIRoute } from "astro";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const prerender = false;

const TIPS_CONTENT_PATH = join(process.cwd(), "src", "data", "tips-content.json");

function loadTipsArray(): Record<string, unknown>[] {
  const raw = readFileSync(TIPS_CONTENT_PATH, "utf-8");
  const data = JSON.parse(raw) as unknown;
  if (!Array.isArray(data)) {
    throw new Error("tips-content.json must contain a JSON array.");
  }
  return data.filter((row): row is Record<string, unknown> => row !== null && typeof row === "object");
}

function parseContentId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 1) return Math.floor(value);
  if (typeof value === "string" && value.trim()) {
    const n = parseInt(value.trim(), 10);
    if (Number.isFinite(n) && n >= 1) return n;
  }
  return null;
}

function getRowContentId(row: Record<string, unknown>): number | null {
  return parseContentId(row.content_id);
}

/**
 * POST: save one tip. Body = full tip object (+ optional _adminReplaceContentId when renaming content_id).
 * Upserts by record.content_id after optionally removing the row with replace id.
 */
export const POST: APIRoute = async ({ request }) => {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return new Response(JSON.stringify({ success: false, error: "Content-Type must be application/json" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const replaceRaw = body._adminReplaceContentId;
  let replaceContentId: number | null = null;
  if (typeof replaceRaw === "number" && Number.isFinite(replaceRaw)) {
    replaceContentId = Math.floor(replaceRaw);
  } else if (typeof replaceRaw === "string" && replaceRaw.trim()) {
    const n = parseInt(replaceRaw.trim(), 10);
    if (Number.isFinite(n)) replaceContentId = n;
  }

  const { _adminReplaceContentId: _, ...rest } = body;
  const saved: Record<string, unknown> = { ...rest };
  const contentId = parseContentId(saved.content_id);

  if (contentId === null) {
    return new Response(
      JSON.stringify({ success: false, error: "content_id is required and must be a positive number." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  saved.content_id = contentId;

  let tips: Record<string, unknown>[];
  try {
    tips = loadTipsArray();
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read tips-content.json";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (replaceContentId !== null && replaceContentId !== contentId) {
    tips = tips.filter((row) => getRowContentId(row) !== replaceContentId);
  }

  const idx = tips.findIndex((row) => getRowContentId(row) === contentId);
  if (idx === -1) {
    tips = [...tips, saved];
  } else {
    tips = tips.map((row, i) => (i === idx ? saved : row));
  }

  try {
    writeFileSync(TIPS_CONTENT_PATH, JSON.stringify(tips, null, 2), "utf-8");
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not write tips-content.json";
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      saved,
      tips,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};

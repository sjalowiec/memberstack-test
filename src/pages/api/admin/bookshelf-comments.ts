import type { APIRoute } from "astro";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const prerender = false;

const COMMENTS_JSON_PATH = join(process.cwd(), "src", "data", "bookshelf-comments.json");

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

type RawComment = Record<string, unknown>;
type CommentsMap = Record<string, RawComment[]>;

function readCommentsMap(): CommentsMap {
  const raw = readFileSync(COMMENTS_JSON_PATH, "utf-8");
  const data = JSON.parse(raw) as unknown;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("bookshelf-comments.json must contain a JSON object keyed by book id.");
  }
  return data as CommentsMap;
}

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (v === null || v === undefined) return "";
  return String(v);
}

/** Comment id is a legacy numeric commentID, or null when unknown/new. */
function normalizeCommentId(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseInt(asString(v).trim(), 10);
  return Number.isFinite(n) ? n : null;
}

type NormalizeResult =
  | { ok: true; map: CommentsMap }
  | { ok: false; error: string };

function normalizeCommentsForSave(raw: unknown): NormalizeResult {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Request body must be an object keyed by book id." };
  }

  const input = raw as Record<string, unknown>;
  const out: CommentsMap = {};

  for (const bookId of Object.keys(input)) {
    const key = bookId.trim();
    if (!key) continue;

    const list = input[bookId];
    if (!Array.isArray(list)) {
      return { ok: false, error: `Comments for book "${key}" must be an array.` };
    }

    const notes: RawComment[] = [];
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        return { ok: false, error: `Comment ${i + 1} for book "${key}" is not an object.` };
      }
      const rec = item as RawComment;
      const message = asString(rec.message).trim();
      // Empty notes are dropped rather than saved.
      if (!message) continue;
      const date = asString(rec.date).trim();
      notes.push({
        id: normalizeCommentId(rec.id),
        date,
        message,
      });
    }

    // Only keep books that still have at least one note.
    if (notes.length > 0) out[key] = notes;
  }

  return { ok: true, map: out };
}

export const GET: APIRoute = async () => {
  try {
    const data = readCommentsMap();
    return jsonResponse({ ok: true, comments: data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read bookshelf-comments.json";
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

  const n = normalizeCommentsForSave(body);
  if (!n.ok) return jsonResponse({ ok: false, error: n.error }, 400);

  try {
    writeFileSync(COMMENTS_JSON_PATH, JSON.stringify(n.map, null, 2) + "\n", "utf-8");
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not write bookshelf-comments.json";
    return jsonResponse({ ok: false, error: message }, 500);
  }

  return jsonResponse({ ok: true, comments: n.map });
};

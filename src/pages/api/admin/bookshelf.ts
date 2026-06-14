import type { APIRoute } from "astro";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeBookForSave } from "../../../lib/bookshelfFields";

export const prerender = false;

const BOOKSHELF_JSON_PATH = join(process.cwd(), "src", "data", "bookshelf.json");

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function readBooksArray(): unknown[] {
  const raw = readFileSync(BOOKSHELF_JSON_PATH, "utf-8");
  const data = JSON.parse(raw) as unknown;
  if (!Array.isArray(data)) {
    throw new Error("bookshelf.json must contain a JSON array.");
  }
  return data;
}

export const GET: APIRoute = async () => {
  try {
    const data = readBooksArray();
    return jsonResponse({ ok: true, books: data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read bookshelf.json";
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
    return jsonResponse({ ok: false, error: "Request body must be a JSON array of books." }, 400);
  }

  const seen = new Set<string>();
  const books: Record<string, unknown>[] = [];

  for (let i = 0; i < body.length; i++) {
    const n = normalizeBookForSave(body[i], i);
    if (!n.ok) return jsonResponse({ ok: false, error: n.error }, 400);
    const id = String(n.book.id);
    if (seen.has(id)) {
      return jsonResponse(
        { ok: false, error: `Duplicate book id "${id}". Each book id must be unique.` },
        400
      );
    }
    seen.add(id);
    books.push(n.book);
  }

  try {
    writeFileSync(BOOKSHELF_JSON_PATH, JSON.stringify(books, null, 2) + "\n", "utf-8");
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not write bookshelf.json";
    return jsonResponse({ ok: false, error: message }, 500);
  }

  return jsonResponse({ ok: true, books });
};

import type { APIRoute } from "astro";
import fs from "fs";
import path from "path";

export const prerender = false;

const filePath = path.resolve(process.cwd(), "src/data/glossary.json");

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const GET: APIRoute = async () => {
  try {
    const data = fs.readFileSync(filePath, "utf-8");
    return new Response(data, {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not read glossary.json";
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
    return jsonResponse({ ok: false, error: "Body must be a JSON array of glossary entries" }, 400);
  }

  try {
    fs.writeFileSync(filePath, JSON.stringify(body, null, 2), "utf-8");
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not write glossary.json";
    return jsonResponse({ ok: false, error: message }, 500);
  }

  return jsonResponse({ ok: true, success: true });
};

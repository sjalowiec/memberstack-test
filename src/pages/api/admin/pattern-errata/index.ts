import type { APIRoute } from "astro";
import { adminAuthErrorBody, requireAdminForRequest } from "../../../../lib/admin/requireAdminRequest";
import { parsePatternErrataWriteInput } from "../../../../lib/patterns/errata/patternErrataDocument";
import {
  insertPatternErrata,
  listPatternErrataForAdmin,
} from "../../../../lib/patterns/errata/patternErrataStore";

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function actorLabel(member: { id: string; email: string | null }): string {
  return member.email?.trim() || member.id;
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code?: unknown }).code) : "";
  const message = error instanceof Error ? error.message : "";
  return code === "23505" || /duplicate key|unique/i.test(message);
}

export const GET: APIRoute = async ({ request, cookies }) => {
  const auth = await requireAdminForRequest(request, cookies);
  if (!auth.ok) return json(adminAuthErrorBody(auth), auth.status);

  try {
    const errata = await listPatternErrataForAdmin();
    return json({ ok: true, errata });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read pattern errata.";
    return json({ ok: false, error: message }, 500);
  }
};

export const POST: APIRoute = async ({ request, cookies }) => {
  const auth = await requireAdminForRequest(request, cookies);
  if (!auth.ok) return json(adminAuthErrorBody(auth), auth.status);

  if (!request.headers.get("content-type")?.includes("application/json")) {
    return json({ ok: false, error: "Content-Type must be application/json" }, 400);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body." }, 400);
  }

  const parsed = parsePatternErrataWriteInput(body);
  if (!parsed.ok) return json({ ok: false, error: parsed.error }, 400);

  try {
    const saved = await insertPatternErrata(parsed.value, actorLabel(auth.member));
    return json({ ok: true, errata: saved }, 201);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return json({ ok: false, error: "That slug is already in use." }, 400);
    }
    const message = error instanceof Error ? error.message : "Could not save the correction.";
    return json({ ok: false, error: message }, 500);
  }
};

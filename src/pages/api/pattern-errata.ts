import type { APIRoute } from "astro";
import { publishedPatternErrata } from "../../lib/patterns/errata/errataVisibility";
import { listPublishedPatternErrata } from "../../lib/patterns/errata/patternErrataStore";
import type { PatternErrataRecord } from "../../lib/patterns/errata/types";

export const prerender = false;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

/** Fields a knitter needs. Drafts are never included. */
export function toPublicPatternErrata(row: PatternErrataRecord) {
  return {
    id: row.id,
    slug: row.slug,
    status: "published" as const,
    title: row.title,
    whatChanged: row.whatChanged,
    knitterAction: row.knitterAction,
    publishedOn: row.publishedOn,
    affectedBuilders: row.affectedBuilders,
    affectedSizes: row.affectedSizes,
    matchRules: row.matchRules,
  };
}

export const GET: APIRoute = async () => {
  try {
    const rows = publishedPatternErrata(await listPublishedPatternErrata());
    return json({ ok: true, errata: rows.map(toPublicPatternErrata) });
  } catch {
    return json({ ok: false, error: "Could not read pattern errata." }, 500);
  }
};

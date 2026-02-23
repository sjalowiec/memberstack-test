import type { APIRoute } from "astro";
import data from "../../../../data/jumplinks-by-content.json";

type JumpLink = { t: number; label: string; code?: string };
type Row = { content_id: number; vimeo_id?: number; jumplinks?: JumpLink[] };

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const contentIdRaw = params.content_id;

  if (!contentIdRaw) {
    return new Response(
      JSON.stringify({ error: "content_id is required" }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  const contentId = Number(contentIdRaw);

  if (Number.isNaN(contentId)) {
    return new Response(
      JSON.stringify({ error: "content_id must be numeric" }),
      { status: 400, headers: { "content-type": "application/json" } }
    );
  }

  const rows = (data as Row[]) ?? [];
  const row = rows.find((r) => Number(r?.content_id) === contentId);
  const jumplinks = Array.isArray(row?.jumplinks) ? row!.jumplinks! : [];

  return new Response(JSON.stringify({ jumplinks }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

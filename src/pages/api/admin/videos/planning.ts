import type { APIRoute } from "astro";
import { adminAuthErrorBody, requireAdminForRequest } from "../../../../lib/admin/requireAdminRequest";
import { listAllTipOfTheWeek } from "../../../../lib/tipOfTheWeek/store";
import { tipLosAngelesCalendarDate } from "../../../../lib/tipOfTheWeek/schedule";
import { loadMergedVideoCatalog } from "../../../../lib/videos/videoCatalogStore";
import { loadVideoFavoriteCounts } from "../../../../lib/videos/videoFavoriteCounts";
import {
  summarizeCatalogTipHistory,
  type VideoAdminPlanningPayload,
  type VideoAdminTipsSource,
} from "../../../../lib/videos/videoAdminPlanning";

export const prerender = false;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function publicTipError(error: unknown): string {
  const fallback = "Tip of the Week records could not be loaded, so history is not shown.";
  const message = error instanceof Error ? error.message.trim() : "";
  if (!message || message.length > 180) return fallback;
  if (/postgres|password|secret|token|postgres:\/\//i.test(message)) return fallback;
  return `${fallback} ${message}`;
}

export const GET: APIRoute = async ({ request, cookies }) => {
  const auth = await requireAdminForRequest(request, cookies);
  if (!auth.ok) return jsonResponse(adminAuthErrorBody(auth), auth.status);

  let catalog: unknown[];
  try {
    catalog = await loadMergedVideoCatalog();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not read the video catalog";
    return jsonResponse({ ok: false, error: message }, 500);
  }

  const contentIds = catalog.map((row) =>
    row && typeof row === "object" ? (row as { content_id?: unknown }).content_id : undefined,
  );

  const [favorites, tips] = await Promise.all([
    loadVideoFavoriteCounts(contentIds),
    loadTipHistory(contentIds),
  ]);

  const body: VideoAdminPlanningPayload = { ok: true, favorites, tips };
  return jsonResponse(body);
};

async function loadTipHistory(contentIds: readonly unknown[]): Promise<VideoAdminTipsSource> {
  try {
    const tips = await listAllTipOfTheWeek();
    const todayLa = tipLosAngelesCalendarDate();
    const summary = summarizeCatalogTipHistory(contentIds, tips, todayLa);
    return { ok: true, byVideo: summary.byVideo, unmatchedIds: summary.unmatchedIds };
  } catch (error) {
    return { ok: false, error: publicTipError(error) };
  }
}

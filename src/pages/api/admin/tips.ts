import type { APIRoute } from "astro";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import videosData from "../../../data/videos-public.json";

export const prerender = false;

interface TipScheduleItem {
  content_id: number;
  startDate: string;
  endDate?: string;
  emailDone?: boolean;
}

interface VideoItem {
  content_id: number;
  title?: string;
}

function getTipsPath(): string {
  return join(process.cwd(), "src", "data", "tips.json");
}

function loadTips(): TipScheduleItem[] {
  const path = getTipsPath();
  const raw = readFileSync(path, "utf-8");
  const data = JSON.parse(raw) as unknown;
  return Array.isArray(data) ? data : [];
}

function saveTips(tips: TipScheduleItem[]): void {
  const path = getTipsPath();
  const sorted = [...tips].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );
  writeFileSync(path, JSON.stringify(sorted, null, 2), "utf-8");
}

function contentIdExistsInVideos(contentId: number): boolean {
  const videos = (videosData as VideoItem[]) ?? [];
  return videos.some(
    (v) => v && typeof v.content_id === "number" && v.content_id === contentId
  );
}

export const POST: APIRoute = async ({ request }) => {
  if (request.headers.get("content-type")?.includes("application/json") === false) {
    return new Response(
      JSON.stringify({ error: "Content-Type must be application/json" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: { content_id?: number; startDate?: string; endDate?: string | null; emailDone?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const contentId =
    typeof body.content_id === "number"
      ? body.content_id
      : typeof body.content_id === "string"
        ? parseInt(body.content_id, 10)
        : NaN;
  const startDate =
    typeof body.startDate === "string" ? body.startDate.trim() : "";

  if (Number.isNaN(contentId) || contentId < 0) {
    return new Response(
      JSON.stringify({ error: "Content ID is required and must be a valid number." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!startDate) {
    return new Response(
      JSON.stringify({ error: "Start date is required." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!contentIdExistsInVideos(contentId)) {
    return new Response(
      JSON.stringify({
        error: "This content ID does not exist in the videos catalog. Please use a valid video content ID.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  let tips: TipScheduleItem[];
  try {
    tips = loadTips();
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Could not read tips file." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const normalizedStart = new Date(startDate).toISOString().slice(0, 10);
  const endDateRaw =
    typeof body.endDate === "string" ? body.endDate.trim() : "";
  let normalizedEnd = "";
  if (endDateRaw) {
    normalizedEnd = new Date(endDateRaw).toISOString().slice(0, 10);
    if (normalizedEnd < normalizedStart) {
      return new Response(
        JSON.stringify({
          error: "End date must not be earlier than start date.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  const hasDuplicate = tips.some(
    (t) => new Date(t.startDate).toISOString().slice(0, 10) === normalizedStart
  );
  if (hasDuplicate) {
    return new Response(
      JSON.stringify({
        error: "A tip is already scheduled for this start date. Please choose another date.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const newTip: TipScheduleItem = {
    content_id: contentId,
    startDate: normalizedStart,
    emailDone: body.emailDone === true,
  };
  if (normalizedEnd) newTip.endDate = normalizedEnd;
  tips.push(newTip);

  try {
    saveTips(tips);
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Could not save tips file." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

function normalizeDate(isoDate: string): string {
  return new Date(isoDate).toISOString().slice(0, 10);
}

export const PUT: APIRoute = async ({ request }) => {
  if (request.headers.get("content-type")?.includes("application/json") === false) {
    return new Response(
      JSON.stringify({ error: "Content-Type must be application/json" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: {
    originalContentId?: number;
    originalStartDate?: string;
    content_id?: number;
    startDate?: string;
    endDate?: string | null;
    emailDone?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const originalContentId =
    typeof body.originalContentId === "number"
      ? body.originalContentId
      : typeof body.originalContentId === "string"
        ? parseInt(body.originalContentId, 10)
        : NaN;
  const originalStartDate =
    typeof body.originalStartDate === "string" ? body.originalStartDate.trim() : "";
  const contentId =
    typeof body.content_id === "number"
      ? body.content_id
      : typeof body.content_id === "string"
        ? parseInt(body.content_id, 10)
        : NaN;
  const startDate =
    typeof body.startDate === "string" ? body.startDate.trim() : "";
  const endDateRaw =
    typeof body.endDate === "string" ? body.endDate.trim() : "";

  if (
    Number.isNaN(originalContentId) ||
    originalContentId < 0 ||
    !originalStartDate
  ) {
    return new Response(
      JSON.stringify({ error: "Original record identifier is missing or invalid." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (Number.isNaN(contentId) || contentId < 0) {
    return new Response(
      JSON.stringify({ error: "Content ID is required and must be a valid number." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!startDate) {
    return new Response(
      JSON.stringify({ error: "Start date is required." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!contentIdExistsInVideos(contentId)) {
    return new Response(
      JSON.stringify({
        error: "This content ID does not exist in the videos catalog. Please use a valid video content ID.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  let tips: TipScheduleItem[];
  try {
    tips = loadTips();
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Could not read tips file." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const originalNorm = normalizeDate(originalStartDate);
  const normalizedDate = normalizeDate(startDate);
  const index = tips.findIndex(
    (t) =>
      t.content_id === originalContentId && normalizeDate(t.startDate) === originalNorm
  );
  if (index === -1) {
    return new Response(
      JSON.stringify({ error: "The tip being edited was not found." }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  const hasDuplicate = tips.some(
    (t, i) =>
      i !== index && normalizeDate(t.startDate) === normalizedDate
  );
  if (hasDuplicate) {
    return new Response(
      JSON.stringify({
        error: "A tip is already scheduled for this start date. Please choose another date.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const normalizedEnd = endDateRaw
    ? new Date(endDateRaw).toISOString().slice(0, 10)
    : "";
  if (normalizedEnd && normalizedEnd < normalizedDate) {
    return new Response(
      JSON.stringify({
        error: "End date must not be earlier than start date.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const updated: TipScheduleItem = { content_id: contentId, startDate: normalizedDate, emailDone: body.emailDone === true };
  if (normalizedEnd) updated.endDate = normalizedEnd;
  tips[index] = updated;

  try {
    saveTips(tips);
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Could not save tips file." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const PATCH: APIRoute = async ({ request }) => {
  if (request.headers.get("content-type")?.includes("application/json") === false) {
    return new Response(
      JSON.stringify({ error: "Content-Type must be application/json" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: { originalContentId?: number; originalStartDate?: string; emailDone?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const originalContentId =
    typeof body.originalContentId === "number"
      ? body.originalContentId
      : typeof body.originalContentId === "string"
        ? parseInt(body.originalContentId, 10)
        : NaN;
  const originalStartDate =
    typeof body.originalStartDate === "string" ? body.originalStartDate.trim() : "";
  const emailDone = body.emailDone === true;

  if (Number.isNaN(originalContentId) || originalContentId < 0 || !originalStartDate) {
    return new Response(
      JSON.stringify({ error: "Original record identifier is missing or invalid." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  let tips: TipScheduleItem[];
  try {
    tips = loadTips();
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Could not read tips file." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const originalNorm = normalizeDate(originalStartDate);
  const index = tips.findIndex(
    (t) =>
      t.content_id === originalContentId && normalizeDate(t.startDate) === originalNorm
  );
  if (index === -1) {
    return new Response(
      JSON.stringify({ error: "The tip was not found." }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  tips[index] = { ...tips[index], emailDone };

  try {
    saveTips(tips);
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Could not save tips file." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

export const DELETE: APIRoute = async ({ request }) => {
  if (request.headers.get("content-type")?.includes("application/json") === false) {
    return new Response(
      JSON.stringify({ error: "Content-Type must be application/json" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: { content_id?: number; startDate?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const contentId =
    typeof body.content_id === "number"
      ? body.content_id
      : typeof body.content_id === "string"
        ? parseInt(body.content_id, 10)
        : NaN;
  const startDate =
    typeof body.startDate === "string" ? body.startDate.trim() : "";

  if (Number.isNaN(contentId) || contentId < 0 || !startDate) {
    return new Response(
      JSON.stringify({ error: "Content ID and start date are required to identify the tip." }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  let tips: TipScheduleItem[];
  try {
    tips = loadTips();
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Could not read tips file." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const normalizedStart = normalizeDate(startDate);
  const index = tips.findIndex(
    (t) =>
      t.content_id === contentId && normalizeDate(t.startDate) === normalizedStart
  );
  if (index === -1) {
    return new Response(
      JSON.stringify({ error: "The tip was not found." }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  tips.splice(index, 1);

  try {
    saveTips(tips);
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Could not save tips file." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

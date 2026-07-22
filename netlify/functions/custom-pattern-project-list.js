/**
 * GET /.netlify/functions/custom-pattern-project-list?family=sleeveless
 *
 * Auth: Bearer JWT + active membership. Lists only the verified member's projects.
 */
import {
  getProjectsStore,
  jsonResponse,
  listProjectSummaries,
  withCors,
} from "./lib/custom-pattern-projects-store.js";
import { requirePatternProjectAccess } from "./lib/require-member-access.js";

export default async (req) => {
  if (req.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }
  if (req.method !== "GET") {
    return withCors(jsonResponse({ ok: false, error: "Method not allowed" }, 405));
  }

  const access = await requirePatternProjectAccess(req);
  if (!access.ok) {
    return withCors(jsonResponse({ ok: false, error: access.error }, access.status));
  }

  const url = new URL(req.url);
  const family = url.searchParams.get("family")?.trim() || "sleeveless";

  try {
    const store = getProjectsStore();
    const projects = await listProjectSummaries(store, family, access.userId);
    return withCors(
      jsonResponse({
        ok: true,
        projects,
        authMode: access.mode,
      }),
    );
  } catch (err) {
    console.error("custom-pattern-project-list failed:", err);
    return withCors(jsonResponse({ ok: false, error: "Failed to list projects." }, 500));
  }
};

/**
 * GET /.netlify/functions/custom-pattern-project-list?family=sleeveless
 */
import {
  getProjectsStore,
  jsonResponse,
  listProjectSummaries,
  resolveProjectUserId,
  withCors,
} from "./lib/custom-pattern-projects-store.js";

export default async (req) => {
  if (req.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }
  if (req.method !== "GET") {
    return withCors(jsonResponse({ ok: false, error: "Method not allowed" }, 405));
  }

  const user = resolveProjectUserId(req);
  if ("error" in user) {
    return withCors(jsonResponse({ ok: false, error: user.error }, user.status));
  }

  const url = new URL(req.url);
  const family = url.searchParams.get("family")?.trim() || "sleeveless";

  try {
    const store = getProjectsStore();
    const projects = await listProjectSummaries(store, family, user.userId);
    return withCors(
      jsonResponse({
        ok: true,
        projects,
        authMode: user.mode,
      }),
    );
  } catch (err) {
    console.error("custom-pattern-project-list failed:", err);
    return withCors(jsonResponse({ ok: false, error: "Failed to list projects." }, 500));
  }
};

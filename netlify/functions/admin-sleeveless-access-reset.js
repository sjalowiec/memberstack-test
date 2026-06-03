/**
 * Admin-only support tool: look up a Memberstack member by email and reset that member's one-time
 * free Sleeveless Pattern build claim — WITHOUT logging in as that member.
 *
 * - GET  ?email=...                  → lookup; returns safe support fields only (never the full JSON).
 * - POST { action: "lookup", email } → same lookup over POST.
 * - POST { action: "reset", memberId? , email? } → fetch JSON, clear the two free-claim keys, save.
 *
 * Security:
 * - Admin-only via the SAME allowlist as the pattern activity dashboard (`isActivityAdmin`).
 *   Non-admins get 403; unauthenticated get 401. Fails closed.
 * - Memberstack writes happen server-side with the SECRET key (`MEMBERSTACK_SECRET_KEY`); the key is
 *   never exposed to the client.
 * - Only the two Sleeveless free-claim keys are touched; all other member JSON keys are preserved.
 *   No arbitrary JSON editing, and the full member JSON blob is never returned.
 */
import {
  jsonResponse,
  resolveProjectUserId,
  withCors,
} from "./lib/custom-pattern-projects-store.js";
import { isActivityAdmin } from "./lib/pattern-activity-store.js";
import {
  describeSecretKeyEnvironment,
  getMemberstackAdminClient,
  isLookupDebugEnabled,
  maskEmailForLog,
} from "./lib/memberstack-admin.js";
import {
  extractMemberSupportData,
  mergeFreeClaimResetIntoMemberJson,
} from "./lib/sleeveless-free-claim.js";

/** @param {unknown} value */
function trimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export default async (req) => {
  if (req.method === "OPTIONS") {
    return withCors(new Response(null, { status: 204 }));
  }
  if (req.method !== "GET" && req.method !== "POST") {
    return withCors(jsonResponse({ ok: false, error: "Method not allowed" }, 405));
  }

  // Must be signed in (mirrors pattern-activity-log) …
  const user = resolveProjectUserId(req);
  if ("error" in user) {
    return withCors(jsonResponse({ ok: false, error: user.error }, user.status));
  }
  // … and an admin. Same allowlist as the activity dashboard. Fail closed.
  if (!isActivityAdmin(req)) {
    return withCors(jsonResponse({ ok: false, error: "Admin access required." }, 403));
  }

  // Resolve action + inputs (query string for GET, JSON body for POST).
  let action = "lookup";
  let email = "";
  let memberId = "";
  if (req.method === "GET") {
    email = trimmedString(new URL(req.url).searchParams.get("email"));
  } else {
    let body;
    try {
      body = await req.json();
    } catch {
      return withCors(jsonResponse({ ok: false, error: "Invalid JSON body." }, 400));
    }
    const rec = body && typeof body === "object" && !Array.isArray(body) ? body : {};
    action = rec.action === "reset" ? "reset" : "lookup";
    email = trimmedString(rec.email);
    memberId = trimmedString(rec.memberId);
  }

  // Prefer the resolved memberId for reset; fall back to email for lookup.
  const lookupKey = memberId || email;
  if (!lookupKey) {
    return withCors(
      jsonResponse({ ok: false, error: "A member email is required." }, 400),
    );
  }

  const client = getMemberstackAdminClient();
  if (!client) {
    console.error(
      "admin-sleeveless-access-reset: MEMBERSTACK_SECRET_KEY is not configured.",
    );
    return withCors(
      jsonResponse({ ok: false, error: "Member lookup is not configured." }, 500),
    );
  }

  // TEMPORARY DEBUG (gated by DEBUG_SLEEVELESS_LOOKUP=true): trace exactly why a lookup misses.
  // This does NOT change lookup behavior — it only logs to the Netlify function log.
  const debug = isLookupDebugEnabled();
  if (debug) {
    const env = describeSecretKeyEnvironment();
    const keyLabel = lookupKey.startsWith("mem_") ? lookupKey : maskEmailForLog(lookupKey);
    console.log(
      `[admin-sleeveless-access-reset][DEBUG] action=${action} lookupKey=${keyLabel} ` +
        `msEnv=${env.mode} key=${env.keyHint}`,
    );
  }

  try {
    const member = await client.getMember(lookupKey);

    if (debug) {
      console.log(
        `[admin-sleeveless-access-reset][DEBUG] getMember result: ${
          member ? `FOUND id=${member.id} email=${maskEmailForLog(member?.auth?.email)}` : "NOT FOUND (data:null)"
        }`,
      );
      // Probe the list endpoint to answer "does this email exist in THIS app/env at all?"
      try {
        if (typeof client.listMembers === "function") {
          const list = await client.listMembers({ limit: 100 });
          const rows = Array.isArray(list?.data) ? list.data : [];
          const target = lookupKey.toLowerCase();
          const match = rows.find(
            (m) => String(m?.auth?.email || "").toLowerCase() === target,
          );
          console.log(
            `[admin-sleeveless-access-reset][DEBUG] list totalCount=${list?.totalCount ?? "?"} ` +
              `pageSize=${rows.length} hasNextPage=${list?.hasNextPage ?? "?"} targetInFirstPage=${Boolean(match)}`,
          );
          console.log(
            `[admin-sleeveless-access-reset][DEBUG] first emails: ${rows
              .slice(0, 5)
              .map((m) => maskEmailForLog(m?.auth?.email))
              .join(", ")}`,
          );
        }
      } catch (probeErr) {
        console.log(
          `[admin-sleeveless-access-reset][DEBUG] list probe failed: ${
            probeErr instanceof Error ? probeErr.message : String(probeErr)
          }`,
        );
      }
    }

    if (!member) {
      return withCors(jsonResponse({ ok: false, error: "Member not found." }, 404));
    }

    if (action === "lookup") {
      return withCors(jsonResponse({ ok: true, member: extractMemberSupportData(member) }));
    }

    // action === "reset"
    const resolvedId = trimmedString(member.id) || memberId;
    if (!resolvedId) {
      return withCors(jsonResponse({ ok: false, error: "Member not found." }, 404));
    }

    // Fetch + merge + replace: preserve every unrelated JSON key, clear only the two claim keys.
    const mergedJson = mergeFreeClaimResetIntoMemberJson(member.json);
    const updated = await client.updateMemberJson(resolvedId, mergedJson);

    // Recompute support data from the saved state. Keep identity from the fetched member; use the
    // updated JSON when Memberstack echoes it, else the merged JSON we just wrote.
    const updatedJson =
      updated && typeof updated === "object" && updated.json !== undefined
        ? updated.json
        : mergedJson;
    const memberAfter = { ...member, json: updatedJson };

    return withCors(
      jsonResponse({ ok: true, reset: true, member: extractMemberSupportData(memberAfter) }),
    );
  } catch (err) {
    console.error("admin-sleeveless-access-reset failed:", err);
    return withCors(
      jsonResponse({ ok: false, error: "Member lookup or reset failed." }, 500),
    );
  }
};

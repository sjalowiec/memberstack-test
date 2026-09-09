/**
 * Skill Builder reaction log (public, anonymous-friendly).
 *
 * Same upsert pattern as `log-tip-reaction`: Netlify Blobs, one record per
 * skillBuilderId + visitorId so changing a reaction updates rather than
 * duplicates. Stored in a separate blob store with contentType "skill-builder"
 * so totals cannot be mixed with Tip of the Week.
 *
 * Does not send email, create alerts, or notify Sue.
 *
 * - POST: upsert reaction for skillBuilderId + visitorId
 * - GET: list recent reactions for local verification ONLY when
 *        `ALLOW_DEV_PATTERN_USER === "true"` (never in production deploy)
 */
import { getStore } from "@netlify/blobs";

const STORE_NAME = "skill-builder-reactions";
const REACTION_PREFIX = "reactions/";
const CONTENT_TYPE = "skill-builder";

const ALLOWED_REACTIONS = new Set(["did_it", "will_try", "need_help"]);

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function isLocalDev(): boolean {
  return String(process.env.ALLOW_DEV_PATTERN_USER || "").trim() === "true";
}

function cleanString(value: unknown, max = 200): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function sanitizeKeySegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
}

function getReactionStore() {
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

function reactionKey(skillBuilderId: string, visitorId: string): string {
  return `${REACTION_PREFIX}${sanitizeKeySegment(skillBuilderId)}/${sanitizeKeySegment(visitorId)}.json`;
}

function normalizeReaction(
  raw: unknown,
): { ok: true; record: Record<string, unknown> } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Reaction body required." };
  }
  const body = raw as Record<string, unknown>;

  const contentType = cleanString(body.contentType, 40) || CONTENT_TYPE;
  if (contentType !== CONTENT_TYPE) {
    return { ok: false, error: "contentType must be skill-builder." };
  }

  const skillBuilderId = sanitizeKeySegment(
    cleanString(body.skillBuilderId, 80) || cleanString(body.tipId, 80),
  );
  if (!skillBuilderId) return { ok: false, error: "skillBuilderId is required." };

  const reaction = cleanString(body.reaction, 40);
  if (!ALLOWED_REACTIONS.has(reaction)) {
    return { ok: false, error: `Unknown reaction "${reaction}".` };
  }

  let visitorId = sanitizeKeySegment(cleanString(body.visitorId, 80));
  if (!visitorId) visitorId = sanitizeKeySegment(crypto.randomUUID());

  const createdAt = cleanString(body.createdAt, 40) || new Date().toISOString();
  const updatedAt = new Date().toISOString();

  const record: Record<string, unknown> = {
    contentType: CONTENT_TYPE,
    skillBuilderId,
    visitorId,
    reaction,
    createdAt,
    updatedAt,
  };

  const memberId = cleanString(body.memberId, 120);
  if (memberId) record.memberId = memberId;
  const sourcePage = cleanString(body.sourcePage, 300);
  if (sourcePage) record.sourcePage = sourcePage;

  return { ok: true, record };
}

export default async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method === "GET") {
    if (!isLocalDev()) {
      return jsonResponse({ ok: false, error: "Not available." }, 403);
    }
    try {
      const store = getReactionStore();
      const idFilter = sanitizeKeySegment(
        cleanString(new URL(req.url).searchParams.get("skillBuilderId") || "", 80),
      );
      const prefix = idFilter ? `${REACTION_PREFIX}${idFilter}/` : REACTION_PREFIX;
      const { blobs } = await store.list({ prefix });
      const keys = blobs
        .map((b) => b.key)
        .filter((k): k is string => typeof k === "string" && k.endsWith(".json"))
        .sort((a, b) => b.localeCompare(a))
        .slice(0, 500);
      const reactions: unknown[] = [];
      for (const key of keys) {
        const raw = await store.get(key, { type: "text" });
        if (!raw) continue;
        try {
          reactions.push(JSON.parse(raw));
        } catch {
          /* skip */
        }
      }
      return jsonResponse({ ok: true, count: reactions.length, reactions });
    } catch (err) {
      console.error("log-skill-builder-reaction list failed:", err);
      return jsonResponse({ ok: false, error: "Failed to load reactions." }, 500);
    }
  }

  if (req.method === "POST") {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ ok: false, error: "Invalid JSON body." }, 400);
    }

    const normalized = normalizeReaction(body);
    if (!normalized.ok) {
      return jsonResponse({ ok: false, error: normalized.error }, 400);
    }

    try {
      const store = getReactionStore();
      const skillBuilderId = String(normalized.record.skillBuilderId);
      const visitorId = String(normalized.record.visitorId);
      const key = reactionKey(skillBuilderId, visitorId);

      const existingRaw = await store.get(key, { type: "text" });
      if (existingRaw) {
        try {
          const existing = JSON.parse(existingRaw) as { createdAt?: string };
          if (typeof existing.createdAt === "string" && existing.createdAt) {
            normalized.record.createdAt = existing.createdAt;
          }
        } catch {
          /* replace */
        }
      }

      await store.set(key, JSON.stringify(normalized.record), {
        metadata: {
          skillBuilderId,
          contentType: CONTENT_TYPE,
          reaction: String(normalized.record.reaction ?? ""),
          updatedAt: String(normalized.record.updatedAt ?? ""),
        },
      });
      return jsonResponse({ ok: true });
    } catch (err) {
      console.error("log-skill-builder-reaction upsert failed:", err);
      return jsonResponse({ ok: false, error: "Failed to record reaction." }, 500);
    }
  }

  return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
};

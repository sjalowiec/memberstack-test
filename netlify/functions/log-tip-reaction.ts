/**
 * Tip of the Week reaction log (public, anonymous-friendly).
 *
 * Mirrors `log-bookshelf-activity`: Netlify Blobs, best-effort POST, no public
 * totals in production. One blob per tipId + visitorId so changing a reaction
 * upserts instead of appending duplicates.
 *
 * - POST { reaction }: upsert one reaction for tipId + visitorId
 * - POST { topicSuggestion }: upsert one optional topic for tipId + visitorId
 *   on a separate key, so a suggestion cannot duplicate or erase a reaction
 * - GET: list recent reactions and topics for local verification ONLY when
 *        `ALLOW_DEV_PATTERN_USER === "true"` (never in production deploy)
 */
import { getStore } from "@netlify/blobs";

const STORE_NAME = "tip-of-the-week-reactions";
const REACTION_PREFIX = "reactions/";
const TOPIC_PREFIX = "topics/";
const TOPIC_MAX = 500;

const ALLOWED_REACTIONS = new Set([
  "helped",
  "not_for_me",
  "will_try",
  "more_like_this",
]);

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

async function listJson(prefix: string): Promise<unknown[]> {
  const store = getReactionStore();
  const { blobs } = await store.list({ prefix });
  const keys = blobs
    .map((b) => b.key)
    .filter((k): k is string => typeof k === "string" && k.endsWith(".json"))
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 500);
  const records: unknown[] = [];
  for (const key of keys) {
    const raw = await store.get(key, { type: "text" });
    if (!raw) continue;
    try {
      records.push(JSON.parse(raw));
    } catch {
      /* skip */
    }
  }
  return records;
}

function reactionKey(tipId: string, visitorId: string): string {
  return `${REACTION_PREFIX}${sanitizeKeySegment(tipId)}/${sanitizeKeySegment(visitorId)}.json`;
}

function topicKey(tipId: string, visitorId: string): string {
  return `${TOPIC_PREFIX}${sanitizeKeySegment(tipId)}/${sanitizeKeySegment(visitorId)}.json`;
}

function cleanTopic(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .trim()
    .slice(0, TOPIC_MAX);
}

function normalizeReaction(
  raw: unknown,
): { ok: true; record: Record<string, unknown> } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Reaction body required." };
  }
  const body = raw as Record<string, unknown>;

  const tipId = sanitizeKeySegment(cleanString(body.tipId, 80));
  if (!tipId) return { ok: false, error: "tipId is required." };

  const reaction = cleanString(body.reaction, 40);
  if (!ALLOWED_REACTIONS.has(reaction)) {
    return { ok: false, error: `Unknown reaction "${reaction}".` };
  }

  let visitorId = sanitizeKeySegment(cleanString(body.visitorId, 80));
  if (!visitorId) visitorId = sanitizeKeySegment(crypto.randomUUID());

  const createdAt = cleanString(body.createdAt, 40) || new Date().toISOString();
  const updatedAt = new Date().toISOString();

  const record: Record<string, unknown> = {
    tipId,
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

function normalizeTopic(
  raw: Record<string, unknown>,
): { ok: true; record: Record<string, unknown> } | { ok: false; error: string } {
  const tipId = sanitizeKeySegment(cleanString(raw.tipId, 80));
  if (!tipId) return { ok: false, error: "tipId is required." };

  const visitorId = sanitizeKeySegment(cleanString(raw.visitorId, 80));
  if (!visitorId) return { ok: false, error: "visitorId is required." };

  const topicSuggestion = cleanTopic(raw.topicSuggestion);
  if (!topicSuggestion) return { ok: false, error: "Add a topic or leave the field blank." };

  const createdAt = cleanString(raw.createdAt, 40) || new Date().toISOString();
  const record: Record<string, unknown> = {
    tipId,
    visitorId,
    topicSuggestion,
    createdAt,
    updatedAt: new Date().toISOString(),
  };

  const memberId = cleanString(raw.memberId, 120);
  if (memberId) record.memberId = memberId;
  const sourcePage = cleanString(raw.sourcePage, 300);
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
      const tipFilter = sanitizeKeySegment(
        cleanString(new URL(req.url).searchParams.get("tipId") || "", 80),
      );
      const reactionPrefix = tipFilter ? `${REACTION_PREFIX}${tipFilter}/` : REACTION_PREFIX;
      const topicPrefix = tipFilter ? `${TOPIC_PREFIX}${tipFilter}/` : TOPIC_PREFIX;
      const reactions = await listJson(reactionPrefix);
      const topics = await listJson(topicPrefix);
      return jsonResponse({
        ok: true,
        count: reactions.length,
        reactions,
        topicCount: topics.length,
        topics,
      });
    } catch (err) {
      console.error("log-tip-reaction list failed:", err);
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

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse({ ok: false, error: "Reaction body required." }, 400);
    }
    const raw = body as Record<string, unknown>;
    const topicOnly =
      typeof raw.topicSuggestion === "string" &&
      (typeof raw.reaction !== "string" || !cleanString(raw.reaction, 40));

    if (topicOnly) {
      const normalizedTopic = normalizeTopic(raw);
      if (!normalizedTopic.ok) {
        return jsonResponse({ ok: false, error: normalizedTopic.error }, 400);
      }
      try {
        const store = getReactionStore();
        const tipId = String(normalizedTopic.record.tipId);
        const visitorId = String(normalizedTopic.record.visitorId);
        const key = topicKey(tipId, visitorId);
        const existingRaw = await store.get(key, { type: "text" });
        if (existingRaw) {
          try {
            const existing = JSON.parse(existingRaw) as { createdAt?: string };
            if (typeof existing.createdAt === "string" && existing.createdAt) {
              normalizedTopic.record.createdAt = existing.createdAt;
            }
          } catch {
            /* replace */
          }
        }
        await store.set(key, JSON.stringify(normalizedTopic.record), {
          metadata: {
            tipId,
            updatedAt: String(normalizedTopic.record.updatedAt ?? ""),
          },
        });
        return jsonResponse({ ok: true });
      } catch (err) {
        console.error("log-tip-reaction topic upsert failed:", err);
        return jsonResponse({ ok: false, error: "Failed to record topic." }, 500);
      }
    }

    const normalized = normalizeReaction(body);
    if (!normalized.ok) {
      return jsonResponse({ ok: false, error: normalized.error }, 400);
    }

    try {
      const store = getReactionStore();
      const tipId = String(normalized.record.tipId);
      const visitorId = String(normalized.record.visitorId);
      const key = reactionKey(tipId, visitorId);

      // Preserve original createdAt when upserting a changed choice.
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
          tipId,
          reaction: String(normalized.record.reaction ?? ""),
          updatedAt: String(normalized.record.updatedAt ?? ""),
        },
      });
      return jsonResponse({ ok: true });
    } catch (err) {
      console.error("log-tip-reaction upsert failed:", err);
      return jsonResponse({ ok: false, error: "Failed to record reaction." }, 500);
    }
  }

  return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
};

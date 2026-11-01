import { describe, expect, it } from "vitest";

import { listVideoReplies } from "../videoReplies/videoRepliesStore";
import type { WatsonQueryFn } from "./memberSearch";
import {
  connectMemberThankYouVideo,
  markMemberThankYouVideoEmailSent,
} from "./memberThankYouVideo";
import { setThankYouCompleted, setThankYouStatus } from "./memberThankYouStore";

function createMemoryStore() {
  const data = new Map<string, unknown>();
  return {
    data,
    async get(key: string, opts?: { type?: string }) {
      if (!data.has(key)) return null;
      const value = data.get(key);
      if (opts?.type === "json") return value;
      return value;
    },
    async setJSON(key: string, value: unknown) {
      data.set(key, value);
    },
    async list({ prefix }: { prefix?: string } = {}) {
      const blobs = [...data.keys()]
        .filter((key) => !prefix || key.startsWith(prefix))
        .map((key) => ({ key }));
      return { blobs };
    },
  };
}

type Row = {
  stripeChargeId: string;
  videoSentAt: string | null;
  cardSentAt: string | null;
  videoReplyId: string | null;
  completedAt: string | null;
  updatedAt: string;
};

function createStatusDb() {
  const table = new Map<string, Row>();
  const queryFn: WatsonQueryFn = async (sql, params) => {
    const id = String(params?.[0] ?? "");
    const current = () => table.get(id);
    const save = (row: Row) => {
      table.set(id, row);
      return [
        {
          stripe_charge_id: row.stripeChargeId,
          video_sent_at: row.videoSentAt,
          card_sent_at: row.cardSentAt,
          video_reply_id: row.videoReplyId,
          completed_at: row.completedAt,
          updated_at: row.updatedAt,
        },
      ];
    };
    const base = (): Row =>
      current() ?? {
        stripeChargeId: id,
        videoSentAt: null,
        cardSentAt: null,
        videoReplyId: null,
        completedAt: null,
        updatedAt: "2026-11-01T15:00:00.000Z",
      };

    if (sql.includes("COALESCE")) {
      const existing = base();
      const incoming = String(params?.[1] ?? "");
      return save({ ...existing, videoReplyId: existing.videoReplyId ?? incoming });
    }
    if (sql.includes("EXCLUDED.completed_at")) {
      const completedAt = params?.[1] == null ? null : String(params[1]);
      return save({ ...base(), completedAt });
    }
    if (sql.includes("EXCLUDED.video_sent_at")) {
      const videoSentAt = params?.[1] == null ? null : String(params[1]);
      return save({ ...base(), videoSentAt });
    }
    if (sql.includes("EXCLUDED.card_sent_at")) {
      const cardSentAt = params?.[1] == null ? null : String(params[1]);
      return save({ ...base(), cardSentAt });
    }
    if (sql.includes("SELECT")) {
      const existing = current();
      return existing ? save(existing) : [];
    }
    throw new Error(`Unexpected thank-you SQL: ${sql}`);
  };
  return { table, queryFn };
}

const member = {
  memberName: "Ada Lovelace",
  memberEmail: "ada@example.com",
};

describe("membership thank-you videos", () => {
  it("updates the same video connection and does not mark it sent", async () => {
    const store = createMemoryStore();
    const db = createStatusDb();
    const first = await connectMemberThankYouVideo({
      stripeChargeId: "ch_annual1",
      ...member,
      vimeoUrl: "https://vimeo.com/123456789/abc123def",
      now: "2026-11-01T15:00:00.000Z",
      store,
      queryFn: db.queryFn,
    });
    const second = await connectMemberThankYouVideo({
      stripeChargeId: "ch_annual1",
      ...member,
      vimeoUrl: "https://vimeo.com/987654321/def456ghi",
      now: "2026-11-01T16:00:00.000Z",
      store,
      queryFn: db.queryFn,
    });

    expect(second.reply.id).toBe(first.reply.id);
    expect(second.reply.publicToken).toBe(first.reply.publicToken);
    expect(second.reply.sentAt).toBeNull();
    expect(second.reply.presentation).toBe("membership_thank_you");
    expect(second.reply.memberFirstName).toBe("Ada");
    expect(second.reply.privateNotes).toBe("");
    expect(second.reply.originalVimeoUrl).toBe("https://vimeo.com/987654321/def456ghi");
    expect(second.reply.safeVimeoEmbedUrl).toBe("https://player.vimeo.com/video/987654321?h=def456ghi");
    expect(second.status.videoSentAt).toBeNull();
    expect(second.status.completedAt).toBeNull();
    expect(second.status.videoReplyId).toBe(first.reply.id);
    const replies = await listVideoReplies(store);
    expect(replies.map((reply) => reply.id)).toEqual([first.reply.id]);
    expect(JSON.stringify(replies[0]).includes("ada@example.com")).toBe(true);
    const publicFields = {
      topic: replies[0]?.topic,
      first: replies[0]?.memberFirstName,
    };
    expect(JSON.stringify(publicFields)).not.toContain("ada@example.com");
  });

  it("gives a later payment its own thank-you video", async () => {
    const store = createMemoryStore();
    const db = createStatusDb();
    const first = await connectMemberThankYouVideo({
      stripeChargeId: "ch_thisyear",
      ...member,
      vimeoUrl: "https://vimeo.com/111111111/abc111def",
      store,
      queryFn: db.queryFn,
    });
    const renewal = await connectMemberThankYouVideo({
      stripeChargeId: "ch_nextyear",
      ...member,
      vimeoUrl: "https://vimeo.com/222222222/abc222def",
      store,
      queryFn: db.queryFn,
    });
    expect(renewal.reply.id).not.toBe(first.reply.id);
    expect(db.table.get("ch_thisyear")?.videoReplyId).toBe(first.reply.id);
    expect(db.table.get("ch_nextyear")?.videoReplyId).toBe(renewal.reply.id);
    expect(await listVideoReplies(store)).toHaveLength(2);
  });

  it("marks only the video email sent, then completes and reopens without losing the link", async () => {
    const store = createMemoryStore();
    const db = createStatusDb();
    const connected = await connectMemberThankYouVideo({
      stripeChargeId: "ch_annual1",
      ...member,
      vimeoUrl: "https://vimeo.com/123456789/abc123def",
      now: "2026-11-01T15:00:00.000Z",
      store,
      queryFn: db.queryFn,
    });
    await setThankYouStatus(
      {
        stripeChargeId: "ch_annual1",
        field: "card",
        sent: true,
        sentAt: "2026-11-01T15:30:00.000Z",
      },
      db.queryFn,
    );

    const sent = await markMemberThankYouVideoEmailSent({
      stripeChargeId: "ch_annual1",
      now: "2026-11-01T16:00:00.000Z",
      store,
      queryFn: db.queryFn,
    });
    expect(sent.videoSentAt).toBe("2026-11-01T16:00:00.000Z");
    expect(sent.cardSentAt).toBe("2026-11-01T15:30:00.000Z");
    expect(sent.completedAt).toBeNull();
    expect(sent.videoReplyId).toBe(connected.reply.id);
    const replies = await listVideoReplies(store);
    expect(replies[0]?.sentAt).toBe("2026-11-01T16:00:00.000Z");

    const completed = await setThankYouCompleted(
      {
        stripeChargeId: "ch_annual1",
        completed: true,
        completedAt: "2026-11-01T17:00:00.000Z",
      },
      db.queryFn,
    );
    expect(completed.completedAt).toBe("2026-11-01T17:00:00.000Z");
    expect(completed.videoSentAt).toBe(sent.videoSentAt);
    expect(completed.cardSentAt).toBe(sent.cardSentAt);
    expect(completed.videoReplyId).toBe(connected.reply.id);

    const reopened = await setThankYouCompleted(
      { stripeChargeId: "ch_annual1", completed: false },
      db.queryFn,
    );
    expect(reopened.completedAt).toBeNull();
    expect(reopened.videoSentAt).toBe(sent.videoSentAt);
    expect(reopened.cardSentAt).toBe(sent.cardSentAt);
    expect(reopened.videoReplyId).toBe(connected.reply.id);
    expect((await listVideoReplies(store))[0]?.publicToken).toBe(connected.reply.publicToken);
  });
});

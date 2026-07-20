import { describe, expect, it } from "vitest";

import { compareSortValues } from "../watson/sortableTable";
import { dateSortValue } from "./videoReplyDisplay";
import {
  buildVideoReply,
  disableVideoReply,
  getVideoReplyByPublicToken,
  isVideoReplyPubliclyAvailable,
  listVideoReplies,
  markVideoReplySent,
  recordVideoReplyOpen,
  saveVideoReply,
  toPublicVideoReplyView,
  updateVideoReplyFields,
  videoReplyBlobKey,
  VideoReplyValidationError,
} from "./videoRepliesStore";

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

const baseInput = {
  memberName: "Alex Rivera",
  memberEmail: "alex@example.com",
  topic: "Cast-on help",
  vimeoUrl: "https://vimeo.com/123456789",
  privateNotes: "Called twice already",
  now: "2026-07-19T12:00:00.000Z",
  id: "reply-1",
  publicToken: "abcdefghijklmnopqrstuvwxyz0123456789ABCD",
};

describe("videoRepliesStore", () => {
  it("creates a video reply with strong token and unset sent/open fields", () => {
    const record = buildVideoReply(baseInput);
    expect(record.id).toBe("reply-1");
    expect(record.publicToken).toBe(baseInput.publicToken);
    expect(record.memberFirstName).toBe("Alex");
    expect(record.safeVimeoEmbedUrl).toBe("https://player.vimeo.com/video/123456789");
    expect(record.sentAt).toBeNull();
    expect(record.sentCount).toBe(0);
    expect(record.openCount).toBe(0);
    expect(record.firstOpenedAt).toBeNull();
    expect(record.status).toBe("active");
    expect(videoReplyBlobKey(record.id)).toBe("replies/reply-1.json");
  });

  it("rejects invalid create input", () => {
    expect(() => buildVideoReply({ ...baseInput, memberName: "" })).toThrow(
      VideoReplyValidationError,
    );
    expect(() => buildVideoReply({ ...baseInput, memberEmail: "nope" })).toThrow(
      VideoReplyValidationError,
    );
    expect(() => buildVideoReply({ ...baseInput, topic: "  " })).toThrow(
      VideoReplyValidationError,
    );
    expect(() =>
      buildVideoReply({ ...baseInput, vimeoUrl: "https://example.com/video" }),
    ).toThrow(VideoReplyValidationError);
  });

  it("saves and looks up by public token", async () => {
    const store = createMemoryStore();
    const saved = await saveVideoReply(store, baseInput);
    const byToken = await getVideoReplyByPublicToken(store, saved.publicToken);
    expect(byToken?.id).toBe(saved.id);
    expect(byToken?.memberEmail).toBe("alex@example.com");
  });

  it("returns null for invalid tokens", async () => {
    const store = createMemoryStore();
    await saveVideoReply(store, baseInput);
    expect(await getVideoReplyByPublicToken(store, "short")).toBeNull();
    expect(await getVideoReplyByPublicToken(store, "zzzzzzzzzzzzzzzzzzzzzzzzzzzzzz")).toBeNull();
  });

  it("records first open and subsequent opens without replacing firstOpenedAt", async () => {
    const store = createMemoryStore();
    await saveVideoReply(store, baseInput);

    const first = await recordVideoReplyOpen(store, baseInput.publicToken, {
      now: "2026-07-19T13:00:00.000Z",
    });
    expect(first?.firstOpenedAt).toBe("2026-07-19T13:00:00.000Z");
    expect(first?.lastOpenedAt).toBe("2026-07-19T13:00:00.000Z");
    expect(first?.openCount).toBe(1);

    const second = await recordVideoReplyOpen(store, baseInput.publicToken, {
      now: "2026-07-20T09:00:00.000Z",
    });
    expect(second?.firstOpenedAt).toBe("2026-07-19T13:00:00.000Z");
    expect(second?.lastOpenedAt).toBe("2026-07-20T09:00:00.000Z");
    expect(second?.openCount).toBe(2);
  });

  it("marks sent and supports mark sent again with sentEvents", async () => {
    const store = createMemoryStore();
    await saveVideoReply(store, baseInput);

    const sent = await markVideoReplySent(store, "reply-1", {
      now: "2026-07-19T14:00:00.000Z",
    });
    expect(sent?.sentAt).toBe("2026-07-19T14:00:00.000Z");
    expect(sent?.sentCount).toBe(1);
    expect(sent?.sentEvents).toHaveLength(1);

    const duplicateWindow = await markVideoReplySent(store, "reply-1", {
      now: "2026-07-19T14:00:30.000Z",
    });
    expect(duplicateWindow?.sentCount).toBe(1);

    const again = await markVideoReplySent(store, "reply-1", {
      now: "2026-07-19T15:00:00.000Z",
      force: true,
    });
    expect(again?.sentCount).toBe(2);
    expect(again?.sentEvents).toHaveLength(2);
    expect(again?.sentAt).toBe("2026-07-19T15:00:00.000Z");
  });

  it("does not change public token when editing", async () => {
    const store = createMemoryStore();
    await saveVideoReply(store, baseInput);
    const updated = await updateVideoReplyFields(store, "reply-1", {
      memberName: "Pat Lee",
      memberEmail: "pat@example.com",
      topic: "New topic",
      vimeoUrl: "https://player.vimeo.com/video/999888777",
      privateNotes: "updated notes",
      now: "2026-07-19T16:00:00.000Z",
    });

    expect(updated?.publicToken).toBe(baseInput.publicToken);
    expect(updated?.memberName).toBe("Pat Lee");
    expect(updated?.memberFirstName).toBe("Pat");
    expect(updated?.safeVimeoEmbedUrl).toBe("https://player.vimeo.com/video/999888777");
  });

  it("disables public access while retaining the history record", async () => {
    const store = createMemoryStore();
    await saveVideoReply(store, baseInput);
    const disabled = await disableVideoReply(store, "reply-1", {
      now: "2026-07-19T17:00:00.000Z",
    });
    expect(disabled?.status).toBe("disabled");
    expect(disabled?.disabledAt).toBe("2026-07-19T17:00:00.000Z");
    expect(isVideoReplyPubliclyAvailable(disabled)).toBe(false);

    const openAttempt = await recordVideoReplyOpen(store, baseInput.publicToken);
    expect(openAttempt).toBeNull();

    const listed = await listVideoReplies(store);
    expect(listed.find((r) => r.id === "reply-1")?.status).toBe("disabled");
  });

  it("never exposes private notes or email in the public view", async () => {
    const store = createMemoryStore();
    const saved = await saveVideoReply(store, baseInput);
    const publicView = toPublicVideoReplyView(saved);
    expect(publicView).toEqual({
      topic: "Cast-on help",
      memberFirstName: "Alex",
      safeVimeoEmbedUrl: "https://player.vimeo.com/video/123456789",
    });
    expect(JSON.stringify(publicView)).not.toContain("alex@example.com");
    expect(JSON.stringify(publicView)).not.toContain("Called twice");
    expect(JSON.stringify(publicView)).not.toContain("privateNotes");
    expect(JSON.stringify(publicView)).not.toContain("memberEmail");
  });

  it("lists newest created first", async () => {
    const store = createMemoryStore();
    await saveVideoReply(store, {
      ...baseInput,
      id: "older",
      publicToken: "abcdefghijklmnopqrstuvwxyz0123456789OLDR",
      now: "2026-07-01T12:00:00.000Z",
    });
    await saveVideoReply(store, {
      ...baseInput,
      id: "newer",
      publicToken: "abcdefghijklmnopqrstuvwxyz0123456789NEWR",
      now: "2026-07-19T12:00:00.000Z",
    });
    const listed = await listVideoReplies(store);
    expect(listed.map((r) => r.id)).toEqual(["newer", "older"]);
  });
});

describe("video reply table sort values", () => {
  it("sorts names, dates, missing dates, and open counts predictably", () => {
    expect(compareSortValues("Zoe", "Amy", "string")).toBeGreaterThan(0);
    expect(
      compareSortValues("2026-07-19T00:00:00.000Z", "2026-07-01T00:00:00.000Z", "date"),
    ).toBeGreaterThan(0);
    expect(compareSortValues(dateSortValue(null), "2026-07-01T00:00:00.000Z", "date")).toBeLessThan(
      0,
    );
    expect(compareSortValues("2", "10", "string")).toBeLessThan(0);
    expect(compareSortValues("0", "3", "string")).toBeLessThan(0);
  });
});

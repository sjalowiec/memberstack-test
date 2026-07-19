import { describe, expect, it } from "vitest";

import {
  buildContactAttachmentUrl,
  buildContactMessage,
  computeContactMessageCounts,
  contactMessageBlobKey,
  getContactMessage,
  listContactMessages,
  matchesListFilter,
  saveContactMessage,
  updateContactMessage,
  type ContactMessage,
} from "./contactMessagesStore";

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

describe("contactMessagesStore", () => {
  it("builds a message that defaults to status new", () => {
    const message = buildContactMessage({
      name: "Sue",
      email: "visitor@example.com",
      message: "Hello",
      now: "2026-07-19T12:00:00.000Z",
      id: "msg-1",
    });

    expect(message.status).toBe("new");
    expect(message.notification_email_sent).toBe(false);
    expect(message.id).toBe("msg-1");
    expect(contactMessageBlobKey(message.id)).toBe("messages/msg-1.json");
  });

  it("saves and retrieves a message", async () => {
    const store = createMemoryStore();
    const saved = await saveContactMessage(store, {
      name: "Pat",
      email: "pat@example.com",
      message: "Need help",
      source: "contact_page",
      now: "2026-07-19T12:00:00.000Z",
      id: "msg-save",
    });

    const loaded = await getContactMessage(store, saved.id);
    expect(loaded).toEqual(saved);
    expect(loaded?.status).toBe("new");
  });

  it("persists status and admin notes updates", async () => {
    const store = createMemoryStore();
    await saveContactMessage(store, {
      name: "Pat",
      email: "pat@example.com",
      message: "Need help",
      now: "2026-07-19T12:00:00.000Z",
      id: "msg-update",
    });

    const updated = await updateContactMessage(store, "msg-update", {
      status: "in_progress",
      admin_notes: "Called back",
      now: "2026-07-19T13:00:00.000Z",
    });

    expect(updated?.status).toBe("in_progress");
    expect(updated?.admin_notes).toBe("Called back");
    expect(updated?.updated_at).toBe("2026-07-19T13:00:00.000Z");

    const resolved = await updateContactMessage(store, "msg-update", {
      status: "resolved",
      now: "2026-07-19T14:00:00.000Z",
    });
    expect(resolved?.status).toBe("resolved");

    const listedOpen = await listContactMessages(store, { filter: "open" });
    expect(listedOpen.find((m) => m.id === "msg-update")).toBeUndefined();

    const listedAll = await listContactMessages(store, { filter: "all" });
    expect(listedAll.find((m) => m.id === "msg-update")?.status).toBe("resolved");
  });

  it("keeps resolved messages retrievable", async () => {
    const store = createMemoryStore();
    await saveContactMessage(store, {
      name: "Pat",
      email: "pat@example.com",
      message: "Done",
      id: "msg-resolved",
      now: "2026-07-18T12:00:00.000Z",
    });
    await updateContactMessage(store, "msg-resolved", { status: "resolved" });

    const loaded = await getContactMessage(store, "msg-resolved");
    expect(loaded?.status).toBe("resolved");
    expect(matchesListFilter(loaded as ContactMessage, "resolved")).toBe(true);
    expect(matchesListFilter(loaded as ContactMessage, "open")).toBe(false);
  });

  it("sorts messages newest first", async () => {
    const store = createMemoryStore();
    await saveContactMessage(store, {
      name: "A",
      email: "a@example.com",
      message: "older",
      id: "older",
      now: "2026-07-01T12:00:00.000Z",
    });
    await saveContactMessage(store, {
      name: "B",
      email: "b@example.com",
      message: "newer",
      id: "newer",
      now: "2026-07-19T12:00:00.000Z",
    });

    const listed = await listContactMessages(store, { filter: "all" });
    expect(listed.map((m) => m.id)).toEqual(["newer", "older"]);
  });

  it("computes new, open, and older-than-48-hours counts", () => {
    const nowMs = Date.parse("2026-07-19T12:00:00.000Z");
    const messages: ContactMessage[] = [
      {
        id: "1",
        created_at: "2026-07-19T10:00:00.000Z",
        updated_at: "2026-07-19T10:00:00.000Z",
        name: "A",
        email: "a@example.com",
        message: "new",
        status: "new",
        notification_email_sent: true,
      },
      {
        id: "2",
        created_at: "2026-07-10T10:00:00.000Z",
        updated_at: "2026-07-10T10:00:00.000Z",
        name: "B",
        email: "b@example.com",
        message: "old open",
        status: "in_progress",
        notification_email_sent: true,
      },
      {
        id: "3",
        created_at: "2026-07-01T10:00:00.000Z",
        updated_at: "2026-07-01T10:00:00.000Z",
        name: "C",
        email: "c@example.com",
        message: "resolved",
        status: "resolved",
        notification_email_sent: true,
      },
    ];

    expect(computeContactMessageCounts(messages, nowMs)).toEqual({
      new: 1,
      open: 2,
      older_than_48_hours: 1,
    });
  });

  it("builds attachment URLs from durable blob key and token", () => {
    const url = buildContactAttachmentUrl("https://example.com", {
      blob_key: "contact/abc.jpg",
      access_token: "token-1",
    });
    expect(url).toBe(
      "https://example.com/.netlify/functions/contact-image?id=contact%2Fabc.jpg&token=token-1",
    );
  });
});

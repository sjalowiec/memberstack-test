import fs from "fs";
import path from "path";

import { describe, expect, it, vi } from "vitest";

import {
  computeContactMessageCounts,
  listContactMessages,
  saveContactMessage,
  updateContactMessage,
  type ContactMessage,
} from "../../../lib/contact/contactMessagesStore";

function createMemoryStore() {
  const data = new Map<string, unknown>();
  return {
    async get(key: string, opts?: { type?: string }) {
      if (!data.has(key)) return null;
      return opts?.type === "json" ? data.get(key) : data.get(key);
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

describe("Watson contact-messages API routes", () => {
  it("defines admin-gated list and update endpoints", () => {
    const listApi = fs.readFileSync(
      path.resolve("src/pages/api/watson/contact-messages/index.ts"),
      "utf8",
    );
    const itemApi = fs.readFileSync(
      path.resolve("src/pages/api/watson/contact-messages/[id].ts"),
      "utf8",
    );

    expect(listApi).toContain("requireWatsonAdminJson");
    expect(listApi).toContain("export const GET");
    expect(listApi).toContain("listContactMessages");
    expect(listApi).toContain("export const prerender = false");

    expect(itemApi).toContain("requireWatsonAdminJson");
    expect(itemApi).toContain("export const GET");
    expect(itemApi).toContain("export const PATCH");
    expect(itemApi).toContain("updateContactMessage");
  });

  it("keeps contact-messages under Watson API routes only", () => {
    const listPath = path.resolve("src/pages/api/watson/contact-messages/index.ts");
    const itemPath = path.resolve("src/pages/api/watson/contact-messages/[id].ts");
    expect(listPath).toContain(`${path.sep}api${path.sep}watson${path.sep}`);
    expect(itemPath).toContain(`${path.sep}api${path.sep}watson${path.sep}`);

    const listApi = fs.readFileSync(listPath, "utf8");
    expect(listApi).toContain("requireWatsonAdminJson");
    expect(listApi).not.toContain("pages/contact");
    expect(listApi).not.toContain("/.netlify/functions/contact");
  });
});

describe("Watson contact-messages authorization gate", () => {
  it("requires Watson admin session for the list endpoint", async () => {
    vi.resetModules();
    vi.doMock("../../../lib/watson/watsonApiAuth", async () => {
      const actual = await vi.importActual<typeof import("../../../lib/watson/watsonApiAuth")>(
        "../../../lib/watson/watsonApiAuth",
      );
      return {
        ...actual,
        requireWatsonAdminJson: vi.fn(async () =>
          actual.watsonJsonResponse({ ok: false, error: "Sign in required." }, 401),
        ),
      };
    });

    const { GET } = await import("./contact-messages/index");
    const response = await GET({
      cookies: {},
      url: new URL("https://example.com/api/watson/contact-messages"),
    } as never);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/sign in/i);

    vi.doUnmock("../../../lib/watson/watsonApiAuth");
    vi.resetModules();
  });
});

describe("Watson contact-messages persistence helpers", () => {
  it("persists status and notes and keeps resolved messages listable", async () => {
    const store = createMemoryStore();
    await saveContactMessage(store, {
      name: "A",
      email: "a@example.com",
      message: "first",
      id: "one",
      now: "2026-07-19T10:00:00.000Z",
    });
    await saveContactMessage(store, {
      name: "B",
      email: "b@example.com",
      message: "second",
      id: "two",
      now: "2026-07-19T11:00:00.000Z",
    });

    await updateContactMessage(store, "one", {
      status: "resolved",
      admin_notes: "Closed after reply",
    });

    const all = await listContactMessages(store, { filter: "all" });
    expect(all.map((m) => m.id)).toEqual(["two", "one"]);

    const resolved = all.find((m) => m.id === "one") as ContactMessage;
    expect(resolved.status).toBe("resolved");
    expect(resolved.admin_notes).toBe("Closed after reply");

    const open = await listContactMessages(store, { filter: "open" });
    expect(open.map((m) => m.id)).toEqual(["two"]);

    const counts = computeContactMessageCounts(all);
    expect(counts.open).toBe(1);
    expect(counts.new).toBe(1);
  });
});

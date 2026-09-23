import fs from "fs";
import path from "path";

import { describe, expect, it } from "vitest";

function unauthenticatedContext(pathname: string, init?: RequestInit) {
  return {
    cookies: { get: () => undefined },
    url: new URL(`https://example.com${pathname}`),
    params: { id: "11111111-1111-1111-1111-111111111111" },
    request: new Request(`https://example.com${pathname}`, init),
  } as never;
}

describe("Watson contact-messages API routes", () => {
  it("defines session-gated list, detail, and update endpoints", () => {
    const listApi = fs.readFileSync(
      path.resolve("src/pages/api/watson/contact-messages/index.ts"),
      "utf8",
    );
    const itemApi = fs.readFileSync(
      path.resolve("src/pages/api/watson/contact-messages/[id].ts"),
      "utf8",
    );
    const listPage = fs.readFileSync(
      path.resolve("src/pages/watson/contact-messages/index.astro"),
      "utf8",
    );
    const detailPage = fs.readFileSync(
      path.resolve("src/pages/watson/contact-messages/[id].astro"),
      "utf8",
    );

    expect(listApi).toContain("requireWatsonAdminJson");
    expect(listApi).toContain("export const GET");
    expect(listApi).toContain("listContactMessages");
    expect(listApi).toContain("countNewContactMessages");
    expect(itemApi).toContain("requireWatsonAdminJson");
    expect(itemApi).toContain("export const GET");
    expect(itemApi).toContain("export const PATCH");
    expect(itemApi).toContain("export const DELETE");
    expect(itemApi).toContain("updateContactMessage");
    expect(itemApi).toContain("deleteContactMessage");
    expect(itemApi).toContain("countNewContactMessages");
    expect(listPage).toContain("Open message");
    expect(listPage).toContain("data-contact-list-respond");
    expect(listPage).toContain("Mark Responded");
    expect(listPage).toContain('message.status === "new"');
    expect(listPage).toContain("data-contact-list-delete");
    expect(listPage).toContain("initWatsonContactMessageList");
    expect(listPage).toContain('export const prerender = false');
    expect(listPage).toContain('parseContactMessageFilter');
    expect(detailPage).toContain("Reply by email");
    expect(detailPage).toContain("Mark Responded");
    expect(detailPage).toContain("Reopen as New");
    expect(listApi).not.toContain("/.netlify/functions/contact");
  });
});

describe("Watson contact-messages authorization gate", () => {
  it("requires a Watson session for list, detail, update, and delete", async () => {
    const { GET: list } = await import("./contact-messages/index");
    const { GET: detail, PATCH, DELETE } = await import("./contact-messages/[id]");

    const listResponse = await list(unauthenticatedContext("/api/watson/contact-messages"));
    const detailResponse = await detail(
      unauthenticatedContext(
        "/api/watson/contact-messages/11111111-1111-1111-1111-111111111111",
      ),
    );
    const updateResponse = await PATCH(
      unauthenticatedContext(
        "/api/watson/contact-messages/11111111-1111-1111-1111-111111111111",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "closed" }),
        },
      ),
    );
    const deleteResponse = await DELETE(
      unauthenticatedContext(
        "/api/watson/contact-messages/11111111-1111-1111-1111-111111111111",
        { method: "DELETE" },
      ),
    );

    for (const response of [listResponse, detailResponse, updateResponse, deleteResponse]) {
      expect(response.status).toBe(401);
      const body = await response.json();
      expect(body.ok).toBe(false);
      expect(body.error).toMatch(/sign in/i);
    }
  });
});

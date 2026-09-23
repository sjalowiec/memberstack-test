import fs from "fs";
import path from "path";

import { describe, expect, it, vi } from "vitest";

import {
  CONTACT_MESSAGE_COUNT_NEW_SQL,
  CONTACT_MESSAGE_INSERT_SQL,
  CONTACT_MESSAGE_LIST_SQL,
  countNewContactMessages,
  insertContactMessage,
  updateContactMessage,
  type ContactMessageRow,
} from "./contactMessagesDb";
import {
  nextStatusTimestamps,
  normalizeContactSubmission,
  parseContactMessageFilter,
} from "./contactMessageRecord";

const storedRow: ContactMessageRow = {
  id: "11111111-1111-1111-1111-111111111111",
  created_at: "2026-09-23T16:00:00.000Z",
  name: "Sue Tester",
  email: "visitor@example.com",
  subject: null,
  message: "Please help with my gauge",
  source: "contact_page",
  page_url: "https://example.com/contact",
  status: "new",
  responded_at: null,
  closed_at: null,
  internal_notes: null,
  notification_email_sent: false,
  notification_email_error: null,
  notification_attempted_at: null,
  attachment_blob_key: null,
  attachment_access_token: null,
  attachment_content_type: null,
  attachment_filename: null,
  updated_at: "2026-09-23T16:00:00.000Z",
};

describe("contact message validation", () => {
  it("normalizes a valid submission", () => {
    expect(
      normalizeContactSubmission({
        name: " Sue ",
        email: " visitor@example.com ",
        message: " Hello ",
        source: " contact_page ",
        pageUrl: " https://example.com/contact ",
      }),
    ).toEqual({
      ok: true,
      value: {
        name: "Sue",
        email: "visitor@example.com",
        subject: null,
        message: "Hello",
        source: "contact_page",
        pageUrl: "https://example.com/contact",
      },
    });
  });

  it("rejects missing, invalid, and oversized fields", () => {
    expect(normalizeContactSubmission({ email: "", message: "Hi" }).ok).toBe(false);
    expect(normalizeContactSubmission({ email: "nope", message: "Hi" })).toEqual({
      ok: false,
      error: "Email must be a valid email address.",
    });
    expect(normalizeContactSubmission({ email: "a@b.co", message: "  " })).toEqual({
      ok: false,
      error: "Message is required.",
    });
    expect(
      normalizeContactSubmission({
        email: "a@b.co",
        message: "x".repeat(20_001),
      }).ok,
    ).toBe(false);
  });

  it("defaults the inbox filter to new messages", () => {
    expect(parseContactMessageFilter(null)).toBe("new");
    expect(parseContactMessageFilter("nope")).toBe("new");
    expect(parseContactMessageFilter("closed")).toBe("closed");
    expect(parseContactMessageFilter("all")).toBe("all");
  });
});

describe("contact message database writes", () => {
  it("inserts a normalized submission as new", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([storedRow]);
    const record = await insertContactMessage(
      {
        name: "Sue Tester",
        email: "visitor@example.com",
        subject: null,
        message: "Please help with my gauge",
        source: "contact_page",
        pageUrl: "https://example.com/contact",
        now: "2026-09-23T16:00:00.000Z",
        id: storedRow.id,
      },
      queryFn,
    );

    expect(record.status).toBe("new");
    expect(record.email).toBe("visitor@example.com");
    expect(queryFn.mock.calls[0]?.[0]).toBe(CONTACT_MESSAGE_INSERT_SQL);
    expect(queryFn.mock.calls[0]?.[0]).not.toMatch(/\bDELETE\b/i);
    expect(queryFn.mock.calls[0]?.[1]?.[0]).toBe(storedRow.id);
    expect(queryFn.mock.calls[0]?.[1]?.[3]).toBe("visitor@example.com");
  });

  it("counts new messages with a status filter", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([{ count: 4 }]);
    await expect(countNewContactMessages(queryFn)).resolves.toBe(4);
    expect(queryFn).toHaveBeenCalledWith(CONTACT_MESSAGE_COUNT_NEW_SQL);
    expect(CONTACT_MESSAGE_LIST_SQL).toContain("ORDER BY created_at DESC");
    expect(CONTACT_MESSAGE_LIST_SQL).toContain("status = $1");
  });

  it("records responded and closed timestamps and can reopen as new", () => {
    const now = "2026-09-23T18:00:00.000Z";
    const responded = nextStatusTimestamps(
      { status: "new", respondedAt: null, closedAt: null },
      "responded",
      now,
    );
    expect(responded).toEqual({
      status: "responded",
      respondedAt: now,
      closedAt: null,
    });

    const closed = nextStatusTimestamps(responded, "closed", "2026-09-23T19:00:00.000Z");
    expect(closed).toEqual({
      status: "closed",
      respondedAt: now,
      closedAt: "2026-09-23T19:00:00.000Z",
    });

    expect(nextStatusTimestamps(closed, "new", "2026-09-23T20:00:00.000Z")).toEqual({
      status: "new",
      respondedAt: null,
      closedAt: null,
    });
  });

  it("writes status timestamps through the update query", async () => {
    const existing = { ...storedRow };
    const updated = {
      ...storedRow,
      status: "responded",
      responded_at: "2026-09-23T18:00:00.000Z",
      updated_at: "2026-09-23T18:00:00.000Z",
    };
    const queryFn = vi
      .fn()
      .mockResolvedValueOnce([existing])
      .mockResolvedValueOnce([updated]);

    const result = await updateContactMessage(
      storedRow.id,
      { status: "responded", now: "2026-09-23T18:00:00.000Z" },
      queryFn,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("responded");
      expect(result.value.respondedAt).toBe("2026-09-23T18:00:00.000Z");
    }
    const updateParams = queryFn.mock.calls[1]?.[1] as unknown[];
    expect(queryFn.mock.calls[1]?.[0]).toContain("UPDATE watson_contact_messages");
    expect(queryFn.mock.calls[1]?.[0]).not.toMatch(/\bDELETE\b/i);
    expect(updateParams[1]).toBe("responded");
    expect(updateParams[2]).toBe("2026-09-23T18:00:00.000Z");
    expect(updateParams[3]).toBeNull();
  });
});

describe("contact message migration", () => {
  it("creates the table with row level security and no public policies", () => {
    const sql = fs.readFileSync(
      path.resolve("scripts/sql/watson-contact-messages.sql"),
      "utf8",
    );
    const migration = fs.readFileSync(
      path.resolve("supabase/migrations/20260923183000_watson_contact_messages.sql"),
      "utf8",
    );

    for (const source of [sql, migration]) {
      expect(source).toContain("CREATE TABLE IF NOT EXISTS public.watson_contact_messages");
      expect(source).toContain("ENABLE ROW LEVEL SECURITY");
      expect(source).not.toContain("CREATE POLICY");
      expect(source).not.toMatch(/ALTER TABLE[\s\S]*FORCE ROW LEVEL SECURITY/i);
      expect(source).not.toMatch(/\bDROP\b/i);
      expect(source).not.toMatch(/\bDELETE\b/i);
      expect(source).toContain("status IN ('new', 'responded', 'closed')");
      expect(source).toContain("internal_notes");
      expect(source).toContain("notification_email_error");
    }
  });
});

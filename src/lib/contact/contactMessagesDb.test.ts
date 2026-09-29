import fs from "fs";
import path from "path";

import { describe, expect, it, vi } from "vitest";

import {
  CONTACT_MESSAGE_BULK_DELETE_MAX,
  contactListHrefAfterRespond,
  contactMessageCustomerHref,
  contactMessageDetailHref,
  contactMessageListHref,
  deletedContactMessagesNotice,
  listPreview,
  nextStatusTimestamps,
  normalizeContactSubmission,
  parseContactMessageFilter,
  parseContactMessageIds,
  readContactCustomerReturnPath,
  readContactMessageListLocation,
  respondedContactNoticeLinks,
} from "./contactMessageRecord";
import {
  CONTACT_MESSAGE_BULK_DELETE_SQL,
  CONTACT_MESSAGE_BY_ID_SQL,
  CONTACT_MESSAGE_COUNT_NEW_SQL,
  CONTACT_MESSAGE_DELETE_SQL,
  CONTACT_MESSAGE_INSERT_SQL,
  CONTACT_MESSAGE_LIST_SQL,
  CONTACT_MESSAGES_BY_EMAIL_SQL,
  contactMessageEmailKeys,
  countNewContactMessages,
  deleteContactMessage,
  deleteContactMessages,
  insertContactMessage,
  listContactMessagesForEmails,
  updateContactMessage,
  type ContactMessageRow,
} from "./contactMessagesDb";

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

  it("loads the full message text and only shortens it in the list preview", () => {
    const full = `${"a".repeat(200)}\nsecond line`;
    expect(CONTACT_MESSAGE_LIST_SQL).toMatch(/SELECT[\s\S]*\bmessage\b/);
    expect(CONTACT_MESSAGE_LIST_SQL).not.toMatch(/\bLEFT\s*\(/i);
    expect(CONTACT_MESSAGE_LIST_SQL).not.toMatch(/\bSUBSTRING\s*\(/i);
    expect(CONTACT_MESSAGE_BY_ID_SQL).toContain("message");
    expect(CONTACT_MESSAGE_BY_ID_SQL).not.toMatch(/\bLEFT\s*\(/i);
    expect(listPreview(null, full).length).toBeLessThan(full.length);
    expect(listPreview("Gauge help", full)).toBe("Gauge help");
    expect(full).toContain("second line");
  });

  it("matches customer emails by trim and case only and keeps newest first", async () => {
    expect(contactMessageEmailKeys(["  Sue@Example.com ", "sue@example.com", " Other@Example.com "])).toEqual([
      "sue@example.com",
      "other@example.com",
    ]);
    expect(contactMessageEmailKeys(["sue@gmail.com"])).toEqual(["sue@gmail.com"]);
    expect(CONTACT_MESSAGES_BY_EMAIL_SQL).toContain("LOWER(TRIM(email))");
    expect(CONTACT_MESSAGES_BY_EMAIL_SQL).toContain("ORDER BY created_at DESC, id DESC");
    expect(CONTACT_MESSAGES_BY_EMAIL_SQL).not.toMatch(/\bUPDATE\b|\bDELETE\b/i);
    expect(CONTACT_MESSAGES_BY_EMAIL_SQL).not.toContain("googlemail");

    const older = { ...storedRow, id: "22222222-2222-2222-2222-222222222222", created_at: "2026-09-01T00:00:00.000Z", email: "Sue@Example.com" };
    const newer = { ...storedRow, created_at: "2026-09-23T16:00:00.000Z", email: "  sue@example.com  " };
    const queryFn = vi.fn().mockResolvedValueOnce([older, newer]);
    const messages = await listContactMessagesForEmails(["  Sue@Example.com "], queryFn);
    expect(queryFn).toHaveBeenCalledWith(CONTACT_MESSAGES_BY_EMAIL_SQL, [["sue@example.com"]]);
    expect(messages.map((message) => message.id)).toEqual([storedRow.id, older.id]);
    await expect(listContactMessagesForEmails(["  "], vi.fn())).resolves.toEqual([]);
  });

  it("keeps the list filter and page on the message link and the way back", () => {
    const location = readContactMessageListLocation(
      new URLSearchParams("filter=closed&page=2&deleted=4"),
    );
    expect(location).toEqual({ filter: "closed", page: 2 });
    expect(contactMessageDetailHref(storedRow.id, location)).toBe(
      `/watson/contact-messages/${storedRow.id}?filter=closed&page=2`,
    );
    expect(contactMessageListHref(location)).toBe(
      "/watson/contact-messages?filter=closed&page=2",
    );
    expect(deletedContactMessagesNotice(1)).toBe("Deleted 1 contact message.");
    expect(deletedContactMessagesNotice(3)).toBe("Deleted 3 contact messages.");
    expect(contactListHrefAfterRespond(storedRow.id, location)).toBe(
      `/watson/contact-messages?filter=closed&page=2&responded=${storedRow.id}`,
    );
    expect(respondedContactNoticeLinks(storedRow.id, location)).toEqual({
      viewMessageHref: `/watson/contact-messages/${storedRow.id}?filter=closed&page=2`,
      viewRespondedHref: "/watson/contact-messages?filter=responded",
    });
    expect(contactListHrefAfterRespond(storedRow.id, { filter: "all", page: 3 })).toBe(
      "/watson/contact-messages?filter=all&page=3",
    );
    expect(respondedContactNoticeLinks(storedRow.id, { filter: "responded", page: 2 })).toBeNull();
    expect(readContactCustomerReturnPath("/watson/customers/legacy/C80B9DCB-BD2A-E61E-47F2-7DAF156318D4")).toBe(
      "/watson/customers/legacy/C80B9DCB-BD2A-E61E-47F2-7DAF156318D4",
    );
    expect(readContactCustomerReturnPath("https://example.com/watson/customers/legacy/M1")).toBeNull();
    expect(
      contactMessageCustomerHref(
        storedRow.id,
        "/watson/customers/memberstack/mem_abc123",
      ),
    ).toBe(
      `/watson/contact-messages/${storedRow.id}?customer=%2Fwatson%2Fcustomers%2Fmemberstack%2Fmem_abc123`,
    );
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

  it("deletes one message by id and returns its attachment key", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([
      {
        id: storedRow.id,
        status: "new",
        attachment_blob_key: " contact/11111111-1111-4111-8111-111111111111.png ",
      },
    ]);

    const result = await deleteContactMessage(storedRow.id, queryFn);

    expect(result).toEqual({
      ok: true,
      value: {
        id: storedRow.id,
        status: "new",
        attachmentBlobKey: "contact/11111111-1111-4111-8111-111111111111.png",
      },
    });
    expect(queryFn).toHaveBeenCalledWith(CONTACT_MESSAGE_DELETE_SQL, [storedRow.id]);
    expect(CONTACT_MESSAGE_DELETE_SQL).toMatch(/DELETE FROM watson_contact_messages/i);
    expect(CONTACT_MESSAGE_DELETE_SQL).toContain("WHERE id = $1");
    expect(CONTACT_MESSAGE_DELETE_SQL).not.toMatch(/\bDROP\b/i);
  });

  it("does not delete when the id is invalid or the message is missing", async () => {
    const queryFn = vi.fn().mockResolvedValueOnce([]);

    await expect(deleteContactMessage("bad id", queryFn)).resolves.toEqual({
      ok: false,
      error: "Message id is invalid.",
      status: 400,
    });
    expect(queryFn).not.toHaveBeenCalled();

    await expect(deleteContactMessage(storedRow.id, queryFn)).resolves.toEqual({
      ok: false,
      error: "Message not found.",
      status: 404,
    });
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it("deletes only the selected message ids", async () => {
    const selected = [
      storedRow.id,
      "22222222-2222-4222-8222-222222222222",
    ];
    const unselected = "33333333-3333-4333-8333-333333333333";
    const queryFn = vi.fn().mockResolvedValueOnce([
      {
        id: selected[0],
        status: "new",
        attachment_blob_key: "contact/11111111-1111-4111-8111-111111111111.jpg",
      },
      {
        id: selected[1],
        status: "closed",
        attachment_blob_key: null,
      },
    ]);

    const result = await deleteContactMessages(selected, queryFn);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.map((message) => message.id)).toEqual(selected);
    }
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(queryFn).toHaveBeenCalledWith(CONTACT_MESSAGE_BULK_DELETE_SQL, [selected]);
    const [sql, params] = queryFn.mock.calls[0] as [string, string[][]];
    expect(sql).toMatch(/DELETE FROM watson_contact_messages/i);
    expect(sql).toContain("WHERE id = ANY($1::text[])");
    expect(sql).not.toMatch(/WHERE\s+status/i);
    expect(sql).not.toMatch(/\bDROP\b/i);
    expect(params[0]).toEqual(selected);
    expect(params[0]).not.toContain(unselected);
  });

  it("does not delete anything when a selected id is invalid or the list is empty", async () => {
    const queryFn = vi.fn();

    await expect(deleteContactMessages(["bad id"], queryFn)).resolves.toEqual({
      ok: false,
      error: "Message id is invalid.",
      status: 400,
    });
    await expect(deleteContactMessages([], queryFn)).resolves.toEqual({
      ok: false,
      error: "Select at least one message.",
      status: 400,
    });
    expect(queryFn).not.toHaveBeenCalled();

    const tooMany = Array.from({ length: CONTACT_MESSAGE_BULK_DELETE_MAX + 1 }, (_, index) => {
      return `11111111-1111-4111-8111-${index.toString(16).padStart(12, "0")}`;
    });
    expect(parseContactMessageIds(tooMany).ok).toBe(false);
    await expect(deleteContactMessages(tooMany, queryFn)).resolves.toMatchObject({
      ok: false,
      status: 400,
    });
    expect(queryFn).not.toHaveBeenCalled();
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

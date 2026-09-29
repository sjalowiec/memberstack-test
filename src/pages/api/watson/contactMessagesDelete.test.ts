import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/watson/watsonAuth", () => ({
  isWatsonSessionAuthenticated: vi.fn(() => true),
}));

vi.mock("../../../lib/contact/contactMessagesDb", () => ({
  countNewContactMessages: vi.fn(),
  deleteContactMessage: vi.fn(),
  deleteContactMessages: vi.fn(),
  getContactMessageById: vi.fn(),
  updateContactMessage: vi.fn(),
}));

vi.mock("../../../lib/contact/contactUploads", () => ({
  deleteContactUpload: vi.fn(),
}));

import {
  countNewContactMessages,
  deleteContactMessage,
  deleteContactMessages,
} from "../../../lib/contact/contactMessagesDb";
import { deleteContactUpload } from "../../../lib/contact/contactUploads";
import { POST } from "./contact-messages/bulk-delete";
import { DELETE } from "./contact-messages/[id]";

const messageId = "11111111-1111-4111-8111-111111111111";
const secondId = "22222222-2222-4222-8222-222222222222";
const unselectedId = "33333333-3333-4333-8333-333333333333";

function authedContext(id = messageId) {
  return {
    cookies: { get: () => ({ value: "session" }) },
    url: new URL(`https://example.com/api/watson/contact-messages/${id}`),
    params: { id },
    request: new Request(`https://example.com/api/watson/contact-messages/${id}`, {
      method: "DELETE",
    }),
  } as never;
}

function bulkContext(ids: unknown) {
  return {
    cookies: { get: () => ({ value: "session" }) },
    url: new URL("https://example.com/api/watson/contact-messages/bulk-delete"),
    params: {},
    request: new Request("https://example.com/api/watson/contact-messages/bulk-delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    }),
  } as never;
}

describe("Watson contact message delete", () => {
  beforeEach(() => {
    vi.mocked(deleteContactMessage).mockReset();
    vi.mocked(deleteContactMessages).mockReset();
    vi.mocked(countNewContactMessages).mockReset();
    vi.mocked(deleteContactUpload).mockReset();
  });

  it("rejects an invalid id before deleting", async () => {
    const response = await DELETE(authedContext("../secret"));
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
    expect(deleteContactMessage).not.toHaveBeenCalled();
  });

  it("returns the refreshed new count after a message is deleted", async () => {
    vi.mocked(deleteContactMessage).mockResolvedValueOnce({
      ok: true,
      value: {
        id: messageId,
        status: "new",
        attachmentBlobKey: "contact/11111111-1111-4111-8111-111111111111.jpg",
      },
    });
    vi.mocked(countNewContactMessages).mockResolvedValueOnce(2);
    vi.mocked(deleteContactUpload).mockResolvedValueOnce(true);

    const response = await DELETE(authedContext());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      id: messageId,
      newCount: 2,
    });
    expect(deleteContactUpload).toHaveBeenCalledWith(
      "contact/11111111-1111-4111-8111-111111111111.jpg",
    );
  });

  it("reports a missing message without changing the count", async () => {
    vi.mocked(deleteContactMessage).mockResolvedValueOnce({
      ok: false,
      error: "Message not found.",
      status: 404,
    });

    const response = await DELETE(authedContext());

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Message not found.",
    });
    expect(countNewContactMessages).not.toHaveBeenCalled();
  });
});

describe("Watson contact message bulk delete", () => {
  beforeEach(() => {
    vi.mocked(deleteContactMessages).mockReset();
    vi.mocked(countNewContactMessages).mockReset();
    vi.mocked(deleteContactUpload).mockReset();
  });

  it("deletes only the submitted ids and leaves every other message alone", async () => {
    vi.mocked(deleteContactMessages).mockResolvedValueOnce({
      ok: true,
      value: [
        {
          id: messageId,
          status: "new",
          attachmentBlobKey: "contact/11111111-1111-4111-8111-111111111111.jpg",
        },
        { id: secondId, status: "responded", attachmentBlobKey: null },
      ],
    });
    vi.mocked(countNewContactMessages).mockResolvedValueOnce(1);
    vi.mocked(deleteContactUpload).mockResolvedValueOnce(true);

    const response = await POST(bulkContext([messageId, messageId, secondId]));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      deletedIds: [messageId, secondId],
      deletedCount: 2,
      newCount: 1,
    });
    expect(deleteContactMessages).toHaveBeenCalledWith([messageId, secondId]);
    expect(deleteContactMessages).not.toHaveBeenCalledWith(
      expect.arrayContaining([unselectedId]),
    );
    expect(deleteContactUpload).toHaveBeenCalledTimes(1);
    expect(deleteContactUpload).toHaveBeenCalledWith(
      "contact/11111111-1111-4111-8111-111111111111.jpg",
    );
  });

  it("rejects an invalid id before deleting any message", async () => {
    const response = await POST(bulkContext([messageId, "../secret"]));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ ok: false });
    expect(deleteContactMessages).not.toHaveBeenCalled();
    expect(deleteContactUpload).not.toHaveBeenCalled();
  });

  it("keeps the request failed when the database delete fails", async () => {
    vi.mocked(deleteContactMessages).mockResolvedValueOnce({
      ok: false,
      error: "No matching messages were found.",
      status: 404,
    });

    const response = await POST(bulkContext([messageId]));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "No matching messages were found.",
    });
    expect(deleteContactUpload).not.toHaveBeenCalled();
    expect(countNewContactMessages).not.toHaveBeenCalled();
  });
});

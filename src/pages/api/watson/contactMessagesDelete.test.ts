import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/watson/watsonAuth", () => ({
  isWatsonSessionAuthenticated: vi.fn(() => true),
}));

vi.mock("../../../lib/contact/contactMessagesDb", () => ({
  countNewContactMessages: vi.fn(),
  deleteContactMessage: vi.fn(),
  getContactMessageById: vi.fn(),
  updateContactMessage: vi.fn(),
}));

vi.mock("../../../lib/contact/contactUploads", () => ({
  deleteContactUpload: vi.fn(),
}));

import {
  countNewContactMessages,
  deleteContactMessage,
} from "../../../lib/contact/contactMessagesDb";
import { deleteContactUpload } from "../../../lib/contact/contactUploads";
import { DELETE } from "./contact-messages/[id]";

const messageId = "11111111-1111-4111-8111-111111111111";

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

describe("Watson contact message delete", () => {
  beforeEach(() => {
    vi.mocked(deleteContactMessage).mockReset();
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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleContactPost, handler } from "../contact.js";

function createMemoryPersistence() {
  const messages = [];
  return {
    messages,
    failWrites: false,
    async persistMessage(input) {
      if (this.failWrites) throw new Error("database write failed");
      const record = {
        id: input.id || `msg-${messages.length + 1}`,
        status: "new",
        notificationEmailSent: false,
        notificationEmailError: null,
        ...input,
      };
      messages.push(record);
      return record;
    },
    async recordNotification(id, patch) {
      const record = messages.find((message) => message.id === id);
      if (!record) throw new Error("missing message");
      record.notificationEmailSent = patch.notificationEmailSent;
      record.notificationEmailError = patch.notificationEmailError ?? null;
    },
  };
}

function makeContactRequest(fields) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.set(key, value);
  }
  return new Request("https://example.com/.netlify/functions/contact", {
    method: "POST",
    body: form,
  });
}

describe("contact submission handler", () => {
  /** @type {ReturnType<typeof createMemoryPersistence>} */
  let persistence;
  let fetchImpl;
  let clock;

  beforeEach(() => {
    persistence = createMemoryPersistence();
    clock = 0;
    globalThis.__kbmRateLimit = new Map();
    fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
  });

  afterEach(() => {
    vi.clearAllMocks();
    globalThis.__kbmRateLimit = new Map();
  });

  function deps(overrides = {}) {
    return {
      persistMessage: (input) => persistence.persistMessage(input),
      recordNotification: (id, patch) => persistence.recordNotification(id, patch),
      fetchImpl,
      getResendApiKey: () => "test-resend-key",
      getFromAddress: () => "Knit It Now <hello@knititnow.com>",
      nowIso: () => {
        clock += 1;
        return `2026-07-19T12:00:0${clock}.000Z`;
      },
      ...overrides,
    };
  }

  it("stores a valid contact page submission before sending email", async () => {
    const order = [];
    const req = makeContactRequest({
      name: " Sue Tester ",
      email: " visitor@example.com ",
      message: " Please help with my gauge ",
      form_source: "contact_page",
      page_url: "https://example.com/contact",
      "bot-field": "",
    });

    const res = await handleContactPost(
      req,
      null,
      deps({
        persistMessage: async (input) => {
          order.push("storage");
          return persistence.persistMessage(input);
        },
        fetchImpl: vi.fn(async () => {
          order.push("email");
          return new Response("{}", { status: 200 });
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(order).toEqual(["storage", "email"]);

    expect(persistence.messages).toHaveLength(1);
    expect(persistence.messages[0]).toMatchObject({
      status: "new",
      name: "Sue Tester",
      email: "visitor@example.com",
      message: "Please help with my gauge",
      source: "contact_page",
      pageUrl: "https://example.com/contact",
      notificationEmailSent: true,
    });
  });

  it("stores the sitewide contact modal, Help Hub, and video search forms", async () => {
    const cases = [
      {
        name: "Pat",
        email: "pat@example.com",
        message: "Footer question",
        form_source: "footer",
        page_url: "https://example.com/patterns",
      },
      {
        firstName: "Ada",
        email: "ada@example.com",
        question: "The carriage is jamming",
        form_source: "help-hub",
        page_url: "https://example.com/help-hub",
      },
      {
        firstName: "Bea",
        email: "bea@example.com",
        question: "I searched for tuck stitch",
        form_source: "help-hub",
        page_url: "https://example.com/video-search",
      },
    ];

    for (const fields of cases) {
      const res = await handleContactPost(
        makeContactRequest({ ...fields, "bot-field": "" }),
        null,
        deps(),
      );
      expect(res.status).toBe(200);
    }

    expect(persistence.messages.map((message) => message.source)).toEqual([
      "footer",
      "help-hub",
      "help-hub",
    ]);
    expect(persistence.messages[1].name).toBe("Ada");
    expect(persistence.messages[1].message).toBe("The carriage is jamming");
    expect(persistence.messages[2].pageUrl).toBe("https://example.com/video-search");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("keeps the saved message when notification email fails", async () => {
    fetchImpl = vi.fn(async () => new Response("nope", { status: 500 }));

    const res = await handleContactPost(
      makeContactRequest({
        name: "Sue",
        email: "visitor@example.com",
        message: "Still need help",
        "bot-field": "",
      }),
      null,
      deps({ fetchImpl }),
    );
    expect(res.status).toBe(200);
    expect(persistence.messages).toHaveLength(1);
    expect(persistence.messages[0].notificationEmailSent).toBe(false);
    expect(persistence.messages[0].notificationEmailError).toMatch(/Resend API error 500/);
    expect(persistence.messages[0].message).toBe("Still need help");
  });

  it("keeps the saved message when RESEND_API_KEY is missing", async () => {
    const res = await handleContactPost(
      makeContactRequest({
        name: "Sue",
        email: "visitor@example.com",
        message: "Key missing path",
        "bot-field": "",
      }),
      null,
      deps({ getResendApiKey: () => "" }),
    );
    expect(res.status).toBe(200);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(persistence.messages).toHaveLength(1);
    expect(persistence.messages[0].notificationEmailSent).toBe(false);
    expect(persistence.messages[0].notificationEmailError).toMatch(/RESEND_API_KEY/);
  });

  it("returns an error and does not send email when the database write fails", async () => {
    persistence.failWrites = true;

    const res = await handleContactPost(
      makeContactRequest({
        name: "Sue",
        email: "visitor@example.com",
        message: "Should fail storage",
        "bot-field": "",
      }),
      null,
      deps(),
    );
    expect(res.status).toBe(500);
    expect(await res.text()).toMatch(/couldn't save/i);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(persistence.messages).toHaveLength(0);
  });

  it("rejects invalid submissions without storing them", async () => {
    const missingEmail = await handleContactPost(
      makeContactRequest({
        name: "Sue",
        email: "",
        message: "Hello",
        "bot-field": "",
      }),
      null,
      deps(),
    );
    const badEmail = await handleContactPost(
      makeContactRequest({
        name: "Sue",
        email: "not-an-email",
        message: "Hello",
        "bot-field": "",
      }),
      null,
      deps(),
    );
    const missingMessage = await handleContactPost(
      makeContactRequest({
        name: "Sue",
        email: "visitor@example.com",
        message: "   ",
        "bot-field": "",
      }),
      null,
      deps(),
    );

    expect(missingEmail.status).toBe(400);
    expect(badEmail.status).toBe(400);
    expect(missingMessage.status).toBe(400);
    expect(persistence.messages).toHaveLength(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not store honeypot submissions", async () => {
    const res = await handleContactPost(
      makeContactRequest({
        name: "Bot",
        email: "bot@example.com",
        message: "spam",
        "bot-field": "filled-by-bot",
      }),
      null,
      deps(),
    );
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/contact/thanks/");
    expect(persistence.messages).toHaveLength(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not store rapid duplicate submissions past the existing rate limit", async () => {
    for (let i = 0; i < 5; i += 1) {
      const res = await handleContactPost(
        makeContactRequest({
          name: "Sue",
          email: "visitor@example.com",
          message: `Message ${i}`,
          "bot-field": "",
        }),
        null,
        deps(),
      );
      expect(res.status).toBe(200);
    }

    const blocked = await handleContactPost(
      makeContactRequest({
        name: "Sue",
        email: "visitor@example.com",
        message: "Message 6",
        "bot-field": "",
      }),
      null,
      deps(),
    );
    expect(blocked.status).toBe(302);
    expect(persistence.messages).toHaveLength(5);
    expect(persistence.messages.some((message) => message.message === "Message 6")).toBe(false);
  });

  it("parses a multipart HandlerEvent without calling the live database", async () => {
    const boundary = "----WebKitFormBoundaryLocalHostTest";
    const multipart = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="name"',
      "",
      "Sue",
      `--${boundary}`,
      'Content-Disposition: form-data; name="email"',
      "",
      "visitor@example.com",
      `--${boundary}`,
      'Content-Disposition: form-data; name="message"',
      "",
      "Localhost contact page",
      `--${boundary}`,
      'Content-Disposition: form-data; name="bot-field"',
      "",
      "",
      `--${boundary}`,
      'Content-Disposition: form-data; name="form_source"',
      "",
      "contact_page",
      `--${boundary}--`,
      "",
    ].join("\r\n");

    const result = await handler(
      {
        httpMethod: "POST",
        path: "/.netlify/functions/contact",
        rawUrl: "http://localhost:4321/.netlify/functions/contact",
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          "content-length": String(Buffer.byteLength(multipart)),
        },
        body: multipart,
        isBase64Encoded: true,
      },
      deps(),
    );

    expect(result.statusCode).toBe(200);
    expect(String(result.body || "")).not.toMatch(/couldn't read the form submission/i);
    expect(persistence.messages[0]?.message).toBe("Localhost contact page");
    expect(persistence.messages[0]?.source).toBe("contact_page");
  });

  it("stores attachment details when an image is persisted", async () => {
    const form = new FormData();
    form.set("name", "Sue");
    form.set("email", "visitor@example.com");
    form.set("message", "With photo");
    form.set("bot-field", "");
    form.set(
      "images",
      new File([new Uint8Array([1, 2, 3])], "gauge.jpg", { type: "image/jpeg" }),
    );
    const req = new Request("https://example.com/.netlify/functions/contact", {
      method: "POST",
      body: form,
    });

    const res = await handleContactPost(
      req,
      null,
      deps({
        persistImage: async () => ({
          link: "https://example.com/.netlify/functions/contact-image?id=contact%2Fabc.jpg&token=tok",
          warning: null,
          blobKey: "contact/abc.jpg",
          accessToken: "tok",
          contentType: "image/jpeg",
          originalFilename: "gauge.jpg",
        }),
      }),
    );
    expect(res.status).toBe(200);
    expect(persistence.messages[0].attachment).toEqual({
      blobKey: "contact/abc.jpg",
      accessToken: "tok",
      contentType: "image/jpeg",
      filename: "gauge.jpg",
    });
  });
});

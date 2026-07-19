import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleContactPost, handler } from "../contact.js";
import {
  getContactMessage,
  listContactMessages,
} from "../../../src/lib/contact/contactMessagesStore.ts";

function createMemoryStore() {
  const data = new Map();
  return {
    data,
    async get(key, opts) {
      if (!data.has(key)) return null;
      return opts?.type === "json" ? data.get(key) : data.get(key);
    },
    async setJSON(key, value) {
      if (this.failWrites) throw new Error("blob write failed");
      data.set(key, value);
    },
    async list({ prefix } = {}) {
      const blobs = [...data.keys()]
        .filter((key) => !prefix || key.startsWith(prefix))
        .map((key) => ({ key }));
      return { blobs };
    },
    failWrites: false,
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
  /** @type {ReturnType<typeof createMemoryStore>} */
  let messagesStore;
  let fetchImpl;
  let clock;

  beforeEach(() => {
    messagesStore = createMemoryStore();
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
      messagesStore,
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

  it("saves a valid submission with status new", async () => {
    const req = makeContactRequest({
      name: "Sue Tester",
      email: "visitor@example.com",
      message: "Please help with my gauge",
      form_source: "contact_page",
      page_url: "https://example.com/contact",
      "bot-field": "",
    });

    const res = await handleContactPost(req, null, deps());
    expect(res.status).toBe(200);

    const messages = await listContactMessages(messagesStore, { filter: "all" });
    expect(messages).toHaveLength(1);
    expect(messages[0].status).toBe("new");
    expect(messages[0].email).toBe("visitor@example.com");
    expect(messages[0].message).toBe("Please help with my gauge");
    expect(messages[0].source).toBe("contact_page");
  });

  it("attempts email notification after storage", async () => {
    const order = [];
    const trackingStore = {
      ...messagesStore,
      async setJSON(key, value) {
        order.push("storage");
        return messagesStore.setJSON(key, value);
      },
    };
    fetchImpl = vi.fn(async () => {
      order.push("email");
      return new Response("{}", { status: 200 });
    });

    const req = makeContactRequest({
      name: "Sue",
      email: "visitor@example.com",
      message: "Hello",
      "bot-field": "",
    });

    const res = await handleContactPost(
      req,
      null,
      deps({ messagesStore: trackingStore, fetchImpl }),
    );
    expect(res.status).toBe(200);
    expect(order[0]).toBe("storage");
    expect(order).toContain("email");
    expect(order.indexOf("storage")).toBeLessThan(order.indexOf("email"));
    expect(fetchImpl).toHaveBeenCalledOnce();

    const messages = await listContactMessages(messagesStore, { filter: "all" });
    expect(messages[0].notification_email_sent).toBe(true);
  });

  it("keeps the saved message when notification email fails", async () => {
    fetchImpl = vi.fn(async () => new Response("nope", { status: 500 }));

    const req = makeContactRequest({
      name: "Sue",
      email: "visitor@example.com",
      message: "Still need help",
      "bot-field": "",
    });

    const res = await handleContactPost(req, null, deps({ fetchImpl }));
    expect(res.status).toBe(200);

    const messages = await listContactMessages(messagesStore, { filter: "all" });
    expect(messages).toHaveLength(1);
    expect(messages[0].notification_email_sent).toBe(false);
    expect(messages[0].notification_email_error).toMatch(/Resend API error 500/);
    expect(messages[0].message).toBe("Still need help");
  });

  it("keeps the saved message when RESEND_API_KEY is missing", async () => {
    const req = makeContactRequest({
      name: "Sue",
      email: "visitor@example.com",
      message: "Key missing path",
      "bot-field": "",
    });

    const res = await handleContactPost(
      req,
      null,
      deps({ getResendApiKey: () => "" }),
    );
    expect(res.status).toBe(200);
    expect(fetchImpl).not.toHaveBeenCalled();

    const messages = await listContactMessages(messagesStore, { filter: "all" });
    expect(messages).toHaveLength(1);
    expect(messages[0].notification_email_sent).toBe(false);
    expect(messages[0].notification_email_error).toMatch(/RESEND_API_KEY/);
  });

  it("returns a submission error when storage fails", async () => {
    messagesStore.failWrites = true;

    const req = makeContactRequest({
      name: "Sue",
      email: "visitor@example.com",
      message: "Should fail storage",
      "bot-field": "",
    });

    const res = await handleContactPost(req, null, deps());
    expect(res.status).toBe(500);
    expect(await res.text()).toMatch(/couldn't save/i);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(messagesStore.data.size).toBe(0);
  });

  it("rejects invalid submissions missing email or message", async () => {
    const res = await handleContactPost(
      makeContactRequest({
        name: "Sue",
        email: "",
        message: "Hello",
        "bot-field": "",
      }),
      null,
      deps(),
    );
    expect(res.status).toBe(400);
    expect(messagesStore.data.size).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not create a contact-message record for honeypot submissions", async () => {
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
    expect(messagesStore.data.size).toBe(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("parses Netlify Dev HandlerEvent multipart mislabeled as base64 via classic handler", async () => {
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

    const result = await handler({
      httpMethod: "POST",
      path: "/.netlify/functions/contact",
      rawUrl: "http://localhost:4321/.netlify/functions/contact",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
        "content-length": String(Buffer.byteLength(multipart)),
      },
      body: multipart,
      isBase64Encoded: true,
    });

    // Without deps injection, handler uses real blobs/resend — only assert parse succeeded
    // by checking we did not return the form-parse error.
    expect(result.statusCode).not.toBe(400);
    expect(String(result.body || "")).not.toMatch(/couldn't read the form submission/i);
  });

  it("stores attachment blob key and token when an image is persisted", async () => {
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

    const messages = await listContactMessages(messagesStore, { filter: "all" });
    expect(messages[0].attachment).toEqual({
      blob_key: "contact/abc.jpg",
      access_token: "tok",
      content_type: "image/jpeg",
      original_filename: "gauge.jpg",
    });

    const loaded = await getContactMessage(messagesStore, messages[0].id);
    expect(loaded?.attachment?.blob_key).toBe("contact/abc.jpg");
  });
});

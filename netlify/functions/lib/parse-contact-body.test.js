import { describe, expect, it } from "vitest";
import {
  handlerEventToRequest,
  isHandlerEvent,
  parseContactFormData,
} from "./parse-contact-body.js";

const BOUNDARY = "----VitestFormBoundary7MA4YWxk";

/**
 * @param {Record<string, string>} fields
 * @param {{ name: string, filename: string, type: string, content: Buffer }[]} [files]
 */
function buildMultipartBuffer(fields, files = []) {
  const lines = [];
  const delim = `--${BOUNDARY}`;

  for (const [name, value] of Object.entries(fields)) {
    lines.push(
      `${delim}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
    );
  }

  for (const file of files) {
    lines.push(
      `${delim}\r\nContent-Disposition: form-data; name="${file.name}"; filename="${file.filename}"\r\nContent-Type: ${file.type}\r\n\r\n`,
    );
    lines.push(file.content);
    lines.push("\r\n");
  }

  lines.push(`${delim}--\r\n`);
  return Buffer.concat(lines.map((part) => (Buffer.isBuffer(part) ? part : Buffer.from(part, "utf8"))));
}

function multipartRequest(buffer, { contentLength } = {}) {
  const headers = {
    "content-type": `multipart/form-data; boundary=${BOUNDARY}`,
  };
  if (contentLength != null) {
    headers["content-length"] = String(contentLength);
  }

  return new Request("http://localhost/.netlify/functions/contact", {
    method: "POST",
    headers,
    body: buffer,
  });
}

describe("parseContactFormData", () => {
  it("parses text-only multipart from a Request body", async () => {
    const buffer = buildMultipartBuffer({
      name: "Sue",
      email: "sue@example.com",
      message: "Hello from vitest",
      "bot-field": "",
      form_source: "modal",
    });

    const formData = await parseContactFormData(multipartRequest(buffer), null);

    expect(formData.get("name")).toBe("Sue");
    expect(formData.get("email")).toBe("sue@example.com");
    expect(formData.get("message")).toBe("Hello from vitest");
  });

  it("parses multipart with a small PNG via Request body", async () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    const buffer = buildMultipartBuffer(
      {
        name: "Sue",
        email: "sue@example.com",
        message: "With image",
        "bot-field": "",
      },
      [
        {
          name: "images",
          filename: "test.png",
          type: "image/png",
          content: png,
        },
      ],
    );

    const formData = await parseContactFormData(multipartRequest(buffer), null);
    const image = formData.get("images");

    expect(formData.get("message")).toBe("With image");
    expect(image).toBeTruthy();
    expect(typeof image).not.toBe("string");
    expect(image instanceof Blob).toBe(true);
    expect(image.size).toBeGreaterThan(0);
  });

  it("parses Help Hub urlencoded fields from a Request body", async () => {
    const body =
      "form-name=help-hub-question&firstName=Sue&email=sue%40example.com&question=Need+help&bot-field=&form_source=help-hub";
    const req = new Request("http://localhost/.netlify/functions/contact", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "content-length": String(Buffer.byteLength(body)),
      },
      body,
    });

    const formData = await parseContactFormData(req, null);

    expect(formData.get("firstName")).toBe("Sue");
    expect(formData.get("email")).toBe("sue@example.com");
    expect(formData.get("question")).toBe("Need help");
    expect(formData.get("form_source")).toBe("help-hub");
  });

  it("parses HandlerEvent bodies when the Request is built from the event", async () => {
    const buffer = buildMultipartBuffer({
      name: "Handler",
      email: "handler@example.com",
      message: "From HandlerEvent",
      "bot-field": "",
    });

    /** @type {import("@netlify/functions").HandlerEvent} */
    const event = {
      httpMethod: "POST",
      path: "/.netlify/functions/contact",
      rawUrl: "https://knititnow.com/.netlify/functions/contact",
      headers: {
        "content-type": `multipart/form-data; boundary=${BOUNDARY}`,
        "content-length": String(buffer.length),
      },
      body: buffer.toString("latin1"),
      isBase64Encoded: false,
    };

    expect(isHandlerEvent(event)).toBe(true);
    const req = handlerEventToRequest(event);
    const formData = await parseContactFormData(req, event);

    expect(formData.get("email")).toBe("handler@example.com");
    expect(formData.get("message")).toBe("From HandlerEvent");
  });
});

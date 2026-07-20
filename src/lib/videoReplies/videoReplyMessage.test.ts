import { describe, expect, it } from "vitest";

import {
  buildDefaultVideoReplyEmailMessage,
  buildVideoReplyPublicUrl,
  extractFirstName,
} from "./videoReplyMessage";

describe("videoReplyMessage", () => {
  it("extracts first name", () => {
    expect(extractFirstName("Sue Smith")).toBe("Sue");
    expect(extractFirstName("Pat")).toBe("Pat");
  });

  it("builds public viewing URL without query params for PII", () => {
    const url = buildVideoReplyPublicUrl("https://example.com/", "tok_abc");
    expect(url).toBe("https://example.com/video-reply/tok_abc");
    expect(url).not.toContain("email=");
    expect(url).not.toContain("name=");
  });

  it("builds the default copyable email message", () => {
    const message = buildDefaultVideoReplyEmailMessage({
      memberName: "Alex Rivera",
      publicViewingUrl: "https://example.com/video-reply/abc",
    });
    expect(message).toContain("Hi Alex,");
    expect(message).toContain("https://example.com/video-reply/abc");
    expect(message).toContain("Sue");
    expect(message).toContain("Knit It Now");
  });
});

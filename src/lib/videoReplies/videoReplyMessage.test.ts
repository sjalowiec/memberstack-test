import { describe, expect, it } from "vitest";

import {
  buildDefaultVideoReplyEmailMessage,
  buildMembershipThankYouEmailMessage,
  buildMembershipThankYouGreeting,
  buildVideoReplyPublicUrl,
  MEMBERSHIP_THANK_YOU_EMAIL_SUBJECT,
  membershipThankYouFirstName,
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

  it("builds the membership thank-you email without the recipient address", () => {
    expect(MEMBERSHIP_THANK_YOU_EMAIL_SUBJECT).toBe("A personal thank-you from Sue");
    expect(membershipThankYouFirstName("Ada Lovelace")).toBe("Ada");
    expect(membershipThankYouFirstName("Name not on file")).toBe("there");
    expect(buildMembershipThankYouGreeting("Ada")).toBe(
      "Hi Ada! I recorded this little message just for you. Thank you for being part of Knit It Now.",
    );
    const message = buildMembershipThankYouEmailMessage({
      memberName: "Ada Lovelace",
      publicViewingUrl: "https://example.com/video-reply/token",
    });
    expect(message).toBe(
      [
        "Hi Ada,",
        "",
        "Thank you for being a Knit It Now member! I recorded a little video just for you.",
        "",
        "Watch your personal video:",
        "https://example.com/video-reply/token",
        "",
        "I’m so glad you’re part of our machine knitting community. If you have a question or need help finding something, just reply to this email. I’m happy to help.",
        "",
        "Happy knitting!",
        "Sue",
      ].join("\n"),
    );
    expect(message).not.toContain("ada@example.com");
    expect(message).not.toContain("private");
  });
});

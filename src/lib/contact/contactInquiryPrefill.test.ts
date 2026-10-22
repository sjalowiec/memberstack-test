import { describe, expect, it } from "vitest";

import { contactInquiryPrefill } from "./contactInquiryPrefill";

describe("contact inquiry prefill", () => {
  it("keeps the Studio post title and path for the contact form", () => {
    const prefill = contactInquiryPrefill(
      "?subject=Sue%27s%20Studio%3A%20Sue%27s%20Studio%20(%2Fstudio%2Fcomments-test)&page=%2Fstudio%2Fcomments-test",
    );
    expect(prefill.subject).toBe("Sue's Studio: Sue's Studio (/studio/comments-test)");
    expect(prefill.pagePath).toBe("/studio/comments-test");
  });

  it("ignores a missing subject and an off-site page", () => {
    expect(contactInquiryPrefill("")).toEqual({ subject: null, pagePath: null });
    expect(contactInquiryPrefill("?page=https://evil.example/studio").pagePath).toBeNull();
    expect(contactInquiryPrefill("?page=//evil.example/studio").pagePath).toBeNull();
  });
});

import { describe, expect, it } from "vitest";

import { buildContactReplyMailto } from "./contactMessageMailto";

describe("buildContactReplyMailto", () => {
  it("builds a mailto link with visitor email and useful subject", () => {
    const href = buildContactReplyMailto({
      email: "visitor@example.com",
      name: "Pat",
      source: "help-hub",
      createdAt: "Jul 19, 2026, 12:00 PM",
    });

    expect(href.startsWith("mailto:visitor@example.com?")).toBe(true);
    const params = new URL(href).searchParams;
    expect(params.get("subject")).toContain("Re: Knit It Now contact");
    expect(params.get("subject")).toContain("help-hub");
  });
});


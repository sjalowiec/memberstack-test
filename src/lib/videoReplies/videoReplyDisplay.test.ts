import { describe, expect, it } from "vitest";

import {
  linkStatusLabel,
  openedStatusLabel,
  sentStatusLabel,
} from "./videoReplyDisplay";

describe("videoReplyDisplay", () => {
  it("formats plain status text", () => {
    expect(sentStatusLabel(null)).toBe("Not sent");
    expect(sentStatusLabel("2026-07-19T12:00:00.000Z")).toMatch(/^Sent /);
    expect(openedStatusLabel(null)).toBe("Not opened");
    expect(openedStatusLabel("2026-07-19T12:00:00.000Z")).toMatch(/^Opened /);
    expect(linkStatusLabel("disabled", "2026-07-19T12:00:00.000Z")).toBe("Link disabled");
    expect(linkStatusLabel("active", null)).toBe("Active");
  });
});

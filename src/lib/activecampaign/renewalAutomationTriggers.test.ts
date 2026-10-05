import { describe, expect, it } from "vitest";

import {
  confirmedRenewalTriggerTags,
  confirmedStartBlockTriggerTags,
} from "./renewalAutomationTriggers";

const ids = new Map([["16", "legacy-renewal-7-days"]]);

describe("legacy renewal automation triggers", () => {
  it("accepts an exact tag field and a resolved tag id", () => {
    expect(
      confirmedRenewalTriggerTags(
        {
          automationTriggers: [
            { type: "tag", tag: "legacy-renewal-30-days" },
            { params: "{\"tagid\":\"16\"}" },
          ],
        },
        ids,
      ),
    ).toEqual(["legacy-renewal-30-days", "legacy-renewal-7-days"]);
  });

  it("does not treat an automation name or email body as the trigger", () => {
    expect(
      confirmedRenewalTriggerTags(
        {
          name: "Legacy Annual Renewal - 1 Day",
          email: "Use legacy-renewal-1-day in the message",
        },
        ids,
      ),
    ).toEqual([]);
  });

  it("reads the tag only from a start block", () => {
    expect(
      confirmedStartBlockTriggerTags(
        {
          automationBlocks: [
            { type: "start", params: { tag: "legacy-renewal-1-day" } },
            { type: "send", params: { tag: "legacy-renewal-30-days" } },
          ],
        },
        new Map(),
      ),
    ).toEqual(["legacy-renewal-1-day"]);
  });
});

import { describe, expect, it } from "vitest";

import {
  confirmedRenewalTriggerTags,
  confirmedStartBlockTriggerTags,
} from "./renewalAutomationTriggers";

const ids = new Map([["16", "legacy-renewal-expired"]]);

describe("legacy renewal automation triggers", () => {
  it("accepts an exact tag field and a resolved tag id", () => {
    expect(
      confirmedRenewalTriggerTags(
        {
          automationTriggers: [
            { type: "tag", tag: "legacy-renewal-expired" },
            { params: "{\"tagid\":\"16\"}" },
            { type: "tag", tag: "legacy-renewal-30-days" },
          ],
        },
        ids,
      ),
    ).toEqual(["legacy-renewal-expired"]);
  });

  it("does not treat an automation name or email body as the trigger", () => {
    expect(
      confirmedRenewalTriggerTags(
        {
          name: "Legacy Renewal Expired",
          email: "Use legacy-renewal-expired in the message",
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
            { type: "start", params: { tag: "legacy-renewal-expired" } },
            { type: "send", params: { tag: "legacy-renewal-30-days" } },
          ],
        },
        new Map(),
      ),
    ).toEqual(["legacy-renewal-expired"]);
  });
});

import { describe, expect, it } from "vitest";
import { replacementOptionsFor } from "./categoryAdminClient";

describe("Help Hub category admin replacements", () => {
  it("offers only active categories other than the one being retired", () => {
    const options = replacementOptionsFor(
      [
        { id: 2, key: "knitting-doesnt-look-right", label: "Look Right", sortOrder: 20, retiredAt: null, usageCount: 2 },
        { id: 1, key: "machine-not-working", label: "Something’s Not Working", sortOrder: 10, retiredAt: null, usageCount: 0 },
        { id: 9, key: "lk150", label: "LK150", sortOrder: 90, retiredAt: "seeded", usageCount: 0 },
      ],
      2,
    );
    expect(options.map((row) => row.key)).toEqual(["machine-not-working"]);
  });
});

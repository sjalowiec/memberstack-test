import { describe, expect, it } from "vitest";

import { normalizeHeaderName, headerToPgColumn } from "./columnNormalize";

describe("columnNormalize", () => {
  it("strips BOM and trailing carriage returns from headers", () => {
    expect(normalizeHeaderName("\uFEFFStripCustomerID\r")).toBe("StripCustomerID");
    expect(headerToPgColumn("Fristname\r")).toBe("fristname");
  });
});

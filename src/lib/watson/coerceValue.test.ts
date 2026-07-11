import { describe, expect, it } from "vitest";

import { isNullLiteral, coerceCellValue } from "./coerceValue";

describe("coerceValue", () => {
  it("treats empty strings and NULL literals as null", () => {
    expect(isNullLiteral("")).toBe(true);
    expect(isNullLiteral("NULL")).toBe(true);
    expect(isNullLiteral("null")).toBe(true);
    expect(isNullLiteral("value")).toBe(false);
  });

  it("coerces timestamps from legacy SQL Server format", () => {
    const result = coerceCellValue("2009-08-21 00:43:14.703", {
      source: "DateJoined",
      pg: "datejoined",
      type: "timestamptz",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeInstanceOf(Date);
    }
  });

  it("rejects invalid integers", () => {
    const result = coerceCellValue("abc", {
      source: "active",
      pg: "active",
      type: "integer",
    });
    expect(result.ok).toBe(false);
  });
});

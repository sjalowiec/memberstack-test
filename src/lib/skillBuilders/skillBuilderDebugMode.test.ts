import { describe, expect, it } from "vitest";
import { isSkillBuilderDebugMode } from "./skillBuilderDebugMode";

describe("isSkillBuilderDebugMode", () => {
  it("returns true for ?debug=1 and ?dev=1", () => {
    expect(isSkillBuilderDebugMode("?debug=1")).toBe(true);
    expect(isSkillBuilderDebugMode("?dev=1")).toBe(true);
    expect(isSkillBuilderDebugMode("?gauge=20&debug=1")).toBe(true);
  });

  it("returns false without debug flags", () => {
    expect(isSkillBuilderDebugMode("")).toBe(false);
    expect(isSkillBuilderDebugMode("?debug=0")).toBe(false);
    expect(isSkillBuilderDebugMode("?dev=true")).toBe(false);
  });
});

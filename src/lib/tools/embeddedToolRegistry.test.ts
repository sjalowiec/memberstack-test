import { describe, expect, it } from "vitest";
import {
  availableEmbeddedToolsForContext,
  embeddedToolsForContext,
  getEmbeddedToolByKey,
} from "./embeddedToolRegistry";

describe("embeddedToolRegistry", () => {
  it("finds maximum knitted width by key", () => {
    const tool = getEmbeddedToolByKey("maximum-knitted-width");
    expect(tool?.name).toBe("Maximum Knitted Width");
    expect(tool?.status).toBe("available");
  });

  it("lists course tools including planned entries", () => {
    const courseTools = embeddedToolsForContext("course");
    expect(courseTools.some((t) => t.key === "maximum-knitted-width")).toBe(true);
    expect(courseTools.some((t) => t.key === "gauge-comparison")).toBe(true);
  });

  it("returns only available tools for course editor dropdown", () => {
    const available = availableEmbeddedToolsForContext("course");
    expect(available.every((t) => t.status === "available")).toBe(true);
    expect(available.map((t) => t.key)).toEqual([
      "maximum-knitted-width",
      "yarn-estimator",
    ]);
  });

  it("finds yarn estimator by key", () => {
    const tool = getEmbeddedToolByKey("yarn-estimator");
    expect(tool?.name).toBe("Yarn Estimator");
    expect(tool?.status).toBe("available");
    expect(tool?.standalonePath).toBe("/tools/yarn-estimator");
  });
});
